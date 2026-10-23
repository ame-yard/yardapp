/* Weather — NWS + MET Norway (both keyless) + WeatherAPI.com (free key) + The Weather Channel (paid, optional), averaged into "the AME forecast".
   WeatherAPI / TWC keys live ONLY in this browser's localStorage (never in the repo, never in SharePoint).
   Saved places: config/weather = {locs:[{n,lat,lon}]}. Job-site locations: config/wxsites = {map:{<siteId>:{lat,lon,place,auto}}} (found by name via OpenStreetMap Nominatim). */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1M12.2 3.8l-1 1"/><path d="M7 20h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.2 13 3.5 3.5 0 0 0 7 20z"/></svg>';
const SRC=[['nws','National Weather Service'],['met','MET Norway'],['wapi','WeatherAPI.com'],['twc','The Weather Channel']];
const ABB={nws:'NWS',met:'MET',wapi:'WAPI',twc:'TWC'},FREE={nws:1,met:1};
const DEF=[{n:'Upland, CA (office)',lat:34.0975,lon:-117.6484}];
const TTL=10*60e3;
let LOCS=DEF.slice(),cur=0,DATA=null,busy=false,CACHE={},mode='places',DET=null,SITES=[],SMAP={},OV={},ovBusy=false,locBusy='';

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
async function getNWS(l,lite){
  const p=(await jget(`https://api.weather.gov/points/${l.lat.toFixed(4)},${l.lon.toFixed(4)}`,{headers:{Accept:'application/geo+json'}})).properties;
  const f=await jget(p.forecast,{headers:{Accept:'application/geo+json'}});
  const days={};
  (f.properties.periods||[]).forEach(x=>{const k=String(x.startTime).slice(0,10);const d=days[k]=days[k]||{};const t=x.temperatureUnit==='C'?x.temperature*9/5+32:x.temperature;
    if(x.isDaytime){d.hi=t;d.txt=x.shortForecast}else{d.lo=d.lo==null?t:Math.min(d.lo,t);if(!d.txt)d.txt=x.shortForecast}
    const pp=x.probabilityOfPrecipitation&&x.probabilityOfPrecipitation.value;if(pp!=null)d.pop=Math.max(d.pop||0,pp);
    const w=maxWind(x.windSpeed);if(w!=null)d.wind=Math.max(d.wind||0,w)});
  const out={cur:null,days,alerts:[]};
  if(lite)return out;
  try{const st=await jget(p.observationStations,{headers:{Accept:'application/geo+json'}});
    for(const s of (st.features||[]).slice(0,3)){try{const o=(await jget(`https://api.weather.gov/stations/${s.properties.stationIdentifier}/observations/latest`,{headers:{Accept:'application/geo+json'}})).properties;
      if(o.temperature&&o.temperature.value!=null){out.cur={t:o.temperature.value*9/5+32,wind:o.windSpeed&&o.windSpeed.value!=null?o.windSpeed.value*0.621371:null,txt:o.textDescription||''};break}}catch(e){}}}catch(e){}
  try{const a=await jget(`https://api.weather.gov/alerts/active?point=${l.lat.toFixed(4)},${l.lon.toFixed(4)}`,{headers:{Accept:'application/geo+json'}});
    out.alerts=(a.features||[]).map(x=>({ev:x.properties.event,sev:x.properties.severity,head:x.properties.headline})).slice(0,4)}catch(e){}
  return out}
async function getMET(l){
  const j=await jget(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${l.lat.toFixed(4)}&lon=${l.lon.toFixed(4)}`);
  const ts=j.properties.timeseries||[],days={};let c=null;
  ts.forEach((x,i)=>{const d=new Date(x.time);const k=dkey(d);const o=days[k]=days[k]||{ts:[],ws:[],amt:0};const det=x.data.instant.details;
    if(det.air_temperature!=null)o.ts.push(det.air_temperature*9/5+32);if(det.wind_speed!=null)o.ws.push(det.wind_speed*2.23694);
    const n1=x.data.next_1_hours,n6=x.data.next_6_hours;const a=n1?n1.details.precipitation_amount:(n6?n6.details.precipitation_amount:0);o.amt+=(a||0)/25.4;
    if(i===0)c={t:det.air_temperature*9/5+32,wind:det.wind_speed!=null?det.wind_speed*2.23694:null,txt:''}});
  const out={};Object.keys(days).forEach(k=>{const o=days[k];if(o.ts.length<4)return;out[k]={hi:Math.max(...o.ts),lo:Math.min(...o.ts),pop:null,amt:o.amt,wind:o.ws.length?Math.max(...o.ws):null,txt:''}});
  return {cur:c,days:out,alerts:[]}}
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
const FN={nws:(l,k,lite)=>getNWS(l,lite),met:l=>getMET(l),wapi:(l,k)=>getWAPI(l,k),twc:(l,k)=>getTWC(l,k)};

const ALLL=()=>[...LOCS,...actSites().map(x=>{const l=siteLoc(x);return l&&{...l,site:x._id,sh:(x.no?x.no+' ':'')+String(x.name).split(/\s+/).slice(0,3).join(' ')}}).filter(Boolean)];
const curLoc=()=>DET||ALLL()[cur]||LOCS[0];
async function fetchLoc(l,lite){const K=keys();const res={};
  await Promise.all(SRC.map(async([id])=>{
    if(!FREE[id]&&!K[id]){res[id]={st:'nokey'};return}
    try{res[id]={st:'ok',d:await FN[id](l,K[id],lite)}}catch(e){res[id]={st:'err',msg:(e&&e.name==='AbortError')?'timed out':(e&&e.message)||'failed',status:e&&e.status}}}));
  return res}
async function load(force){
  const l=curLoc();if(!l)return;const ck=l.lat+','+l.lon;
  if(!force&&CACHE[ck]&&!CACHE[ck].lite&&Date.now()-CACHE[ck].at<TTL){DATA=CACHE[ck];render();return}
  busy=true;render();
  const res=await fetchLoc(l,false);
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
if(!document.getElementById('wxCss'))document.head.insertAdjacentHTML('beforeend','<style id="wxCss">#tab-wx .wxbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}#tab-wx .wxbar select{flex:1 1 200px;min-width:0}#tab-wx .wxchips{flex:1 1 0;min-width:0;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;scroll-snap-type:x proximity;padding:2px 0}#tab-wx .wxchips::-webkit-scrollbar{display:none}#tab-wx .wxchips button{flex:none;scroll-snap-align:center;white-space:nowrap;padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--chip);color:var(--ink);font:inherit;font-size:13px;font-weight:600;cursor:pointer}#tab-wx .wxchips button.st{border-style:dashed}#tab-wx .wxchips button.on{background:var(--accent,#f47b20);border-color:var(--accent,#f47b20);color:#fff}#tab-wx #wxPrev,#tab-wx #wxNext{flex:none;width:40px;padding:0;font-size:20px}#tab-wx .wxhero{display:flex;align-items:center;gap:18px;padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--panel);margin:12px 0}#tab-wx .wxbig{font-family:var(--display);font-size:64px;line-height:1;font-weight:800}#tab-wx .wxbig small{font-size:26px;opacity:.7}#tab-wx .wxsub{color:var(--muted);font-size:14px;margin-top:4px}#tab-wx .wxsrc{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}#tab-wx .wxchip{font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--chip);color:var(--muted)}#tab-wx .wxchip.ok{color:#2ea043;border-color:#2ea043}#tab-wx .wxchip.err{color:#e2513a;border-color:#e2513a}#tab-wx .wxdays{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}#tab-wx .wxd{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:12px 14px;min-width:0}#tab-wx .wxd h4{margin:0 0 6px;font-size:15px}#tab-wx .wxd .t{font-size:26px;font-weight:800;font-family:var(--display)}#tab-wx .wxd .t span{opacity:.55;font-size:20px}#tab-wx .wxd .m{color:var(--muted);font-size:13px;margin-top:2px}#tab-wx .wxd table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}#tab-wx .wxd td{padding:3px 0;border-top:1px solid var(--line);white-space:nowrap}#tab-wx .wxd td:first-child{color:var(--muted)}#tab-wx .wxd td:not(:first-child){text-align:right}#tab-wx .wxfl{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}#tab-wx .wxfl i{font-style:normal;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#e2513a22;color:#e2513a}#tab-wx .wxfl i.wind{background:#e8a33c22;color:#e8a33c}#tab-wx .wxfl i.heat{background:#e2513a22}#tab-wx .wxfl i.cold{background:#2f81f722;color:#2f81f7}#tab-wx .wxdis{font-size:11px;color:#e8a33c;font-weight:700;margin-top:4px}#tab-wx .wxal{border:1px solid #e2513a;background:#e2513a18;border-radius:12px;padding:10px 12px;margin:8px 0;font-size:14px}#tab-wx .wxal b{color:#e2513a}@media(max-width:700px){#tab-wx .wxbar select{flex:1 1 100%}#tab-wx .wxbig{font-size:52px}#tab-wx .wxhero{padding:14px;gap:12px}#tab-wx .wxdays{grid-template-columns:1fr 1fr}}</style>');

const F=x=>x==null?'–':Math.round(x)+'°';
function render(){
  if(!(typeof isDev==='function'&&isDev(curUser))){S.innerHTML='';return}
  if(mode==='sites'&&!DET)return renderSites();
  renderPlace()}
const segH=()=>`<div class="viewseg" style="margin:6px 0 4px"><button data-wm="places" aria-pressed="${mode==='places'}">Places</button><button data-wm="sites" aria-pressed="${mode==='sites'}">Job sites</button></div>`;
function renderPlace(){
  const l=curLoc()||LOCS[0];
  let h=`<div class="mplhead"><h2>Weather</h2></div>${DET?`<div class="wxbar"><button class="btn" id="wxBack">‹ Job sites</button><b>${E(DET.n)}</b><button class="btn" id="wxRef">${busy?'Loading…':'Refresh'}</button></div>`:segH()+`<div class="wxbar"><button class="btn" id="wxPrev" aria-label="Previous place">‹</button><div class="wxchips" id="wxChips">${ALLL().map((x,i)=>`<button data-li="${i}" class="${i===cur?'on':''}${x.site?' st':''}" title="${E(x.n)}">${E(x.sh||x.n)}</button>`).join('')}</div><button class="btn" id="wxNext" aria-label="Next place">›</button></div><div class="wxbar"><button class="btn" id="wxAdd">+ Place</button><button class="btn" id="wxRef">${busy?'Loading…':'Refresh'}</button><button class="btn" id="wxKeys">Sources</button></div>`}`;
  if(!DATA){S.innerHTML=h+'<p class="muted">'+(busy?'Loading forecasts…':'')+'</p>';bind();return}
  const res=DATA.res,C=combine(res);
  h+='<div class="wxsrc">'+SRC.map(([id,nm])=>{const r=res[id]||{};return `<span class="wxchip ${r.st==='ok'?'ok':r.st==='err'?'err':''}" title="${E(r.msg||'')}">${nm}: ${r.st==='ok'?'OK':r.st==='nokey'?(id==='twc'?'optional · paid':'add free key'):'error '+E(r.msg||'')}</span>`}).join('')+'</div>';
  C.alerts.forEach(a=>{h+=`<div class="wxal"><b>${E(a.ev)}</b> — ${E(a.head||'')}</div>`});
  if(!C.ok.length){S.innerHTML=h+'<p class="muted">No source answered. Check your connection and tap Refresh.</p>';bind();return}
  h+=`<div class="wxhero"><div><div class="wxbig">${F(C.cur.t)}<small>F</small></div><div class="wxsub">AME average of ${C.cur.n||0} source${C.cur.n===1?'':'s'} · wind ${C.cur.wind!=null?Math.round(C.cur.wind)+' mph':'–'}</div></div><div style="min-width:0"><div style="font-weight:700;font-size:18px">${E(C.cur.txt||'')}</div><div class="wxsub">${E(l.n)} · updated ${new Date(DATA.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</div></div></div>`;
  if(C.cur.rows.length>1)h+=`<div class="muted" style="font-size:13px;margin:-4px 0 12px">Right now: ${C.cur.rows.map(c=>ABB[c.id]+' '+F(c.t)).join(' · ')}</div>`;
  h+='<div class="wxdays">'+C.days.map(d=>{const fl=flags(d);return `<div class="wxd"><h4>${dlabel(d.dt)}</h4><div class="t">${F(d.hi)} <span>${F(d.lo)}</span></div><div class="m">Rain ${d.pop!=null?Math.round(d.pop)+'%':'–'} · Wind ${d.wind!=null?Math.round(d.wind)+' mph':'–'}</div>${fl.length?'<div class="wxfl">'+fl.map(([k,t])=>`<i class="${k}">${t}</i>`).join('')+'</div>':''}${d.dis?'<div class="wxdis">Sources disagree</div>':''}<table>${d.rows.map(r=>`<tr><td>${ABB[r.id]}</td><td>${F(r.hi)}/${F(r.lo)}</td><td>${r.pop!=null?Math.round(r.pop)+'%':r.amt!=null?(r.amt<0.01?'0 in':r.amt.toFixed(2)+' in'):'–'}</td></tr>`).join('')}</table><div class="muted" style="font-size:11px;margin-top:4px">${d.n} source${d.n===1?'':'s'}</div></div>`}).join('')+'</div>';
  h+='<p class="muted" style="font-size:12px;margin-top:14px">Flags are guidance only: rain ≥40%, wind ≥20 mph, high ≥95°, low ≤40°. MET Norway gives rain amount (inches) instead of a chance, so it is not in the rain-% average.</p>';
  S.innerHTML=h;bind()}
function bind(){
  const q=id=>S.querySelector(id);
  S.querySelectorAll('[data-wm]').forEach(b=>b.onclick=()=>{mode=b.dataset.wm;DET=null;render();if(mode==='sites')loadOverview();else if(!DATA)load()});
  q('#wxBack')&&(q('#wxBack').onclick=()=>{DET=null;DATA=null;render();loadOverview()});
  const pickL=i=>{const n=ALLL().length;if(!n)return;cur=(i+n)%n;DATA=null;load()};
  S.querySelectorAll('[data-li]').forEach(b=>b.onclick=()=>pickL(+b.dataset.li));
  q('#wxPrev')&&(q('#wxPrev').onclick=()=>pickL(cur-1));q('#wxNext')&&(q('#wxNext').onclick=()=>pickL(cur+1));
  {const on=S.querySelector('.wxchips .on');on&&on.scrollIntoView({block:'nearest',inline:'center'})}
  q('#wxRef')&&(q('#wxRef').onclick=()=>load(true));
  q('#wxAdd')&&(q('#wxAdd').onclick=addDlg);
  q('#wxKeys')&&(q('#wxKeys').onclick=keyDlg)}

function dlg(inner){const r=document.getElementById('dlgRoot');r.innerHTML=`<div class="scrim sheet"><div class="dlg" style="max-width:520px">${inner}</div></div>`;const cl=()=>{r.innerHTML=''};r.querySelector('.scrim').onclick=e=>{if(e.target.classList.contains('scrim'))cl()};return {r,cl}}
function keyDlg(){
  const K=keys();const {r,cl}=dlg(`<h3>Weather sources</h3><p class="muted" style="margin-top:0">National Weather Service and MET Norway are free and need no key. The keys below are saved only in this browser — never in the app code or SharePoint.</p>
  <label class="f">WeatherAPI.com key <small class="muted">(free plan · weatherapi.com)</small><input id="kW" type="password" autocomplete="off" value="${E(K.wapi||'')}" placeholder="paste key"></label>
  <label class="f">The Weather Channel key <small class="muted">(optional · The Weather Company API is paid — only if you buy a plan or a trial)</small><input id="kT" type="password" autocomplete="off" value="${E(K.twc||'')}" placeholder="paste key"></label>
  <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end"><button class="btn" id="kX">Cancel</button><button class="btn primary" id="kS">Save</button></div>`);
  r.querySelector('#kX').onclick=cl;
  r.querySelector('#kS').onclick=()=>{const k={wapi:r.querySelector('#kW').value.trim(),twc:r.querySelector('#kT').value.trim()};if(!k.wapi)delete k.wapi;if(!k.twc)delete k.twc;setKeys(k);CACHE={};DATA=null;cl();load(true)}}
function addDlg(){
  const {r,cl}=dlg(`<h3>Add a place</h3><p class="muted" style="margin-top:0">Type a city, ZIP or street address, or coordinates like <b>34.10, -117.65</b>.</p>
  <label class="f">Place<input id="pQ" placeholder="Rancho Cucamonga, CA  or  34.10, -117.65"></label><div id="pR" class="muted" style="margin:8px 0"></div>
  <div style="display:flex;gap:8px;margin-top:10px;justify-content:space-between"><button class="btn" id="pDel"${LOCS.length>1?'':' disabled'}>Remove current</button><span style="display:flex;gap:8px"><button class="btn" id="pX">Close</button><button class="btn primary" id="pGo">Add</button></span></div>`);
  r.querySelector('#pX').onclick=cl;
  r.querySelector('#pDel').onclick=()=>{if(cur>=LOCS.length){cl();toast('Job sites are removed from the Job sites list (pencil → Clear)');return}LOCS.splice(cur,1);cur=0;saveLocs();DATA=null;cl();load()};
  r.querySelector('#pGo').onclick=async()=>{const q=r.querySelector('#pQ').value.trim(),out=r.querySelector('#pR');if(!q)return;
    const m=q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);let p=null;
    if(m)p={n:q,lat:+m[1],lon:+m[2]};
    else{out.textContent='Looking up…';try{const g=await nom(/\b(CA|California)\b/i.test(q)||/^\d{5}$/.test(q)?q:q+', CA');if(!g){out.textContent='No match — try adding the city or ZIP.';return}p={n:q.replace(/\b\w/g,c=>c.toUpperCase())+(g.place?' ('+g.place.split(',').slice(-2).join(',').trim()+')':''),lat:g.lat,lon:g.lon}}catch(e){out.textContent='Search failed ('+((e&&e.message)||'error')+').';return}}
    if(Math.abs(p.lat)>90||Math.abs(p.lon)>180){out.textContent='Those coordinates look wrong.';return}
    LOCS.push(p);cur=LOCS.length-1;saveLocs();DATA=null;cl();load()}}
function saveLocs(){try{db.doc('config/weather').set({locs:LOCS,by:curUser,at:new Date().toISOString()})}catch(e){}}

try{db.doc('config/weather').onSnapshot(x=>{const d=(x.data&&x.data())||{};if(Array.isArray(d.locs)&&d.locs.length){LOCS=d.locs;if(cur>=ALLL().length)cur=0;if(AME.cur==='wx'&&!busy)render()}},()=>{})}catch(e){}

window.ameWeather={load,combine};
/* ---- job sites: every active site's weather at a glance ---- */
const SKEY=l=>l.lat.toFixed(2)+','+l.lon.toFixed(2);
const actSites=()=>SITES.filter(x=>/^active$/i.test(x.status||'')).sort((a,b)=>String(a.no).localeCompare(String(b.no),undefined,{numeric:true}));
const siteLoc=x=>{const m=SMAP[x._id];return m&&m.lat!=null?{n:(x.no?x.no+' · ':'')+x.name,lat:m.lat,lon:m.lon,place:m.place,auto:m.auto}:null};
const saveMap=()=>{try{return db.doc('config/wxsites').set({map:SMAP,by:curUser,at:new Date().toISOString()})}catch(e){}};
async function nom(q){
  const j=await jget('https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=us&viewbox=-119.6,35.3,-115.2,32.4&q='+encodeURIComponent(q));
  if(!j.length)return null;const a=j[0].address||{};
  return {lat:+j[0].lat,lon:+j[0].lon,place:[a.road||a.neighbourhood||a.suburb||'',a.city||a.town||a.village||a.county||'',a.state_code||a.state||''].filter(Boolean).join(', ')||j[0].display_name.split(',').slice(0,3).join(',')}}
async function locateAll(){
  const todo=actSites().filter(x=>!SMAP[x._id]);if(!todo.length||locBusy)return;
  for(let i=0;i<todo.length;i++){locBusy=`Finding ${i+1} of ${todo.length}…`;render();
    try{const r=await nom(todo[i].name+', California');SMAP[todo[i]._id]=r?{...r,auto:true}:{miss:true}}catch(e){break}
    await new Promise(r=>setTimeout(r,1100))}
  locBusy='';await saveMap();render();loadOverview()}
async function loadOverview(force){
  if(ovBusy)return;const L=actSites().map(siteLoc).filter(Boolean);const uniq={};L.forEach(l=>uniq[SKEY(l)]=l);
  const need=Object.values(uniq).filter(l=>force||!OV[SKEY(l)]||Date.now()-OV[SKEY(l)].at>TTL);if(!need.length){render();return}
  ovBusy=true;render();let i=0;
  const worker=async()=>{while(i<need.length){const l=need[i++];const res=await fetchLoc(l,true);OV[SKEY(l)]={at:Date.now(),res};if(AME.cur==='wx'&&mode==='sites'&&!DET)render()}};
  await Promise.all([worker(),worker(),worker()]);ovBusy=false;if(AME.cur==='wx'&&mode==='sites'&&!DET)render()}
function renderSites(){
  const A=actSites(),found=A.filter(siteLoc).length,miss=A.filter(x=>!SMAP[x._id]).length;
  let h=`<div class="mplhead"><h2>Weather</h2></div>${segH()}<div class="wxbar"><span class="muted" style="flex:1 1 auto">${A.length} active sites · ${found} located${miss?` · ${miss} to find`:''}</span>${miss?`<button class="btn" id="wxLoc2"${locBusy?' disabled':''}>${locBusy||'Find locations ('+miss+')'}</button>`:''}<button class="btn" id="wxRef2">${ovBusy?'Loading…':'Refresh'}</button></div>`;
  if(!A.length){S.innerHTML=h+'<p class="muted">No active job sites in Dispatch yet.</p>';bind();return}
  if(miss)h+='<p class="muted" style="font-size:12px;margin:0 0 8px">Sites have no street address in the app, so “Find locations” looks each site up by its name on OpenStreetMap (site names are sent to nominatim.openstreetmap.org). Check each guess and fix it with the pencil.</p>';
  const rows=A.map(x=>{const l=siteLoc(x);let C=null,st='';
    if(l){const o=OV[SKEY(l)];if(o){C=combine(o.res);if(!C.ok.length)st='no data'}else st='…'}
    const d=C&&C.days[0];return {x,l,C,d,st,fl:d?flags(d):[],al:C?C.alerts.length:0}});
  const rank=r=>r.al?0:r.fl.length?1:2;rows.sort((a,b)=>rank(a)-rank(b)||String(a.x.no).localeCompare(String(b.x.no),undefined,{numeric:true}));
  h+='<div class="wxsl"><div class="wxsh"><span>Job site</span><span>Today</span><span>Rain</span><span>Wind</span><span></span></div>'+rows.map(({x,l,d,st,fl,al})=>{
    const nm=`<b class="wxsn">${E(x.no||'')}</b><span class="wxsm"><span class="wxst">${E((x.no?x.no+" · ":"")+x.name)}</span><small class="muted">${l?E(l.place||'')+(l.auto?' <em class="wxchk">check</em>':''):(SMAP[x._id]&&SMAP[x._id].miss?'not found':'no location')}</small>${fl.length||al?'<span class="wxfl">'+(al?'<i>Alert</i>':'')+fl.map(([k,t])=>`<i class="${k}">${t}</i>`).join('')+'</span>':''}</span>`;
    return `<div class="wxsr${l?' wxgo':''}" data-site="${E(x._id)}">${nm}<span>${d?F(d.hi)+' <small class="muted">'+F(d.lo)+'</small>':st||'–'}</span><span>${d&&d.pop!=null?Math.round(d.pop)+'%':'–'}</span><span>${d&&d.wind!=null?Math.round(d.wind):'–'}<small class="muted"> mph</small></span><button class="btn wxed" data-ed="${E(x._id)}" title="Set location" aria-label="Set location"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button></div>`}).join('')+'</div>';
  h+='<p class="muted" style="font-size:12px;margin-top:12px">Averages today across NWS, MET Norway and any keyed source. Alerts first, then flagged sites. Tap a site for the 5-day view.</p>';
  S.innerHTML=h;bind();
  S.querySelector('#wxLoc2')&&(S.querySelector('#wxLoc2').onclick=locateAll);
  S.querySelector('#wxRef2')&&(S.querySelector('#wxRef2').onclick=()=>loadOverview(true));
  S.querySelectorAll('[data-ed]').forEach(b=>b.onclick=e=>{e.stopPropagation();siteDlg(b.dataset.ed)});
  S.querySelectorAll('.wxsr.wxgo').forEach(r=>r.onclick=()=>{const x=SITES.find(s=>s._id===r.dataset.site);const l=x&&siteLoc(x);if(l){DET=l;DATA=null;render();load()}})}
function siteDlg(id){
  const x=SITES.find(s=>s._id===id);if(!x)return;const m=SMAP[id]||{};
  const {r,cl}=dlg(`<h3>${E((x.no?x.no+' · ':'')+x.name)}</h3><p class="muted" style="margin-top:0">${m.lat!=null?'Now: '+E(m.place||'')+' ('+m.lat.toFixed(3)+', '+m.lon.toFixed(3)+')':'No location yet.'} Type the job’s street address (or coordinates) to set it.</p>
  <label class="f">Address<input id="sA" placeholder="e.g. 10500 Civic Center Dr, Rancho Cucamonga, CA"></label><div id="sR" class="muted" style="margin:8px 0;min-height:20px"></div>
  <div style="display:flex;gap:8px;margin-top:10px;justify-content:space-between"><button class="btn" id="sClr"${SMAP[id]?'':' disabled'}>Clear</button><span style="display:flex;gap:8px"><button class="btn" id="sX">Close</button><button class="btn primary" id="sGo">Find & use</button></span></div>`);
  r.querySelector('#sX').onclick=cl;
  r.querySelector('#sClr').onclick=async()=>{delete SMAP[id];await saveMap();cl();render()};
  r.querySelector('#sGo').onclick=async()=>{const q=r.querySelector('#sA').value.trim(),out=r.querySelector('#sR');if(!q)return;out.textContent='Looking up…';
    try{let p;const c=q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
      if(c)p={lat:+c[1],lon:+c[2],place:q};else p=await nom(q);
      if(!p){out.textContent='Not found — try adding the city.';return}
      SMAP[id]={lat:p.lat,lon:p.lon,place:p.place};await saveMap();cl();render();loadOverview()}catch(e){out.textContent='Lookup failed ('+((e&&e.message)||'error')+').'}}}
try{db.collection('dsites').onSnapshot(s=>{SITES=s.docs.map(d=>({...d.data(),_id:d.id}));if(AME.cur==='wx'&&mode==='sites'&&!DET&&!ovBusy)render()},()=>{})}catch(e){}
try{db.doc('config/wxsites').onSnapshot(x=>{const d=(x.data&&x.data())||{};SMAP=d.map||{};if(AME.cur==='wx'&&!DET&&!locBusy&&!busy)render()},()=>{})}catch(e){}
document.head.insertAdjacentHTML('beforeend','<style>#tab-wx .wxsl{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--panel)}#tab-wx .wxsh,#tab-wx .wxsr{display:grid;grid-template-columns:minmax(0,1fr) 78px 44px 62px 36px;gap:6px;align-items:center;padding:10px 12px}#tab-wx .wxsh{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-bottom:1px solid var(--line)}#tab-wx .wxsh span:first-child{grid-column:1}#tab-wx .wxsr{border-bottom:1px solid var(--line);font-size:14px}#tab-wx .wxsr:last-child{border-bottom:0}#tab-wx .wxsr.wxgo{cursor:pointer}#tab-wx .wxsr.wxgo:hover{background:var(--chip)}#tab-wx .wxsr>b.wxsn{display:none}#tab-wx .wxsm{display:flex;flex-direction:column;min-width:0}#tab-wx .wxst{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}#tab-wx .wxsm small{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tab-wx .wxchk{font-style:normal;font-size:10px;font-weight:700;color:#e8a33c;border:1px solid #e8a33c;border-radius:6px;padding:0 4px;margin-left:4px}#tab-wx .wxed{padding:0;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center}@media(max-width:700px){#tab-wx .wxsh,#tab-wx .wxsr{grid-template-columns:minmax(0,1fr) 64px 36px 52px 32px;gap:4px;padding:10px}#tab-wx .wxst{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.25}}#tab-wx .wxsm small{display:flex;align-items:center;gap:4px}#tab-wx .wxsm small .wxchk{flex:none;margin-left:0}</style>');

AME.register({id:'wx',name:'Weather',desc:'NWS + WeatherAPI + The Weather Channel · averaged forecast · rain & wind flags',devOnly:true,allow:()=>typeof isDev==='function'&&isDev(curUser),tabs:['wx'],section:'tab-wx',icon:IC,
  open:()=>{showTab('wx');render();if(!DATA)load()},onShow:()=>{render();if(!DATA)load()}});
})();
