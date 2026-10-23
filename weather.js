/* Weather — National Weather Service + WeatherAPI.com + The Weather Channel (TWC), averaged into "the AME forecast".
   NWS needs no key. WeatherAPI / TWC keys live ONLY in this browser's localStorage (never in the repo, never in SharePoint).
   Saved places: config/weather = {locs:[{n,lat,lon}]}. */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1M12.2 3.8l-1 1"/><path d="M7 20h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 13 3.5 3.5 0 0 0 7 20z"/></svg>';
const SRC=[['nws','National Weather Service'],['wapi','WeatherAPI.com'],['twc','The Weather Channel']];
const DEF=[{n:'Upland, CA (office)',lat:34.0975,lon:-117.6484}];
const TTL=10*60e3;
let LOCS=DEF.slice(),cur=0,DATA=null,busy=false,CACHE={};

/* ---- keys: this browser only ---- */
const KK='ameWxKeys';
const keys=()=>{try{return JSON.parse(localStorage.getItem(KK)||'{}')||{}}catch(e){return {}}};
const setKeys=k=>{try{localStorage.setItem(KK,JSON.stringify(k));return true}catch(e){return false}};

/* ---- helpers ---- */
const round=x=>x==null||isNaN(x)?null:Math.round(x);
const avg=a=>{a=a.filter(x=>x!=null&&!isNaN(x));return a.length?a.reduce((s,x)=>s+x,0)/a.length:null};
const rng=a=>{a=a.filter(x=>x!=null&&!isNaN(x));return a.length>1?Math.max(...a)-Math.min(...a):0};
const dkey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dlabel=s=>{const d=new Date(s+'T12:00:00');const t=dkey(new Date());return (s===t?'Today':d.toLocaleDateString('en-US',{weekday:'short'}))+' '+(d.getMonth()+1)+'/'+d.getDate()};
async function jget(url,opt){const c=new AbortController();const t=setTimeout(()=>c.abort(),12000);try{const r=await fetch(url,{...(opt||{}),signal:c.signal});if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e}return await r.json()}finally{clearTimeout(t)}}
const maxWind=s=>{const m=String(s||'').match(/\d+/g);return m?Math.max(...m.map(Number)):null};

/* ---- sources: each returns {cur:{t,wind,txt},days:{date:{hi,lo,pop,wind,txt}},alerts:[]} ---- */
async function getNWS(l){
  const p=(await jget(`https://api.weather.gov/points/${l.lat.toFixed(4)},${l.lon.toFixed(4)}`,{headers:{Accept:'application/geo+json'}})).properties;
  const f=await jget(p.forecast,{headers:{Accept:'application/geo+json'}});
  const days={};
  (f.properties.periods||[]).forEach(x=>{const k=String(x.startTime).slice(0,10);const d=days[k]=days[k]||{};const t=x.temperatureUnit==='C'?x.temperature*9/5+32:x.temperature;
    if(x.isDaytime){d.hi=t;d.txt=x.shortForecast}else{d.lo=d.lo==null?t:Math.min(d.lo,t);if(!d.txt)d.txt=x.shortForecast}
    const pp=x.probabilityOfPrecipitation&&x.probabilityOfPrecipitation.value;if(pp!=null)d.pop=Math.max(d.pop||0,pp);
    const w=maxWind(x.windSpeed);if(w!=null)d.wind=Math.max(d.wind||0,w)});
  const out={cur:null,days,alerts:[]};
  try{const st=await jget(p.observationStations,{headers:{Accept:'application/geo+json'}});
    for(const s of (st.features||[]).slice(0,3)){try{const o=(await jget(`https://api.weather.gov/stations/${s.properties.stationIdentifier}/observations/latest`,{headers:{Accept:'application/geo+json'}})).properties;
      if(o.temperature&&o.temperature.value!=null){out.cur={t:o.temperature.value*9/5+32,wind:o.windSpeed&&o.windSpeed.value!=null?o.windSpeed.value*0.621371:null,txt:o.textDescription||''};break}}catch(e){}}}catch(e){}
  try{const a=await jget(`https://api.weather.gov/alerts/active?point=${l.lat.toFixed(4)},${l.lon.toFixed(4)}`,{headers:{Accept:'application/geo+json'}});
    out.alerts=(a.features||[]).map(x=>({ev:x.properties.event,sev:x.properties.severity,head:x.properties.headline})).slice(0,4)}catch(e){}
  return out}
async function getWAPI(l,k){
  const j=await jget(`https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(k)}&q=${l.lat},${l.lon}&days=3&aqi=no&alerts=no`);
  const days={};(j.forecast.forecastday||[]).forEach(x=>{const d=x.day;days[x.date]={hi:d.maxtemp_f,lo:d.mintemp_f,pop:Math.max(d.daily_chance_of_rain||0,d.daily_chance_of_snow||0),wind:d.maxwind_mph,txt:d.condition&&d.condition.text}});
  return {cur:{t:j.current.temp_f,wind:j.current.wind_mph,txt:(j.current.condition||{}).text||''},days,alerts:[]}}
async function getTWC(l,k){
  const g=`${l.lat.toFixed(3)},${l.lon.toFixed(3)}`,K=encodeURIComponent(k);
  const f=await jget(`https://api.weather.com/v3/wx/forecast/daily/5day?geocode=${g}&format=json&units=e&language=en-US&apiKey=${K}`);
  const days={},dp=(f.daypart&&f.daypart[0])||{};
  (f.validTimeLocal||[]).forEach((v,i)=>{const pc=[dp.precipChance&&dp.precipChance[2*i],dp.precipChance&&dp.precipChance[2*i+1]].filter(x=>x!=null);const wd=[dp.windSpeed&&dp.windSpeed[2*i],dp.windSpeed&&dp.windSpeed[2*i+1]].filter(x=>x!=null);
    days[String(v).slice(0,10)]={hi:(f.calendarDayTemperatureMax||f.temperatureMax||[])[i],lo:(f.calendarDayTemperatureMin||f.temperatureMin||[])[i],pop:pc.length?Math.max(...pc):null,wind:wd.length?Math.max(...wd):null,txt:(f.narrative||[])[i]?'':''}});
  let c=null;try{const o=await jget(`https://api.weather.com/v3/wx/observations/current?geocode=${g}&units=e&language=en-US&format=json&apiKey=${K}`);c={t:o.temperature,wind:o.windSpeed,txt:o.wxPhraseLong||''}}catch(e){}
  return {cur:c,days,alerts:[]}}
const FN={nws:l=>getNWS(l),wapi:(l,k)=>getWAPI(l,k),twc:(l,k)=>getTWC(l,k)};

async function load(force){
  const l=LOCS[cur];if(!l)return;const ck=l.lat+','+l.lon;
  if(!force&&CACHE[ck]&&Date.now()-CACHE[ck].at<TTL){DATA=CACHE[ck];return}
  busy=true;render();const K=keys();
  const res={};await Promise.all(SRC.map(async([id])=>{
    if(id!=='nws'&&!K[id]){res[id]={st:'nokey'};return}
    try{res[id]={st:'ok',d:await FN[id](l,K[id])}}catch(e){res[id]={st:'err',msg:(e&&e.name==='AbortError')?'timed out':(e&&e.message)||'failed',status:e&&e.status}}}));
  DATA=CACHE[ck]={at:Date.now(),res};busy=false;render()}

/* ---- combine ---- */
function combine(res){
  const ok=SRC.map(s=>s[0]).filter(id=>res[id]&&res[id].st==='ok');
  const dates=[...new Set(ok.flatMap(id=>Object.keys(res[id].d.days)))].sort().filter(d=>d>=dkey(new Date())).slice(0,5);
  const days=dates.map(dt=>{const rows=ok.map(id=>({id,...(res[id].d.days[dt]||{})})).filter(r=>r.hi!=null||r.lo!=null||r.pop!=null);
    const hiA=avg(rows.map(r=>r.hi)),loA=avg(rows.map(r=>r.lo));
    return {dt,rows,hi:hiA,lo:loA,pop:avg(rows.map(r=>r.pop)),wind:avg(rows.map(r=>r.wind)),n:rows.length,
      dis:rng(rows.map(r=>r.hi))>=6||rng(rows.map(r=>r.pop))>=30,txt:(rows.find(r=>r.txt)||{}).txt||''}});
  const cs=ok.map(id=>({id,...(res[id].d.cur||{})})).filter(c=>c.t!=null);
  return {ok,days,cur:{t:avg(cs.map(c=>c.t)),wind:avg(cs.map(c=>c.wind)),n:cs.length,txt:(cs.find(c=>c.txt)||{}).txt||'',rows:cs},alerts:ok.flatMap(id=>res[id].d.alerts||[])}}
/* Roofing flags — guidance thresholds, tune later */
function flags(d){const f=[];if(d.pop!=null&&d.pop>=40)f.push(['rain','Rain risk']);if(d.wind!=null&&d.wind>=20)f.push(['wind','Wind']);if(d.hi!=null&&d.hi>=95)f.push(['heat','Heat']);if(d.lo!=null&&d.lo<=40)f.push(['cold','Cold']);return f}

/* ---- UI ---- */
const S=document.getElementById('tab-wx')||(()=>{const s=document.createElement('section');s.id='tab-wx';s.hidden=true;document.querySelector('main').appendChild(s);return s})();
if(!document.getElementById('wxCss'))document.head.insertAdjacentHTML('beforeend','<style id="wxCss">#tab-wx .wxbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}#tab-wx .wxbar select{flex:1 1 200px;min-width:0}#tab-wx .wxhero{display:flex;align-items:center;gap:18px;padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--panel);margin:12px 0}#tab-wx .wxbig{font-family:var(--display);font-size:64px;line-height:1;font-weight:800}#tab-wx .wxbig small{font-size:26px;opacity:.7}#tab-wx .wxsub{color:var(--muted);font-size:14px;margin-top:4px}#tab-wx .wxsrc{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}#tab-wx .wxchip{font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--chip);color:var(--muted)}#tab-wx .wxchip.ok{color:#2ea043;border-color:#2ea043}#tab-wx .wxchip.err{color:#e2513a;border-color:#e2513a}#tab-wx .wxdays{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}#tab-wx .wxd{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:12px 14px;min-width:0}#tab-wx .wxd h4{margin:0 0 6px;font-size:15px}#tab-wx .wxd .t{font-size:26px;font-weight:800;font-family:var(--display)}#tab-wx .wxd .t span{opacity:.55;font-size:20px}#tab-wx .wxd .m{color:var(--muted);font-size:13px;margin-top:2px}#tab-wx .wxd table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}#tab-wx .wxd td{padding:3px 0;border-top:1px solid var(--line);white-space:nowrap}#tab-wx .wxd td:first-child{color:var(--muted)}#tab-wx .wxd td:not(:first-child){text-align:right}#tab-wx .wxfl{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}#tab-wx .wxfl i{font-style:normal;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#e2513a22;color:#e2513a}#tab-wx .wxfl i.wind{background:#e8a33c22;color:#e8a33c}#tab-wx .wxfl i.heat{background:#e2513a22}#tab-wx .wxfl i.cold{background:#2f81f722;color:#2f81f7}#tab-wx .wxdis{font-size:11px;color:#e8a33c;font-weight:700;margin-top:4px}#tab-wx .wxal{border:1px solid #e2513a;background:#e2513a18;border-radius:12px;padding:10px 12px;margin:8px 0;font-size:14px}#tab-wx .wxal b{color:#e2513a}@media(max-width:700px){#tab-wx .wxbar select{flex:1 1 100%}#tab-wx .wxbig{font-size:52px}#tab-wx .wxhero{padding:14px;gap:12px}#tab-wx .wxdays{grid-template-columns:1fr 1fr}}</style>');

const F=x=>x==null?'–':Math.round(x)+'°';
function render(){
  if(!(typeof isDev==='function'&&isDev(curUser))){S.innerHTML='';return}
  const l=LOCS[cur]||LOCS[0];
  let h=`<div class="mplhead"><h2>Weather</h2></div><div class="wxbar"><select id="wxLoc">${LOCS.map((x,i)=>`<option value="${i}"${i===cur?' selected':''}>${E(x.n)}</option>`).join('')}</select><button class="btn" id="wxAdd">+ Place</button><button class="btn" id="wxRef">${busy?'Loading…':'Refresh'}</button><button class="btn" id="wxKeys">Sources</button></div>`;
  if(!DATA){S.innerHTML=h+'<p class="muted">'+(busy?'Loading forecasts…':'')+'</p>';bind();return}
  const res=DATA.res,C=combine(res);
  h+='<div class="wxsrc">'+SRC.map(([id,nm])=>{const r=res[id]||{};return `<span class="wxchip ${r.st==='ok'?'ok':r.st==='err'?'err':''}" title="${E(r.msg||'')}">${nm}: ${r.st==='ok'?'OK':r.st==='nokey'?'add key':'error '+E(r.msg||'')}</span>`}).join('')+'</div>';
  C.alerts.forEach(a=>{h+=`<div class="wxal"><b>${E(a.ev)}</b> — ${E(a.head||'')}</div>`});
  if(!C.ok.length){S.innerHTML=h+'<p class="muted">No source answered. Check your connection and tap Refresh.</p>';bind();return}
  h+=`<div class="wxhero"><div><div class="wxbig">${F(C.cur.t)}<small>F</small></div><div class="wxsub">AME average of ${C.cur.n||0} source${C.cur.n===1?'':'s'} · wind ${C.cur.wind!=null?Math.round(C.cur.wind)+' mph':'–'}</div></div><div style="min-width:0"><div style="font-weight:700;font-size:18px">${E(C.cur.txt||'')}</div><div class="wxsub">${E(l.n)} · updated ${new Date(DATA.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</div></div></div>`;
  if(C.cur.rows.length>1)h+=`<div class="muted" style="font-size:13px;margin:-4px 0 12px">Right now: ${C.cur.rows.map(c=>SRC.find(s=>s[0]===c.id)[1].replace('National Weather Service','NWS').replace('The Weather Channel','TWC')+' '+F(c.t)).join(' · ')}</div>`;
  h+='<div class="wxdays">'+C.days.map(d=>{const fl=flags(d);return `<div class="wxd"><h4>${dlabel(d.dt)}</h4><div class="t">${F(d.hi)} <span>${F(d.lo)}</span></div><div class="m">Rain ${d.pop!=null?Math.round(d.pop)+'%':'–'} · Wind ${d.wind!=null?Math.round(d.wind)+' mph':'–'}</div>${fl.length?'<div class="wxfl">'+fl.map(([k,t])=>`<i class="${k}">${t}</i>`).join('')+'</div>':''}${d.dis?'<div class="wxdis">Sources disagree</div>':''}<table>${d.rows.map(r=>`<tr><td>${r.id==='nws'?'NWS':r.id==='twc'?'TWC':'WAPI'}</td><td>${F(r.hi)}/${F(r.lo)}</td><td>${r.pop!=null?Math.round(r.pop)+'%':'–'}</td></tr>`).join('')}</table><div class="muted" style="font-size:11px;margin-top:4px">${d.n} source${d.n===1?'':'s'}</div></div>`}).join('')+'</div>';
  h+='<p class="muted" style="font-size:12px;margin-top:14px">Flags are guidance only: rain ≥40%, wind ≥20 mph, high ≥95°, low ≤40°. Sources: National Weather Service, WeatherAPI.com, The Weather Channel.</p>';
  S.innerHTML=h;bind()}
function bind(){
  const q=id=>S.querySelector(id);
  q('#wxLoc')&&(q('#wxLoc').onchange=e=>{cur=+e.target.value;DATA=null;load()});
  q('#wxRef')&&(q('#wxRef').onclick=()=>load(true));
  q('#wxAdd')&&(q('#wxAdd').onclick=addDlg);
  q('#wxKeys')&&(q('#wxKeys').onclick=keyDlg)}

function dlg(inner){const r=document.getElementById('dlgRoot');r.innerHTML=`<div class="scrim sheet"><div class="dlg" style="max-width:520px">${inner}</div></div>`;const cl=()=>{r.innerHTML=''};r.querySelector('.scrim').onclick=e=>{if(e.target.classList.contains('scrim'))cl()};return {r,cl}}
function keyDlg(){
  const K=keys();const {r,cl}=dlg(`<h3>Weather sources</h3><p class="muted" style="margin-top:0">National Weather Service needs no key. The two keys below are saved only in this browser — never in the app code or SharePoint.</p>
  <label class="f">WeatherAPI.com key <small class="muted">(free plan · weatherapi.com)</small><input id="kW" type="password" autocomplete="off" value="${E(K.wapi||'')}" placeholder="paste key"></label>
  <label class="f">The Weather Channel key <small class="muted">(The Weather Company API — paid, 30-day free trial)</small><input id="kT" type="password" autocomplete="off" value="${E(K.twc||'')}" placeholder="paste key"></label>
  <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end"><button class="btn" id="kX">Cancel</button><button class="btn primary" id="kS">Save</button></div>`);
  r.querySelector('#kX').onclick=cl;
  r.querySelector('#kS').onclick=()=>{const k={wapi:r.querySelector('#kW').value.trim(),twc:r.querySelector('#kT').value.trim()};if(!k.wapi)delete k.wapi;if(!k.twc)delete k.twc;setKeys(k);CACHE={};DATA=null;cl();load(true)}}
function addDlg(){
  const {r,cl}=dlg(`<h3>Add a place</h3><p class="muted" style="margin-top:0">Type a city or ZIP (uses WeatherAPI.com — add its key first), or type coordinates like <b>34.10, -117.65</b>.</p>
  <label class="f">Place<input id="pQ" placeholder="Rancho Cucamonga, CA  or  34.10, -117.65"></label><div id="pR" class="muted" style="margin:8px 0"></div>
  <div style="display:flex;gap:8px;margin-top:10px;justify-content:space-between"><button class="btn" id="pDel"${LOCS.length>1?'':' disabled'}>Remove current</button><span style="display:flex;gap:8px"><button class="btn" id="pX">Close</button><button class="btn primary" id="pGo">Add</button></span></div>`);
  r.querySelector('#pX').onclick=cl;
  r.querySelector('#pDel').onclick=()=>{LOCS.splice(cur,1);cur=0;saveLocs();DATA=null;cl();load()};
  r.querySelector('#pGo').onclick=async()=>{const q=r.querySelector('#pQ').value.trim(),out=r.querySelector('#pR');if(!q)return;
    const m=q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);let p=null;
    if(m)p={n:q,lat:+m[1],lon:+m[2]};
    else{const k=keys().wapi;if(!k){out.textContent='Add the WeatherAPI.com key under Sources first, or type coordinates.';return}
      try{const j=await jget(`https://api.weatherapi.com/v1/search.json?key=${encodeURIComponent(k)}&q=${encodeURIComponent(q)}`);if(!j.length){out.textContent='No match.';return}p={n:j[0].name+', '+(j[0].region||j[0].country),lat:j[0].lat,lon:j[0].lon}}catch(e){out.textContent='Search failed ('+((e&&e.message)||'error')+').';return}}
    if(Math.abs(p.lat)>90||Math.abs(p.lon)>180){out.textContent='Those coordinates look wrong.';return}
    LOCS.push(p);cur=LOCS.length-1;saveLocs();DATA=null;cl();load()}}
function saveLocs(){try{db.doc('config/weather').set({locs:LOCS,by:curUser,at:new Date().toISOString()})}catch(e){}}

try{db.doc('config/weather').onSnapshot(x=>{const d=(x.data&&x.data())||{};if(Array.isArray(d.locs)&&d.locs.length){LOCS=d.locs;if(cur>=LOCS.length)cur=0;if(AME.cur==='wx'&&!busy)render()}},()=>{})}catch(e){}

window.ameWeather={load,combine};
AME.register({id:'wx',name:'Weather',desc:'NWS + WeatherAPI + The Weather Channel · averaged forecast · rain & wind flags',devOnly:true,allow:()=>typeof isDev==='function'&&isDev(curUser),tabs:['wx'],section:'tab-wx',icon:IC,
  open:()=>{showTab('wx');render();if(!DATA)load()},onShow:()=>{render();if(!DATA)load()}});
})();
