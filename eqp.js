/* AME — Equipment Price Tracker (rental quotes by vendor) */
(function(){
let histOpen=new Set(),Q=[],VEN={},view='cmp',cat='',days=7,qf='',editId='';
const el=()=>document.getElementById('tab-eqp');
const money=v=>v==null||v===''?'—':(typeof v==='number'?'$'+v.toLocaleString('en-US',{maximumFractionDigits:2}):esc(String(v)));
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const fixType=s=>clean(s).replace(/^Telehander$/i,'Telehandler').replace(/Deisel/gi,'Diesel');
const num=v=>{if(v==null||v==='')return null;const n=Number(String(v).replace(/[$,]/g,''));return isFinite(n)?n:null};
const canEdit=()=>isAdmin||can('EQP');
function spec(q){return [q.lbs?q.lbs+'K lbs':'',q.size?q.size+"'":'',q.kw?q.kw+' kW':'',q.option||''].filter(Boolean).join(' · ')}
function key(q){return [q.cat,q.lbs||'',q.size||'',q.kw||'',(q.option||'').toLowerCase()].join('|')}
function load(){db.collection('eqp').onSnapshot(s=>{Q=s.docs.map(d=>({...d.data(),_id:d.id}));if(isOn())render()},()=>{});
  db.doc('config/eqvendors').onSnapshot(s=>{VEN=s.data()||{};if(isOn())render()},()=>{});
  db.collection('eqinbox').onSnapshot(s=>{INBOX=s.docs.map(d=>({...d.data(),_id:d.id}));if(isOn()&&!arranging)render()},()=>{});
  db.doc('config/eqorder').onSnapshot(s=>{ORD=(s.data()||{}).order||[];if(isOn()&&!arranging)render()},()=>{})}
let ORD=[],arranging=false;
const isOn=()=>el()&&!el().hidden;

/* best cost for N days from day / week / 4-week rates */
function bestCost(q,D){const d=num(q.day),w=num(q.week),m=num(q.m4),mo=num(q.month);if(mo!=null&&d==null&&w==null&&m==null)return {cost:Math.ceil(D/30)*mo,how:Math.ceil(D/30)+' mo'};
  let best=null,how='';for(let k=0;k<=Math.ceil(D/28);k++){if(k&&m==null)break;const r1=D-28*k;for(let j=0;j<=Math.max(0,Math.ceil(r1/7));j++){if(j&&w==null)break;const r2=Math.max(0,r1-7*j);if(r2&&d==null)continue;
    const c=(k?k*m:0)+(j?j*w:0)+(r2?r2*d:0);if(best==null||c<best){best=c;how=[k?k+'×4wk':'',j?j+'×wk':'',r2?r2+'×day':''].filter(Boolean).join(' + ')}}}
  return best==null?null:{cost:best,how}}
function delivFor(q){const v=VEN[q.vendor]||{};const dl=num(q.deliv)??num(v.deliv)??0,pk=num(q.pick)??num(v.pick)??0;return dl+pk}

/* ---------- views ---------- */
function render(){const box=el();if(!box)return;
  box.innerHTML=`<div class="mplhead"><h2>Equipment Prices</h2>${canEdit()?'<span class="mtop"><button class="btn" id="eqUp">Upload quote / invoice</button><button class="btn pri" id="eqAdd">+ Add quote</button></span>':''}</div>
   <div class="viewseg eqseg"><button data-ev="cmp" aria-pressed="${view==='cmp'}">Compare</button><button data-ev="list" aria-pressed="${view==='list'}">All quotes</button><button data-ev="ven" aria-pressed="${view==='ven'}">Vendors</button></div>
   <div id="eqBody"></div>`;
  box.querySelectorAll('[data-ev]').forEach(b=>b.onclick=()=>{if(b.dataset.ev==='cmp')cat='';arranging=false;view=b.dataset.ev;render()});
  const a=document.getElementById('eqAdd');if(a)a.onclick=()=>openQuote('');const up=document.getElementById('eqUp');if(up)up.onclick=pickDoc;
  if(!Q.length){document.getElementById('eqBody').innerHTML=`<div class="panel"><p>No prices yet.</p>${canEdit()?'<p><button class="btn pri" id="eqImp">Import from Excel</button> <span class="muted">— pick your “Equipment Price Tracking” workbook</span></p>':''}</div>`;wireImp();return}
  if(INBOX.length&&canEdit()){document.getElementById('eqBody').insertAdjacentHTML('beforebegin',`<div class="panel eqinbox"><b>${INBOX.length} document(s) couldn't be read fully</b> <span class="muted">— tap to finish</span><div class="chips">${INBOX.map(x=>`<span class="chip ibchip"><button class="ibopen" data-ib="${x._id}">${esc(x.doc?.name||'file')}</button><button class="ibx" data-ibx="${x._id}" title="Cancel this one" aria-label="Cancel">×</button></span>`).join('')}</div><button class="btn small" id="ibAll">Cancel all</button></div>`);
    box.querySelectorAll('[data-ibx]').forEach(b=>b.onclick=()=>db.doc('eqinbox/'+b.dataset.ibx).delete().then(()=>toast('Removed')).catch(e=>toast(e.message)));
    document.getElementById('ibAll').onclick=()=>{if(confirm('Cancel all '+INBOX.length+' unread document(s)? No prices will be saved from them.'))db.deleteMany('eqinbox',INBOX.map(x=>x._id)).then(()=>toast('Cleared')).catch(e=>toast(e.message))};
    box.querySelectorAll('[data-ib]').forEach(b=>b.onclick=()=>{const x=INBOX.find(y=>y._id===b.dataset.ib);const P=x.P;P._inbox=x._id;if(!P.items||!P.items.length)P.items=[{cat:'',size:null,lbs:null,day:null,week:null,m4:null}];reviewDoc(P,x.doc)})}
  if(view==='cmp')renderCmp();else if(view==='list')renderList();else renderVen()}
function cats(){const m={};Q.forEach(q=>m[q.cat]=(m[q.cat]||0)+1);const ix=c=>{const i=ORD.indexOf(c);return i<0?1e4:i};return Object.keys(m).sort((a,b)=>ix(a)-ix(b)||a.localeCompare(b)).map(c=>[c,m[c]])}
document.head.insertAdjacentHTML('beforeend',`<style>.eqgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.eqtile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 10px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.05);color:inherit;font:inherit;text-align:center;cursor:pointer}.eqtbl th.n,.eqtbl td.n{text-align:center!important}.eqtbl th+th,.eqtbl td+td{border-left:1px solid rgba(255,255,255,.12)}.eqtbl td{vertical-align:middle}.dlg.eqsplit{display:grid;grid-template-columns:1fr 1fr;gap:16px;width:min(1280px,97vw);max-width:none;height:92vh;max-height:92vh;padding:12px}.eqprev{overflow:auto;background:#fff;border-radius:10px;padding:6px}.eqprev canvas,.eqprev img{width:100%;height:auto;display:block;margin-bottom:6px;box-shadow:0 1px 4px rgba(0,0,0,.25)}.eqform{overflow:auto;padding-right:4px}@media(max-width:760px){.dlg.eqsplit{grid-template-columns:1fr;grid-template-rows:42vh 1fr;height:94vh}}.ibchip{display:inline-flex;align-items:center;gap:2px;padding:0!important}.ibchip button{background:none;border:0;color:inherit;font:inherit;padding:6px 10px;cursor:pointer}.ibchip .ibx{font-size:18px;line-height:1;padding:4px 10px;opacity:.75;border-left:1px solid rgba(255,255,255,.15)}.eqinbox .chips{margin:8px 0}.eqtile:active{transform:scale(.97)}.eqtile{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}.eqgrid.arr .eqtile{cursor:grabbing;border-style:dashed;animation:eqw .3s infinite alternate}.eqgrid.arr .eqtile.drag{opacity:.6;transform:scale(1.05);animation:none;border-color:var(--accent,#c8742c)}@keyframes eqw{from{transform:rotate(-.6deg)}to{transform:rotate(.6deg)}}.eqtile b{font-size:15px}.eqtile small{color:rgba(243,237,230,.65);font-size:12px}.eqic{display:inline-flex;width:64px;height:64px;color:var(--accent,#c8742c)}.eqic svg{width:100%;height:100%}.eqic.sm{width:32px;height:32px}.eqic.xs{width:18px;height:18px;margin-right:4px;vertical-align:-4px}.eqsel{display:flex;align-items:center;gap:12px;margin:4px 0 10px}.eqcur{display:flex;align-items:center;gap:8px;font-size:17px}@media(max-width:420px){.eqgrid{grid-template-columns:1fr 1fr;gap:10px}.eqic{width:52px;height:52px}}</style>`);
const EQI=(()=>{const w=b=>'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+b+'</svg>';const wh='<circle cx="14" cy="40" r="4"/><circle cx="34" cy="40" r="4"/>';return{
 tele:w(wh+'<path d="M6 36V28h20l4 8M26 28l-2-8h-6v8"/><path d="M24 22L42 8l2 3-16 13"/><path d="M42 8v6h4"/>'),
 boomA:w(wh+'<path d="M8 36v-6h32v6"/><path d="M20 30l6-12 10 4"/><path d="M36 22l-2-14"/><rect x="30" y="4" width="10" height="5"/>'),
 boomS:w(wh+'<path d="M8 36v-6h32v6"/><path d="M18 30L38 8"/><rect x="34" y="3" width="10" height="5"/>'),
 scis:w(wh+'<path d="M8 36v-4h32v4"/><path d="M12 32l24-8M12 24l24 8M12 24l24-8M12 16l24 8"/><rect x="9" y="10" width="30" height="6"/><path d="M9 10V5h30v5"/>'),
 fork:w(wh+'<path d="M8 36V22h16l4 14"/><path d="M12 22v-8h10l2 8"/><path d="M34 6v30M34 36h10M38 6v26"/>'),
 gen:w('<rect x="6" y="14" width="36" height="22" rx="2"/><path d="M22 20l-4 8h8l-4 8"/><path d="M10 36v4M38 36v4M30 20h8"/>'),
 air:w('<rect x="4" y="18" width="30" height="16" rx="3"/><circle cx="12" cy="40" r="4"/><circle cx="28" cy="40" r="4"/><path d="M34 26h8l2 14M10 24h12M10 28h12"/>'),
 light:w('<path d="M24 14v20M14 40l10-6 10 6"/><rect x="14" y="4" width="20" height="10" rx="1"/><path d="M19 4v10M24 4v10M29 4v10"/>'),
 toilet:w('<rect x="12" y="4" width="24" height="40" rx="2"/><path d="M12 10h24M18 24v6"/><circle cx="24" cy="7" r="1"/>'),
 wash:w('<rect x="10" y="14" width="28" height="30" rx="2"/><path d="M16 14V8h8v6M24 8h6v4"/><path d="M18 24c0 3 12 3 12 0"/>'),
 fence:w('<path d="M6 8v34M24 8v34M42 8v34M6 14h36M6 36h36"/><path d="M6 14l18 22M24 14L6 36M24 14l18 22M42 14L24 36"/>'),
 dump:w('<path d="M4 18h40l-4 20H8z"/><path d="M8 38v3M40 38v3M10 24h28M12 30h24"/>'),
 box:w('<rect x="4" y="12" width="40" height="26"/><path d="M12 12v26M20 12v26M28 12v26M36 12v26"/>'),
 misc:w('<path d="M28 8a8 8 0 0 0-10 10L6 30l6 6 12-12a8 8 0 0 0 10-10l-5 5-4-1-1-4z"/>')}})();
function eqIcon(c){c=String(c).toLowerCase();return EQI[/tele|reach/.test(c)?'tele':/st boom|straight|telescop/.test(c)?'boomS':/boom/.test(c)?'boomA':/scissor/.test(c)?'scis':/fork/.test(c)?'fork':/generat/.test(c)?'gen':/compress/.test(c)?'air':/light/.test(c)?'light':/toilet|restroom/.test(c)?'toilet':/wash|sink/.test(c)?'wash':/fence/.test(c)?'fence':/dumpster|bin/.test(c)?'dump':/container|storage/.test(c)?'box':'misc']}
function renderPick(cs){document.getElementById('eqBody').innerHTML=`<div class="eqsel"><p class="muted" style="margin:0;flex:1">Pick equipment to see prices${canEdit()?' · press &amp; hold a tile to move it':''}</p></div><div class="eqgrid">${cs.map(([c,n])=>{const qs=Q.filter(q=>q.cat===c);const d=qs.map(q=>num(q.day)).filter(x=>x!=null);const mo=qs.map(q=>num(q.month)).filter(x=>x!=null);const from=d.length?'from $'+Math.min(...d).toLocaleString('en-US')+'/day':mo.length?'from $'+Math.min(...mo).toLocaleString('en-US')+'/mo':'';return `<button class="eqtile" data-ec="${esc(c)}"><span class="eqic">${eqIcon(c)}</span><b>${esc(c)}</b><small>${n} price${n>1?'s':''}${from?' · '+from:''}</small></button>`}).join('')}</div>`;
  const g=document.querySelector('.eqgrid');document.querySelectorAll('.eqtile').forEach(b=>b.onclick=()=>{if(g._sup){g._sup=false;return}cat=b.dataset.ec;renderCmp();scrollTo({top:0})});if(canEdit())dragWire(g)}
function dragWire(g){let d=null,tm=null,sx=0,sy=0;
  const start=(t,x,y)=>{sx=x;sy=y;clearTimeout(tm);tm=setTimeout(()=>{d=t;t.classList.add('drag');g.classList.add('arr');try{navigator.vibrate&&navigator.vibrate(25)}catch(e){}},350)};
  const move=(x,y,ev)=>{if(!d){if(Math.abs(x-sx)+Math.abs(y-sy)>8)clearTimeout(tm);return}ev.preventDefault();
    const o=document.elementFromPoint(x,y)?.closest('.eqtile');if(o&&o!==d&&g.contains(o)){const r=o.getBoundingClientRect();const after=x>r.left+r.width/2||y>r.bottom-8;g.insertBefore(d,after?o.nextSibling:o)}
    if(y<70)scrollBy(0,-14);else if(y>innerHeight-70)scrollBy(0,14)};
  const end=()=>{clearTimeout(tm);if(!d)return;d.classList.remove('drag');g.classList.remove('arr');d=null;g._sup=true;setTimeout(()=>g._sup=false,400);
    const o=[...g.querySelectorAll('.eqtile')].map(t=>t.dataset.ec);if(JSON.stringify(o)===JSON.stringify(ORD))return;ORD=o;db.doc('config/eqorder').set({order:o,by:curUser,at:new Date().toISOString()}).then(()=>toast('Order saved')).catch(e=>toast('Could not save: '+e.message))};
  g.querySelectorAll('.eqtile').forEach(t=>{t.addEventListener('touchstart',e=>start(t,e.touches[0].clientX,e.touches[0].clientY),{passive:true});t.addEventListener('mousedown',e=>start(t,e.clientX,e.clientY));t.oncontextmenu=e=>e.preventDefault()});
  g.addEventListener('touchmove',e=>move(e.touches[0].clientX,e.touches[0].clientY,e),{passive:false});g.addEventListener('touchend',end);g.addEventListener('touchcancel',end);
  g.onmousemove=e=>move(e.clientX,e.clientY,e);g.onmouseup=end;g.onmouseleave=end}
function renderCmp(){const cs=cats();if(!cat||!cs.some(c=>c[0]===cat)){cat='';return renderPick(cs)}
  const qs=Q.filter(q=>q.cat===cat);const groups={};qs.forEach(q=>(groups[key(q)]=groups[key(q)]||[]).push(q));
  const keys=Object.keys(groups).sort((a,b)=>{const qa=groups[a][0],qb=groups[b][0];return (num(qa.lbs)||0)-(num(qb.lbs)||0)||(num(qa.size)||0)-(num(qb.size)||0)||(num(qa.kw)||0)-(num(qb.kw)||0)||String(qa.option||'').localeCompare(qb.option||'')});
  document.getElementById('eqBody').innerHTML=`<div class="eqsel"><button class="btn" id="eqBack">‹ All equipment</button><span class="eqcur"><span class="eqic sm">${eqIcon(cat)}</span><b>${esc(cat)}</b></span></div><p class="muted" style="margin:0 0 10px">Cheapest 7-day total incl. delivery &amp; pickup is highlighted</p>
   ${keys.map(k=>{const g=groups[k];const q0=g[0];const latest={};g.forEach(q=>{const p=latest[q.vendor];if(!p||String(q.date||'')>String(p.date||''))latest[q.vendor]=q});const vs=Object.values(latest);
     const tot=vs.map(q=>{const b=bestCost(q,days);return b?b.cost+delivFor(q):null});const minT=Math.min(...tot.filter(x=>x!=null));
     const col=f=>{const v=vs.map(q=>num(q[f])).filter(x=>x!=null);return v.length?Math.min(...v):null};const mn={day:col('day'),week:col('week'),m4:col('m4'),month:col('month')};const hasMo=vs.some(q=>q.month!=null&&q.month!=='');
     return `<div class="panel eqcard"><div class="eqtitle"><b>${esc(q0.cat)}</b> <span>${esc(spec(q0))}</span>${q0.fuel?`<small class="muted">${esc(q0.fuel)}</small>`:''}</div>
      <div class="tblwrap"><table class="eqtbl"><thead><tr><th>Vendor</th><th class="n">Day</th><th class="n">Week</th><th class="n">4 Weeks</th>${hasMo?'<th class="n">Month</th>':''}<th class="n">Del+Pick</th><th class="n">${days}-day total</th><th>Quoted</th></tr></thead><tbody>
      ${vs.sort((a,b)=>(tot[vs.indexOf(a)]??1e12)-(tot[vs.indexOf(b)]??1e12)).map(q=>{const i=vs.indexOf(q);const b=bestCost(q,days);const t=tot[i];
        return `<tr data-q="${esc(q._id)}"><td><b>${esc(q.vendor)}</b>${q.note?`<br><small class="muted">${esc(q.note)}</small>`:''}</td>${['day','week','m4'].map(f=>`<td class="n ${num(q[f])!=null&&num(q[f])===mn[f]&&vs.length>1?'best':''}">${money(num(q[f])??q[f])}</td>`).join('')}${hasMo?`<td class="n ${num(q.month)!=null&&num(q.month)===mn.month&&vs.length>1?'best':''}">${money(num(q.month)??q.month)}</td>`:''}
        <td class="n">${delivFor(q)?money(delivFor(q)):'—'}</td><td class="n ${t!=null&&t===minT&&vs.length>1?'best tot':''}">${t!=null?money(t)+`<br><small class="muted">${esc(b.how)}</small>`:'—'}</td><td><small>${esc(q.date||'')}${q.job?' · '+esc(q.job):''}</small></td></tr>`}).join('')}
      </tbody></table></div>${(()=>{const best=g.filter(q=>num(q.day)!=null).sort((a,b)=>num(a.day)-num(b.day))[0];const open=histOpen.has(k);return `<div class="eqhist"><button class="btn small" data-hk="${esc(k)}">${open?'Hide':'Price history'} · ${g.length} quote${g.length>1?'s':''}</button>${best?` <small class="muted">Lowest day rate ever: ${money(num(best.day))} · ${esc(best.vendor)}${best.date?' · '+esc(best.date):''}</small>`:''}${open?`<div class="tblwrap"><table><thead><tr><th>Date</th><th>Vendor</th><th class="n">Day</th><th class="n">Week</th><th class="n">4 Weeks</th><th class="n">Month</th><th>Job · Site</th><th>Doc</th></tr></thead><tbody>${[...g].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map(q=>`<tr><td>${esc(q.date||'—')}</td><td>${esc(q.vendor)}</td><td class="n">${money(num(q.day))}</td><td class="n">${money(num(q.week))}</td><td class="n">${money(num(q.m4))}</td><td class="n">${money(num(q.month))}</td><td>${esc([q.job,q.site].filter(Boolean).join(' · '))}</td><td>${q.doc?`<a href="${esc(q.doc.url)}" target="_blank" rel="noopener">${esc(q.doc.kind||'file')}</a>`:''}</td></tr>`).join('')}</tbody></table></div>`:''}</div>`})()}</div>`}).join('')}`;
  const b=document.getElementById('eqBody');b.querySelectorAll('[data-hk]').forEach(x=>x.onclick=()=>{const k=x.dataset.hk;histOpen.has(k)?histOpen.delete(k):histOpen.add(k);render()});b.querySelectorAll('[data-ec]').forEach(x=>x.onclick=()=>{cat=x.dataset.ec;render()});const bk=document.getElementById('eqBack');if(bk)bk.onclick=()=>{cat='';render();scrollTo({top:0})};
  b.querySelectorAll('[data-dd]').forEach(x=>x.onclick=()=>{days=Math.max(1,days+ +x.dataset.dd);render()});
  const di=document.getElementById('eqD');if(di)di.onchange=()=>{days=Math.max(1,parseInt(di.value)||1);render()};
  if(canEdit())b.querySelectorAll('tr[data-q]').forEach(r=>r.onclick=()=>openQuote(r.dataset.q))}
function renderList(){const q=qf.toLowerCase();const l=[...Q].filter(x=>!q||[x.cat,spec(x),x.vendor,x.job,x.site,x.note].join(' ').toLowerCase().includes(q)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||a.cat.localeCompare(b.cat));
  document.getElementById('eqBody').innerHTML=`<div class="filters"><input id="eqQ" class="search" placeholder="Search equipment, vendor, job…" value="${esc(qf)}"><button class="btn" id="eqX">Export Excel</button>${canEdit()?'<button class="btn" id="eqImp">Import Excel</button>':''}<span class="muted">${l.length} quotes</span></div>
   <div class="tblwrap"><table><thead><tr><th>Equipment</th><th>Spec</th><th>Vendor</th><th class="n">Day</th><th class="n">Week</th><th class="n">4 Weeks</th><th class="n">Month</th><th class="n">Del/Pick</th><th>Date</th><th>Job · Site</th></tr></thead><tbody>
   ${l.map(x=>`<tr data-q="${esc(x._id)}"><td><b>${esc(x.cat)}</b></td><td>${esc(spec(x))}</td><td>${esc(x.vendor)}</td><td class="n">${money(num(x.day)??x.day)}</td><td class="n">${money(num(x.week)??x.week)}</td><td class="n">${money(num(x.m4)??x.m4)}</td><td class="n">${money(num(x.month))}</td><td class="n">${x.deliv||x.pick?money(num(x.deliv))+' / '+money(num(x.pick)):''}</td><td>${esc(x.date||'')}</td><td>${esc([x.job,x.site].filter(Boolean).join(' · '))}</td></tr>`).join('')}</tbody></table></div>`;
  const i=document.getElementById('eqQ');i.oninput=()=>{qf=i.value;const p=i.selectionStart;renderList();const n=document.getElementById('eqQ');n.focus();n.setSelectionRange(p,p)};
  document.getElementById('eqX').onclick=exportX;wireImp();
  if(canEdit())document.querySelectorAll('#eqBody tr[data-q]').forEach(r=>r.onclick=()=>openQuote(r.dataset.q))}
function renderVen(){const vs=[...new Set(Q.map(q=>q.vendor))].sort();
  document.getElementById('eqBody').innerHTML=`<div class="panel"><p class="muted">Default delivery and pickup fees per vendor. A quote's own fee overrides these.</p>
   <div class="tblwrap"><table><thead><tr><th>Vendor</th><th class="n">Quotes</th><th class="n">Delivery</th><th class="n">Pickup</th><th>Contact / notes</th></tr></thead><tbody>
   ${vs.map(v=>{const d=VEN[v]||{};return `<tr><td><b>${esc(v)}</b></td><td class="n">${Q.filter(q=>q.vendor===v).length}</td>${canEdit()?`<td class="n"><input class="vin" data-v="${esc(v)}" data-f="deliv" value="${esc(d.deliv??'')}" inputmode="decimal"></td><td class="n"><input class="vin" data-v="${esc(v)}" data-f="pick" value="${esc(d.pick??'')}" inputmode="decimal"></td><td><input class="vin wide" data-v="${esc(v)}" data-f="note" value="${esc(d.note||'')}"></td>`:`<td class="n">${money(num(d.deliv))}</td><td class="n">${money(num(d.pick))}</td><td>${esc(d.note||'')}</td>`}</tr>`}).join('')}</tbody></table></div></div>`;
  document.querySelectorAll('.vin').forEach(i=>i.onchange=async()=>{const v=i.dataset.v,f=i.dataset.f;const val=f==='note'?i.value.trim():num(i.value);VEN={...VEN,[v]:{...(VEN[v]||{}),[f]:val}};try{await db.doc('config/eqvendors').set(VEN);toast('Saved')}catch(e){toast('Could not save')}})}
function openQuote(id){const q=id?Q.find(x=>x._id===id):{cat:cat||'',vendor:'',date:new Date().toISOString().slice(0,10)};if(!q)return;editId=id;
  const vs=[...new Set(Q.map(x=>x.vendor))].sort(),cs=[...new Set(Q.map(x=>x.cat))].sort();
  const F=(k,l,t='text',list)=>`<label class="f">${l}<input id="eq_${k}" type="${t}" value="${esc(q[k]??'')}" ${list?`list="eqdl_${k}"`:''} ${t==='number'?'inputmode="decimal" step="any"':''}></label>`;
  document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>${id?'Edit quote':'New quote'}</h3>
   <datalist id="eqdl_cat">${cs.map(c=>`<option value="${esc(c)}">`).join('')}</datalist><datalist id="eqdl_vendor">${vs.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
   <div class="fields">${F('cat','Equipment type','text',1)}${F('vendor','Vendor','text',1)}${F('size',"Size (ft)",'number')}${F('lbs','Capacity (K lbs)','number')}${F('kw','kW','number')}${F('option','Option (e.g. W/ Jib, 185 CFM)')}${F('fuel','Fuel')}
   ${F('day','Day $','number')}${F('week','Week $','number')}${F('m4','4 Weeks $','number')}${F('month','Month $','number')}${F('deliv','Delivery $','number')}${F('pick','Pickup $','number')}
   ${F('date','Quote date','date')}${F('job','Job #')}${F('site','Site location')}<label class="f wide">Note<input id="eq_note" value="${esc(q.note||'')}"></label></div>
   <div class="bar">${id?'<button class="btn dng" id="eqDel">Delete</button>':''}<button class="btn" id="eqC">Cancel</button><button class="go" id="eqS" style="width:auto">Save</button></div></div></div>`;
  document.getElementById('eqC').onclick=closeDlg;
  const d=document.getElementById('eqDel');if(d)d.onclick=async()=>{if(!confirm('Delete this quote?'))return;await db.doc('eqp/'+id).delete();closeDlg()};
  document.getElementById('eqS').onclick=async()=>{const g=k=>document.getElementById('eq_'+k).value.trim();const o={cat:fixType(g('cat')),vendor:clean(g('vendor')),size:num(g('size')),lbs:num(g('lbs')),kw:num(g('kw')),option:g('option'),fuel:g('fuel'),day:num(g('day')),week:num(g('week')),m4:num(g('m4')),month:num(g('month')),deliv:num(g('deliv')),pick:num(g('pick')),date:g('date'),job:g('job')?normJob(g('job')):'',site:g('site'),note:g('note'),by:curUser,at:new Date().toISOString()};
    if(!o.cat||!o.vendor){toast('Equipment type and vendor are required.');return}if([o.day,o.week,o.m4,o.month].every(x=>x==null)&&!o.note){toast('Enter at least one price.');return}
    try{await db.doc('eqp/'+(id||('q'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)))).set({...(id?q:{}),...o,_id:undefined});cat=o.cat;closeDlg();toast('Saved')}catch(e){toast('Could not save: '+(e.message||e.code))}}}
async function exportX(){if(!window.XLSX)return;const rows=[...Q].sort((a,b)=>a.cat.localeCompare(b.cat)||(num(a.size)||0)-(num(b.size)||0)).map(q=>[q.cat,q.lbs??'',q.size??'',q.kw??'',q.option||'',q.fuel||'',q.vendor,num(q.day)??q.day??'',num(q.week)??q.week??'',num(q.m4)??q.m4??'',q.month??'',q.deliv??'',q.pick??'',q.date||'',q.job||'',q.site||'',q.note||'']);
  const ws=XLSX.utils.aoa_to_sheet([['Equipment','K lbs','Size ft','kW','Option','Fuel','Vendor','Day','Week','4 Weeks','Month','Delivery','Pickup','Quote date','Job','Site','Note'],...rows]);ws['!autofilter']={ref:ws['!ref']};const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Prices');
  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});const dl=await window.claude?.use?.('downloads');const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const name='AME_Equipment_Prices_'+new Date().toISOString().slice(0,10)+'.xlsx';if(dl)dl.save({filename:name,data:blob})}

/* ---------- quote / invoice upload ---------- */
function pickDoc(){let f=document.getElementById('eqDoc');if(!f){f=document.createElement('input');f.type='file';f.id='eqDoc';f.accept='application/pdf,image/*';f.multiple=true;f.hidden=true;document.body.appendChild(f);f.onchange=()=>{const x=[...f.files];f.value='';if(x.length)handleDocs(x)}}f.click()}
function askKind(){return new Promise(ok=>{document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>What is this document?</h3><div class="names"><button data-k="Quote">Quote</button><button data-k="Invoice">Invoice</button></div><div class="bar"><button class="btn" id="kC">Cancel</button></div></div></div>`;
  document.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>ok(b.dataset.k));document.getElementById('kC').onclick=()=>{closeDlg();ok(null)}})}
async function pdfText(file){if(!window.pdfjsLib){await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)});pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;const lines=[];
  for(let p=1;p<=Math.min(pdf.numPages,8);p++){const c=await (await pdf.getPage(p)).getTextContent();const rows={};c.items.forEach(it=>{const y=Math.round(it.transform[5]/3);(rows[y]=rows[y]||[]).push([it.transform[4],it.str])});
    Object.keys(rows).sort((a,b)=>b-a).forEach(y=>lines.push(rows[y].sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join(' ').replace(/\s+/g,' ').trim()))}
  return lines.filter(Boolean)}
const EQWORDS=/telehandler|tele-?handler|reach ?fork|boom|scissor|forklift|generator|compressor|light tower|tower light|toilet|restroom|porta|hand ?wash|fence|dumpster|roll-?off|container|lift|scraper|blaster/i;
function parseDoc(lines){const txt=lines.join('\n');const vendors=[...new Set([...Q.map(q=>q.vendor),'Sunbelt Rentals','United Rentals','Herc Rentals','EquipmentShare','American Rental','Mobile Mini','Diamond'])];
  const flat=txt.toLowerCase().replace(/[^a-z]/g,'');const vendor=vendors.find(v=>{const k=v.toLowerCase().split(/\s+/).slice(0,2).join('').replace(/[^a-z]/g,'');return k.length>3&&flat.includes(k)})||'';
  const dm=txt.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);let date='';if(dm){const y=dm[3].length===2?'20'+dm[3]:dm[3];date=`${y}-${dm[1].padStart(2,'0')}-${dm[2].padStart(2,'0')}`}else{const mm=txt.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? (\d{1,2}),? (\d{4})/i);if(mm){const mi='janfebmaraprmayjunjulaugsepoctnovdec'.indexOf(mm[1].slice(0,3).toLowerCase())/3+1;date=`${mm[3]}-${String(mi).padStart(2,'0')}-${mm[2].padStart(2,'0')}`}}
  const jm=txt.match(/(?:job|po|p\.o\.)\s*(?:#|no\.?|number)?\s*:?\s*([0-9]{3,5})\b/i)||txt.match(/^\s*([0-9]{3,5})\s*-\s*[A-Z]{3}/m);
  const m$=s=>(s.match(/\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})|\$\s?\d+/g)||[]).map(x=>num(x));
  const fee=re=>{const l=lines.find(x=>re.test(x));const v=l?m$(l):[];return v.length?v[v.length-1]:null};
  const items=[];lines.forEach((l,i)=>{if(!EQWORDS.test(l))return;const ctx=[l,lines[i+1]||'',lines[i+2]||''].join(' ');const nums=m$(ctx).filter(x=>x>=20);
    const lab=ctx.toLowerCase();const pick=w=>{const m=ctx.match(new RegExp(w+'\\s*:?\\s*\\$?\\s?([\\d,]+(?:\\.\\d{2})?)','i'));return m?num(m[1]):null};
    let day=pick('(?:day|daily)'),week=pick('(?:week|weekly)'),m4=pick('(?:4 ?weeks?|4wk|28 ?days?|month(?:ly)?)');
    if(day==null&&week==null&&m4==null&&nums.length>=3){const s3=nums.slice(0,3);if(s3[0]<=s3[1]&&s3[1]<=s3[2])[day,week,m4]=s3}
    if(day==null&&week==null&&m4==null&&!nums.length)return;
    const sz=l.match(/(\d{2,3})\s*(?:'|ft|foot)/i),lb=l.match(/(\d{1,2}(?:,\d{3})?)\s*(?:k|,000)\s*(?:lb|#)?/i);
    const type=(l.match(/telehandler|reach ?fork|articulating boom|art(?:\.|iculating)? boom|straight boom|telescopic boom|boom lift|rough terrain scissor|rt scissor|scissor lift|forklift|generator|air compressor|light tower|tower light|toilet|restroom|porta|hand ?wash|fence|dumpster|container/i)||[''])[0];
    items.push({line:l,cat:normType(type),size:sz?+sz[1]:null,lbs:lb?Math.round(num(lb[1])/(lb[1].includes(',')?1000:1)):null,day,week,m4:m4,amount:(day==null&&week==null&&m4==null)?nums[nums.length-1]:null})});
  const tb=tableItems(lines);let deliv=fee(/deliver/i),pick=fee(/pick ?up|return/i);if(tb.deliv!=null){deliv=tb.deliv;if(pick==null||tb.both)pick=tb.both?tb.deliv:pick}
  const credit=/credit memo/i.test(lines.slice(0,20).join(' '));
  return {vendor,date,job:jm?jm[1]:'',deliv,pick,credit,items:(tb.items.length?tb.items:items).slice(0,15)}}
/* table-style lines: a header like "QTY EQUIPMENT # Min Day Week 4 Week Amount" or "Qty Description Service Rental A&E Tax Total" */
function tableItems(lines){const out={items:[],deliv:null,both:false};const hi=lines.findIndex(l=>/\bqty\b/i.test(l)&&(/\bday\b.*\bweek\b/i.test(l)||/\bservice\b.*\brental\b/i.test(l)));if(hi<0)return out;
  const H=lines[hi];const cols=[];const re=/\b(min|day|week|4 ?weeks?|month|amount|service|rental|a&e|tax|total|rate|price)\b/gi;let m;const tail=H.replace(/^.*?(?:description|equipment\s*#?|item)\s*/i,'');while((m=re.exec(tail)))cols.push(m[1].toLowerCase().replace(/\s/g,''));
  for(let i=hi+1;i<Math.min(lines.length,hi+40);i++){const l=lines[i];if(/sub-?total|sales items|^total/i.test(l))break;const q=l.match(/^\s*(\d+(?:\.\d+)?)\s+(.+?)((?:\s+\$?[\d,]+\.\d{2,3}|\s+N\/C)+)\s*$/i);if(!q)continue;
    const desc=q[2].trim();const nums=q[3].trim().split(/\s+/).map(x=>/n\/c/i.test(x)?0:num(x));if(nums.every(x=>!x))continue;
    const v={};const off=cols.length-nums.length;nums.forEach((n,k)=>{const c=cols[k+Math.max(0,off)];if(c)v[c]=n});
    if(/deliver|removal|pick ?up|haul/i.test(desc)){out.deliv=v.service??v.rental??v.rate??v.price??nums[0];out.both=/removal|\//.test(desc);continue}
    const ty=normType(desc)||desc.replace(/\s*-?\s*\d+\s*x\s*\d+.*$/i,'').replace(/\b\d+\s*x\s*(?:wk|week)\b.*$/i,'').replace(/\bservice\b|\bsvc\b/ig,'').trim().toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
    const opt=(desc.match(/\d+\s*x\s*\d+/i)||[''])[0].replace(/\s/g,'');const sz=desc.match(/(\d{2,3})\s*(?:'|ft)/i);
    const it={line:l,cat:ty,option:opt,size:sz?+sz[1]:null,lbs:null,day:v.day??null,week:v.week??null,m4:v['4week']??v['4weeks']??null,amount:null};
    if(v.service!=null||v.rental!=null)it.amount=+((v.service||0)+(v.rental||0)).toFixed(2);else if(v.month!=null)it.amount=v.month;
    if([it.day,it.week,it.m4,it.amount].some(x=>x))out.items.push(it)}
  return out}
function normType(t){t=String(t).toLowerCase();if(/tele|reach/.test(t))return 'Telehandler';if(/art/.test(t))return 'ART Boom Lift';if(/straight|telescopic/.test(t))return 'ST Boom Lift';if(/boom/.test(t))return 'ART Boom Lift';if(/rough|rt scissor/.test(t))return 'RT Scissor Lift';if(/scissor/.test(t))return 'Scissor Lift';if(/forklift/.test(t))return 'Mast Forklift';if(/generator/.test(t))return 'Generator';if(/compressor/.test(t))return 'Air Compressor';if(/light/.test(t))return 'Tower Light';if(/toilet|restroom|porta/.test(t))return 'Toilet';if(/wash/.test(t))return 'Hand Wash Station';if(/fence/.test(t))return 'Fence';if(/dumpster/.test(t))return 'Dumpster';if(/container/.test(t))return 'Storage Container';return ''}

async function loadJs(src){if(document.querySelector(`script[src="${src}"]`))return;await new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
let OCRW=null;async function ocr(img){await loadJs('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');if(!OCRW)OCRW=await Tesseract.createWorker('eng');const r=await OCRW.recognize(img);return r.data.text.split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)}
async function pdfOcr(file){await pdfText(file).catch(()=>{});const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;const out=[];
  for(let p=1;p<=Math.min(pdf.numPages,4);p++){const pg=await pdf.getPage(p);const v=pg.getViewport({scale:2});const c=document.createElement('canvas');c.width=v.width;c.height=v.height;await pg.render({canvasContext:c.getContext('2d'),viewport:v}).promise;out.push(...await ocr(c))}return out}
async function readLines(file){const isPdf=/pdf/i.test(file.type)||/\.pdf$/i.test(file.name);
  if(isPdf){let l=[];try{l=await pdfText(file)}catch(e){}if(l.join('').replace(/\s/g,'').length>80)return l;return pdfOcr(file)}
  return ocr(file)}
function vendorGuess(lines){const t=lines.join(' ');const m=t.match(/www\.([a-z0-9\-]+)\.com|@([a-z0-9\-]+)\.com/i);if(m){const d=(m[1]||m[2]).toLowerCase();const known=[...new Set(Q.map(q=>q.vendor))].find(v=>d.includes(v.toLowerCase().replace(/[^a-z]/g,'').slice(0,6)));if(known)return known;return d.replace(/rentals?$/,' Rentals').replace(/^./,c=>c.toUpperCase())}
  const top=lines.slice(0,5).find(l=>/rental|equipment|sanitation|waste|fence|disposal|inc\b|llc/i.test(l));return top?top.replace(/[^\w &.,'-]/g,'').trim().slice(0,40):''}
const hasPrice=it=>[it.day,it.week,it.m4,it.amount].some(v=>v!=null&&v>0);
async function saveParsed(P,doc){if(P.credit||/credit memo/i.test(doc.name||''))return -1;const same=(a,it)=>a.vendor===clean(P.vendor)&&a.cat===fixType(it.cat)&&(a.option||'')===(it.option||'')&&a.day==(it.day??null)&&a.week==(it.week??null)&&a.m4==(it.m4??null)&&a.month==(it.amount??null);
  const ok0=P.items.filter(it=>it.cat&&hasPrice(it));if(!P.vendor||!ok0.length)return 0;const ok=ok0.filter(it=>!Q.some(a=>same(a,it)));if(!ok.length)return -2;const now=new Date().toISOString();const map={};
  ok.forEach((it,i)=>map['q'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)+i]={cat:fixType(it.cat),size:it.size??null,lbs:it.lbs??null,kw:null,option:it.option||'',fuel:'',vendor:clean(P.vendor),day:it.day??null,week:it.week??null,m4:it.m4??null,month:it.amount??null,deliv:P.deliv??null,pick:P.pick??null,date:P.date||now.slice(0,10),job:P.job?normJob(P.job):'',site:'',note:doc.kind+' (auto)',doc,by:curUser,at:now,src:'doc'});
  if(db.setMany)await db.setMany('eqp',map);else for(const [k,v] of Object.entries(map))await db.doc('eqp/'+k).set(v);return ok.length}
async function handleDocs(files){let skip=0,saved=0,prices=0,review=0,fail=0;const prog=m=>{let t=document.getElementById('eqProg');if(!t){t=document.createElement('div');t.id='eqProg';t.className='toast';t.style.animation='none';document.body.appendChild(t)}t.textContent=m};
  for(let i=0;i<files.length;i++){const file=files[i];const tag=`(${i+1}/${files.length}) `;
    try{prog(tag+'Uploading '+file.name+'…');const fs=await window.claude.use('files');const path='eqdocs/'+new Date().toISOString().slice(0,10)+'_'+Date.now().toString(36).slice(-4)+'_'+file.name.replace(/[^\w.\-]+/g,'_');const r=await fs.save(path,file);DOCBLOB[path]=file;
      prog(tag+'Reading '+file.name+'…');let lines=[];try{lines=await readLines(file)}catch(e){console.warn(e)}
      const kind=/invoice/i.test(lines.slice(0,25).join(' '))?'Invoice':'Quote';const doc={url:r.url,name:file.name,kind,path,type:file.type||''};
      let P={vendor:'',date:'',job:'',deliv:null,pick:null,items:[]};try{P=parseDoc(lines)}catch(e){}if(!P.vendor)P.vendor=vendorGuess(lines);
      const n=await saveParsed(P,doc);if(n===-1||n===-2){skip++}else if(n){saved++;prices+=n}else{review++;await db.doc('eqinbox/d'+Date.now().toString(36)+i).set({P,doc,by:curUser,at:new Date().toISOString(),text:lines.slice(0,60).join('\n')})}}
    catch(e){fail++;console.warn(e)}}
  document.getElementById('eqProg')?.remove();
  toast(`${files.length} file(s): ${prices} price(s) recorded from ${saved}`+(skip?` · ${skip} credit memo/duplicate skipped`:'')+(review?` · ${review} need a quick look`:'')+(fail?` · ${fail} failed`:''));view='cmp';render()}
let INBOX=[];const DOCBLOB={};
async function showPreview(doc){const el=document.getElementById('dPrev');if(!el)return;if(!doc.path&&doc.name){try{const fs=await window.claude.use('files');const nm=doc.name.replace(/[^\w.\-]+/g,'_');const f=(await fs.list('eqdocs')).filter(n=>n.endsWith(nm)).sort().pop();if(f)doc.path='eqdocs/'+f}catch(e){}}if(!doc.path){el.innerHTML=`<p class="muted">Preview not available — <a href="${esc(doc.url)}" target="_blank" rel="noopener">open the file</a></p>`;return}
  el.innerHTML='<p class="muted">Loading document…</p>';try{let b=DOCBLOB[doc.path];if(!b){const fs=await window.claude.use('files');b=await fs.get(doc.path);DOCBLOB[doc.path]=b}
    const isPdf=/pdf/i.test(doc.type||b.type)||/\.pdf$/i.test(doc.name);el.innerHTML='';
    if(!isPdf){const im=document.createElement('img');im.src=URL.createObjectURL(b);el.appendChild(im);return}
    await pdfText(new File([b],'x.pdf',{type:'application/pdf'})).catch(()=>{});const pdf=await pdfjsLib.getDocument({data:await b.arrayBuffer()}).promise;
    for(let p=1;p<=Math.min(pdf.numPages,10);p++){const pg=await pdf.getPage(p);const v=pg.getViewport({scale:1.6});const c=document.createElement('canvas');c.width=v.width;c.height=v.height;el.appendChild(c);await pg.render({canvasContext:c.getContext('2d'),viewport:v}).promise}}
  catch(e){el.innerHTML=`<p class="muted">Could not show the file (${esc(e.message||'')}). <a href="${esc(doc.url)}" target="_blank" rel="noopener">Open it</a></p>`}}
async function handleDoc(file){const kind=await askKind();if(!kind)return;closeDlg();toast('Uploading '+kind.toLowerCase()+'…');
  let doc=null;try{const f=await window.claude.use('files');const r=await f.save('eqdocs/'+new Date().toISOString().slice(0,10)+'_'+file.name.replace(/[^\w.\-]+/g,'_'),file);doc={url:r.url,name:file.name,kind}}catch(e){toast('Could not store the file: '+(e.message||e));return}
  let P={vendor:'',date:'',job:'',deliv:null,pick:null,items:[]};
  if(/pdf/i.test(file.type)||/\.pdf$/i.test(file.name)){try{P=parseDoc(await pdfText(file))}catch(e){toast('Could not read the PDF text — fill it in by hand.')}}
  else toast('Photo saved — type the prices from it below.');
  if(!P.items.length)P.items=[{cat:cat||'',size:null,lbs:null,day:null,week:null,m4:null}];reviewDoc(P,doc)}
function reviewDoc(P,doc){const cs=[...new Set(Q.map(x=>x.cat))].sort(),vs=[...new Set(Q.map(x=>x.vendor))].sort();
  const row=(it,i)=>`<div class="drow" data-i="${i}"><div class="fields">
    <label class="f">Equipment<input data-f="cat" list="eqdl_cat2" value="${esc(it.cat||'')}"></label><label class="f">Size ft<input data-f="size" inputmode="decimal" value="${esc(it.size??'')}"></label><label class="f">K lbs<input data-f="lbs" inputmode="decimal" value="${esc(it.lbs??'')}"></label><label class="f">Option<input data-f="option" value=""></label>
    <label class="f">Day $<input data-f="day" inputmode="decimal" value="${esc(it.day??'')}"></label><label class="f">Week $<input data-f="week" inputmode="decimal" value="${esc(it.week??'')}"></label><label class="f">4 Weeks $<input data-f="m4" inputmode="decimal" value="${esc(it.m4??'')}"></label><label class="f">Month / flat $<input data-f="month" inputmode="decimal" value="${esc(it.amount??'')}"></label></div>
    ${it.line?`<small class="muted">From: “${esc(it.line.slice(0,120))}”</small>`:''}<button class="btn small dng" data-rmi="${i}">Remove line</button></div>`;
  document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg eqsplit"><div id="dPrev" class="eqprev"></div><div class="eqform"><h3>${esc(doc.kind)} — enter the prices</h3><p class="muted">Look at the document on the left and fill in or fix the details, then Save. Discard drops it without saving prices.</p>
   <datalist id="eqdl_cat2">${cs.map(c=>`<option value="${esc(c)}">`).join('')}</datalist><datalist id="eqdl_v2">${vs.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
   <div class="fields"><label class="f">Vendor<input id="dv" list="eqdl_v2" value="${esc(P.vendor)}"></label><label class="f">Date<input id="dd" type="date" value="${esc(P.date)}"></label><label class="f">Job #<input id="dj" value="${esc(P.job)}"></label><label class="f">Site<input id="ds"></label><label class="f">Delivery $<input id="ddl" inputmode="decimal" value="${esc(P.deliv??'')}"></label><label class="f">Pickup $<input id="dpk" inputmode="decimal" value="${esc(P.pick??'')}"></label></div>
   <div id="drows">${P.items.map(row).join('')}</div><button class="btn" id="dadd">+ Add line</button>
   <p><a href="${esc(doc.url)}" target="_blank" rel="noopener">Open the uploaded ${esc(doc.kind.toLowerCase())}</a></p>
   <div class="bar"><button class="btn dng" id="dX">Discard</button><button class="btn" id="dC">Later</button><button class="go" id="dS" style="width:auto">Save prices</button></div></div></div></div>`;showPreview(doc);
  const wire=()=>document.querySelectorAll('[data-rmi]').forEach(b=>b.onclick=()=>{P.items.splice(+b.dataset.rmi,1);collect();reviewDoc(P,doc)});
  const collect=()=>{document.querySelectorAll('.drow').forEach(r=>{const it=P.items[+r.dataset.i];if(!it)return;r.querySelectorAll('[data-f]').forEach(i=>{const f=i.dataset.f;it[f]=['cat','option'].includes(f)?i.value.trim():num(i.value)});it.amount=it.month});['vendor','date','job'].forEach((k,n)=>P[k]=document.getElementById(['dv','dd','dj'][n]).value.trim());P.site=document.getElementById('ds').value.trim();P.deliv=num(document.getElementById('ddl').value);P.pick=num(document.getElementById('dpk').value)};
  wire();document.getElementById('dadd').onclick=()=>{collect();P.items.push({cat:'',size:null});reviewDoc(P,doc)};document.getElementById('dC').onclick=closeDlg;document.getElementById('dX').onclick=()=>{if(!confirm('Discard this document? No prices will be saved from it.'))return;if(P._inbox)db.doc('eqinbox/'+P._inbox).delete().catch(()=>{});closeDlg();toast('Discarded')};
  document.getElementById('dS').onclick=async()=>{collect();if(!P.vendor){toast('Enter the vendor.');return}const ok=P.items.filter(it=>it.cat&&[it.day,it.week,it.m4,it.month].some(v=>v!=null));if(!ok.length){toast('Add at least one priced line.');return}
    const now=new Date().toISOString();const map={};ok.forEach((it,i)=>map['q'+Date.now().toString(36)+i]={cat:fixType(it.cat),size:it.size??null,lbs:it.lbs??null,kw:null,option:it.option||'',fuel:'',vendor:clean(P.vendor),day:it.day??null,week:it.week??null,m4:it.m4??null,month:it.month??null,deliv:P.deliv,pick:P.pick,date:P.date||now.slice(0,10),job:P.job?normJob(P.job):'',site:P.site||'',note:doc.kind,doc,by:curUser,at:now,src:'doc'});
    try{if(db.setMany)await db.setMany('eqp',map);else for(const [k,v] of Object.entries(map))await db.doc('eqp/'+k).set(v);closeDlg();if(P._inbox)db.doc('eqinbox/'+P._inbox).delete().catch(()=>{});cat=fixType(ok[0].cat);view='cmp';toast(ok.length+' price(s) saved from the '+doc.kind.toLowerCase());render()}catch(e){toast('Could not save: '+(e.message||e.code))}}}

/* ---------- Excel import (your “Equipment Price Tracking” workbook layout) ---------- */
function wireImp(){const b=document.getElementById('eqImp');if(!b)return;b.onclick=()=>{let f=document.getElementById('eqFile');if(!f){f=document.createElement('input');f.type='file';f.id='eqFile';f.accept='.xlsx,.xls';f.hidden=true;document.body.appendChild(f);f.onchange=()=>{const x=f.files[0];f.value='';if(x)importFile(x)}}f.click()}}
function vendorHead(t){const m=String(t).match(/^(.*?)\s*\(\$?([\d.]+)\s*\+\s*\$?([\d.]+)\)/);return m?{name:clean(m[1]),deliv:+m[2],pick:+m[3]}:{name:clean(t)}}
function parseWB(wb){const out=[],ven={};const iso=v=>v instanceof Date?v.toISOString().slice(0,10):(typeof v==='number'&&v>30000?new Date(Math.round((v-25569)*864e5)).toISOString().slice(0,10):(typeof v==='string'&&/^\d{4}-\d\d-\d\d/.test(v)?v.slice(0,10):''));
  const above=(A,i)=>{for(let k=i-1;k>=0;k--)if(A[k]&&A[k].some(c=>clean(c)))return A[k];return []};
  for(const sn of wb.SheetNames){const A=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null,raw:true});
    const h=A.findIndex(r=>r&&r.some(c=>/^equipment type$/i.test(clean(c))));
    if(h>0){const H=A[h].map(c=>clean(c).toLowerCase()),V=above(A,h);const groups=[];V.forEach((c,i)=>{if(clean(c))groups.push({i,...vendorHead(c)})});
      groups.forEach((g,n)=>{g.end=n+1<groups.length?groups[n+1].i:H.length;if(g.deliv!=null)ven[g.name]={deliv:g.deliv,pick:g.pick}});
      const ci=n=>H.findIndex(x=>x.startsWith(n));const cType=ci('equipment type'),cL=ci('lbs'),cS=ci('size'),cK=ci('kw'),cO=ci('option'),cF=ci('fuel'),cD=ci('date'),cJ=ci('job'),cSite=ci('site');
      const master=/rental list/i.test(sn);
      for(const r of A.slice(h+1)){if(!r||!clean(r[cType]))continue;const date=cD>=0?iso(r[cD]):'';if(!master&&!date)continue;
        let type=fixType(r[cType]),size=cS>=0?num(r[cS]):null,lbs=cL>=0?num(r[cL]):null;
        if(!master){const m=type.match(/^(\d+)\s*k\b.*?(\d+)'.*?([A-Za-z].*)$/i);if(m){lbs=+m[1];size=+m[2];type=fixType(m[3])}else{const m2=type.match(/^(\d+)'\s*(.*)$/);if(m2){size=+m2[1];type=fixType(m2[2])}}}
        for(const g of groups){const pr={};for(let i=g.i;i<g.end;i++){const k=H[i];if(/^day/.test(k))pr.day=r[i];else if(/^week/.test(k))pr.week=r[i];else if(/^4 ?week/.test(k))pr.m4=r[i];else if(/deliver/.test(k))pr.deliv=r[i]}
          if([pr.day,pr.week,pr.m4].every(v=>v==null||v===''))continue;const call=[pr.day,pr.week,pr.m4].some(v=>typeof v==='string'&&/call|quote|for/i.test(v));
          out.push({cat:type,lbs,size,kw:cK>=0?num(r[cK]):null,option:cO>=0?clean(r[cO]).replace(/^N\/A$/i,''):'',fuel:cF>=0?fixType(r[cF]):'',vendor:g.name,day:call?null:num(pr.day),week:call?null:num(pr.week),m4:call?null:num(pr.m4),month:null,deliv:num(pr.deliv),pick:null,date,job:cJ>=0&&r[cJ]?normJob(r[cJ]):'',site:cSite>=0?clean(r[cSite]):'',note:call?'Call for quote':'',src:'xlsx:'+sn})}}
      continue}
    /* month-based sheets: vendor row, then Month/Delivery/Pickup row */
    const mh=A.findIndex(r=>r&&r.some(c=>/^month$/i.test(clean(c))));
    if(mh>=0){const H=A[mh].map(c=>clean(c).toLowerCase()),V=above(A,mh);const gs=[];V.forEach((c,i)=>{if(clean(c))gs.push({i,name:clean(c)})});gs.forEach((g,n)=>g.end=n+1<gs.length?gs[n+1].i:H.length);
      for(const r of A.slice(mh+1)){if(!r||!clean(r[0]))continue;for(const g of gs){const pr={};for(let i=g.i;i<g.end;i++){if(H[i]==='month')pr.month=num(r[i]);else if(H[i]==='delivery')pr.deliv=num(r[i]);else if(H[i]==='pickup')pr.pick=num(r[i])}
        if(pr.month==null)continue;out.push({cat:fixType(r[0]),lbs:null,size:null,kw:null,option:'',fuel:'',vendor:g.name,day:null,week:null,m4:null,month:pr.month,deliv:pr.deliv??null,pick:pr.pick??null,date:'',job:'',site:'',note:'',src:'xlsx:'+sn})}}continue}
    /* dumpster layout */
    const dh=A.findIndex(r=>r&&/dumpster size/i.test(clean(r[0])));
    if(dh>=0){const V=A[dh],P=A[dh+1]||[];const gs=[];V.forEach((c,i)=>{if(i&&clean(c))gs.push({i,name:clean(c),period:clean(P[i])})});
      for(const r of A.slice(dh+2)){if(!r||!clean(r[0]))continue;for(const g of gs){const p=num(r[g.i]);if(p==null)continue;out.push({cat:'Dumpster',lbs:null,size:num(String(r[0]).match(/\d+/)?.[0]),kw:null,option:clean(r[0]).replace(/\d+\s*/,'')||'yards',fuel:'',vendor:g.name,day:null,week:null,m4:null,month:null,flat:p,deliv:null,pick:null,date:'',job:'',site:'',note:[g.period,clean(r[g.i+1])].filter(Boolean).join(' · '),src:'xlsx:'+sn})}}}}
  return {out,ven}}
async function importFile(f){try{const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});const {out,ven}=parseWB(wb);if(!out.length){toast('No prices found in that file.');return}
  const exist=new Set(Q.map(q=>[key(q),q.vendor,q.day,q.week,q.m4,q.month,q.flat,q.date].join('~')));const fresh=out.filter(q=>!exist.has([key(q),q.vendor,q.day,q.week,q.m4,q.month,q.flat,q.date].join('~')));
  if(!confirm(`Found ${out.length} prices (${fresh.length} new) from ${new Set(out.map(q=>q.vendor)).size} vendors. Import ${fresh.length}?`))return;
  const now=new Date().toISOString();const map={};fresh.forEach((q,i)=>map['q'+Date.now().toString(36)+i.toString(36)]={...q,by:curUser,at:now});
  if(db.setMany)await db.setMany('eqp',map);else for(const [k,v] of Object.entries(map))await db.doc('eqp/'+k).set(v);
  const nv={...ven,...VEN};await db.doc('config/eqvendors').set(nv);toast(`Imported ${fresh.length} prices`)}catch(e){toast('Import failed: '+(e.message||e))}}
/* dumpsters & flat prices show in Compare via the "flat" field */
const _bc=bestCost;bestCost=function(q,D){if(num(q.flat)!=null)return {cost:num(q.flat),how:q.note||'flat'};return _bc(q,D)};

AME.eqParse=parseWB;AME.eqDocs=handleDocs;AME.eqRetry=async()=>{let r=[0,0,0];for(const x of INBOX){const lines=(x.text||'').split('\n');let P=parseDoc(lines);if(!P.vendor)P.vendor=vendorGuess(lines);const n=await saveParsed(P,x.doc);if(n!==0){await db.doc('eqinbox/'+x._id).delete();r[n>0?0:1]+=n>0?n:1}else{r[2]++;await db.doc('eqinbox/'+x._id).update({P})}}return r};AME.eqParseDoc=parseDoc;
AME.register({id:'eqp',name:'Equipment Prices',desc:'Rental quotes by vendor · compare · cheapest for N days',perm:'EQP',tabs:['eqp'],section:'tab-eqp',
  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h13l3-6h-4l-2-4H7"/><circle cx="7" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M10 7l2 4"/></svg>',
  open:()=>showTab('eqp'),onShow:render});
const _ar=window.applyRole;window.applyRole=function(){_ar();const b=document.querySelector('nav.tabs [data-tab="eqp"]');if(b)b.hidden=!can('EQP')};
(function wait(){if(typeof db!=='undefined'&&db&&typeof db.collection==='function')load();else setTimeout(wait,300)})();
})();
