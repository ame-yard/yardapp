/* Owner-only tools: Inventory (Test) — big-text preview with sample data (never saved) · Version log */
(function(){
const own=()=>typeof isOwner==='function'&&typeof curUser!=='undefined'&&isOwner(curUser);
const mk=id=>{let s=document.getElementById('tab-'+id);if(!s){s=document.createElement('section');s.id='tab-'+id;s.hidden=true;(document.querySelector('main')||document.body).appendChild(s)}return s};
const I=(p,w=22)=>`<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

/* ---------- Inventory (Test) ---------- */
const T=mk('ytest');
const SAMPLE=[
 {id:'s1',name:'Fiberglass Step Ladder',size:'8 ft',mfgr:'WERNER',cat:'Ladders',loc:'A-01',level:'L1',qty:3,unit:'EA'},
 {id:'s2',name:'Fiberglass Extension Ladder',size:'32 ft',mfgr:'WERNER',cat:'Ladders',loc:'A-01',level:'L2',qty:1,unit:'EA'},
 {id:'s3',name:'Cordless Drill',size:'20V',mfgr:'DEWALT',cat:'Power Tools',loc:'F-01',level:'L1',qty:5,unit:'EA'},
 {id:'s4',name:'Hot-Air Hand Welder',size:'-',mfgr:'Leister',cat:'Power Tools',loc:'F-02',level:'L1',qty:2,unit:'EA'},
 {id:'s5',name:'Sika Primer 600',size:'5 Gal',mfgr:'Sika',cat:'Materials',loc:'A-05',level:'L1',qty:0,unit:'PL'},
 {id:'s6',name:'Black 4"#14 Fastener',size:'4"',mfgr:'Carlisle',cat:'Materials',loc:'B-10',level:'L3',qty:12,unit:'BOX'}];
let tz=(()=>{try{return localStorage.getItem('ytestZ')||'lg'}catch(e){return 'lg'}})(),tcat='',tlay='card',tcart={};
const ZS={md:{l:'Normal',s:1},lg:{l:'Large',s:1.3},xl:{l:'Extra large',s:1.6}};
function tRender(){const sc=ZS[tz].s;const cats=[...new Set(SAMPLE.map(x=>x.cat))];const L=SAMPLE.filter(x=>!tcat||x.cat===tcat);const n=Object.values(tcart).reduce((a,b)=>a+b,0);
  T.innerHTML=`<div class="ytt" style="--z:${sc}">
   <div class="ytt-bar"><div><h2>Inventory (Test)</h2><p class="muted">Sample items only — nothing here is saved or touches the real yard. Only you see this app.</p></div>
    <div class="viewseg">${Object.entries(ZS).map(([k,v])=>`<button data-z="${k}" aria-pressed="${k===tz}">${v.l}</button>`).join('')}</div></div>
   <div class="ytt-row"><button class="ytt-scan">${I('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',28*sc)}<span>Scan code</span></button>
    <div class="viewseg"><button data-tl="card" aria-pressed="${tlay==='card'}">Tiles</button><button data-tl="rows" aria-pressed="${tlay==='rows'}">List</button></div></div>
   <div class="ytt-chips"><button data-tc="" aria-pressed="${!tcat}">All</button>${cats.map(c=>`<button data-tc="${c}" aria-pressed="${tcat===c}">${c}</button>`).join('')}</div>
   <div class="${tlay==='card'?'ytt-grid':'ytt-list'}">${L.map(x=>{const c=tcart[x.id]||0;const out=!x.qty;return `<div class="ytt-card ${c?'in':''} ${out?'out':''}" data-ti="${x.id}">
     ${tlay==='card'?`<div class="ytt-pic">${I('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 15l4-4 5 5 3-3 4 4"/>',40*sc)}${c?`<span class="ytt-step"><b data-tm="${x.id}">−</b><em>${c}</em><b data-tp="${x.id}">+</b></span>`:''}</div>`:''}
     <div class="ytt-body"><div class="ytt-name">${esc(x.name)}</div><div class="ytt-sub">${esc([x.size!=='-'?x.size:'',x.mfgr].filter(Boolean).join(' · '))}</div>
      <div class="ytt-foot"><span class="ytt-loc">${x.loc} ${x.level}</span><span class="ytt-qty">${out?'Out of stock':x.qty+' '+x.unit}</span>${tlay==='rows'&&c?`<span class="ytt-step"><b data-tm="${x.id}">−</b><em>${c}</em><b data-tp="${x.id}">+</b></span>`:''}</div></div></div>`}).join('')}</div>
   ${n?`<div class="ytt-cart"><b>${Object.keys(tcart).length} item${Object.keys(tcart).length>1?'s':''} · ${n} pcs</b><button data-tclear>Clear</button><button class="go" data-tgo>Review</button></div>`:''}</div>`;
  T.querySelectorAll('[data-z]').forEach(b=>b.onclick=()=>{tz=b.dataset.z;try{localStorage.setItem('ytestZ',tz)}catch(e){}tRender()});
  T.querySelectorAll('[data-tl]').forEach(b=>b.onclick=()=>{tlay=b.dataset.tl;tRender()});
  T.querySelectorAll('[data-tc]').forEach(b=>b.onclick=()=>{tcat=b.dataset.tc;tRender()});
  T.querySelectorAll('[data-ti]').forEach(c=>c.onclick=e=>{const id=c.dataset.ti;const x=SAMPLE.find(s=>s.id===id);
    if(e.target.dataset.tp){if((tcart[id]||0)<x.qty)tcart[id]=(tcart[id]||0)+1;else toast('Only '+x.qty+' in the yard (sample)');return tRender()}
    if(e.target.dataset.tm){tcart[id]--;if(tcart[id]<=0)delete tcart[id];return tRender()}
    if(!x.qty){toast('Out of stock (sample)');return}if(tcart[id])delete tcart[id];else tcart[id]=1;tRender()});
  const cl=T.querySelector('[data-tclear]');if(cl)cl.onclick=()=>{tcart={};tRender()};const g=T.querySelector('[data-tgo]');if(g)g.onclick=()=>toast('Test only — nothing is checked out');
  T.querySelector('.ytt-scan').onclick=()=>toast('Test only — scanning is off here')}

/* ---------- Version log ---------- */
const V=mk('vlog');let VL=null,vq='';
async function vRender(){if(!VL){V.innerHTML='<h2>Version log</h2><p class="muted">Loading…</p>';try{VL=await (await fetch('changelog.json?v='+((typeof APP_VERSION!=='undefined'?APP_VERSION:Date.now())),{cache:'no-store'})).json()}catch(e){V.innerHTML='<h2>Version log</h2><p class="muted">Could not load the log.</p>';return}}
  const q=vq.toLowerCase();const L=VL.filter(x=>!q||(x.v+' '+x.msg).toLowerCase().includes(q));const by={};L.forEach(x=>{(by[x.v||'?']=by[x.v||'?']||[]).push(x)});
  const days={};Object.entries(by).forEach(([v,a])=>{const d=new Date(a[a.length-1].at).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});(days[d]=days[d]||[]).push([v,a])});
  V.innerHTML=`<div class="vl"><div class="vl-h"><div><h2>Version log</h2><p class="muted">Every update to the app, newest first. Only you see this. Now on <b>${esc(typeof APP_VERSION!=='undefined'?APP_VERSION:'')}</b>.</p></div><input class="search" id="vlq" placeholder="Search changes…" value="${esc(vq)}"></div>
   ${Object.entries(days).map(([d,vs])=>`<div class="vl-day">${esc(d)}</div>${vs.map(([v,a])=>`<div class="vl-v"><div class="vl-num">v${esc(v)}</div><div class="vl-items">${a.map(x=>`<div class="vl-i"><span>${esc(x.msg)}</span><small>${new Date(x.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</small></div>`).join('')}</div></div>`).join('')}`).join('')||'<p class="muted">No matches.</p>'}</div>`;
  const i=V.querySelector('#vlq');i.oninput=()=>{vq=i.value;const p=i.selectionStart;vRender().then(()=>{const n=V.querySelector('#vlq');n.focus();n.setSelectionRange(p,p)})}}

document.head.insertAdjacentHTML('beforeend',`<style>
.ytt{font-size:calc(16px*var(--z))}.ytt h2{font-size:1.4em;margin:0}.ytt .muted{font-size:.8em}
.ytt-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between;margin-bottom:12px}.ytt .viewseg button{font-size:.85em;min-height:calc(40px*var(--z))}
.ytt-row{display:flex;gap:10px;margin-bottom:12px}.ytt-scan{flex:1;display:flex;align-items:center;justify-content:center;gap:10px;min-height:calc(52px*var(--z));border-radius:14px;border:1px solid var(--line);background:var(--chip);color:inherit;font:inherit;font-weight:700}.ytt-scan svg{color:var(--hi,#f26a1b)}
.ytt-chips{display:flex;gap:8px;overflow:auto;margin-bottom:14px}.ytt-chips button{flex:none;min-height:calc(44px*var(--z));padding:0 1em;border-radius:999px;border:1px solid var(--line);background:var(--chip);color:inherit;font:inherit;font-weight:700}.ytt-chips button[aria-pressed=true]{background:var(--hi,#f26a1b);color:var(--hi-ink,#111);border-color:transparent}
.ytt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(calc(170px*var(--z)),46%),1fr));gap:12px}.ytt-list{display:flex;flex-direction:column;gap:8px}
.ytt-card{border:2px solid var(--line);border-radius:14px;background:var(--chip);overflow:hidden;cursor:pointer}.ytt-card.in{border-color:var(--hi,#f26a1b)}.ytt-card.out{opacity:.55}
.ytt-pic{position:relative;height:calc(110px*var(--z));display:flex;align-items:center;justify-content:center;background:#3b4b6b;color:#c9d6f0}
.ytt-body{padding:.6em .7em}.ytt-name{font-weight:800;font-size:1.05em;line-height:1.25}.ytt-sub{opacity:.75;font-size:.85em;margin-top:2px}
.ytt-foot{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-top:.5em}.ytt-loc{font-family:var(--mono,monospace);font-size:.85em;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.08)}.ytt-qty{font-weight:800;font-size:1.05em}
.ytt-list .ytt-card{display:flex}.ytt-list .ytt-body{flex:1}
.ytt-step{display:inline-flex;align-items:center;background:var(--hi,#f26a1b);color:var(--hi-ink,#111);border-radius:999px;height:calc(40px*var(--z));font-size:1.1em}.ytt-pic .ytt-step{position:absolute;top:8px;left:8px}
.ytt-step b{width:calc(40px*var(--z));text-align:center;font-weight:900;cursor:pointer}.ytt-step em{font-style:normal;font-weight:800;min-width:1.4em;text-align:center}
.ytt-cart{position:sticky;bottom:10px;padding-left:72px!important;margin-top:14px;display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:14px;background:#5a2a22;box-shadow:0 6px 20px rgba(0,0,0,.4)}.ytt-cart b{flex:1}.ytt-cart button{min-height:calc(44px*var(--z));font:inherit;font-weight:700;border-radius:10px;padding:0 1em;border:1px solid var(--line);background:var(--chip);color:inherit}.ytt-cart .go{background:var(--hi,#f26a1b);color:var(--hi-ink,#111);border:0;width:auto}
.vl-h{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between;margin-bottom:10px}.vl-h .search{max-width:320px}
.vl-day{margin:18px 0 6px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:13px;opacity:.7}
.vl-v{display:grid;grid-template-columns:70px 1fr;gap:10px;padding:10px 0;border-top:1px solid var(--line)}.vl-num{font-family:var(--mono,monospace);font-weight:800;color:var(--hi,#f26a1b)}
.vl-i{display:flex;gap:10px;justify-content:space-between}.vl-i+.vl-i{margin-top:6px}.vl-i small{opacity:.6;white-space:nowrap}
</style>`);
const ICON_T='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h10"/><path d="M17 15l3 3-3 3"/></svg>';
const ICON_V='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>';
AME.register({id:'ytest',name:'Inventory (Test)',desc:'Big-text preview · sample items only · not saved',allow:own,tabs:['ytest'],section:'tab-ytest',icon:ICON_T,open:()=>{showTab('ytest');tRender()},onShow:tRender});
AME.register({id:'vlog',name:'Version log',desc:'Every app update, newest first',allow:own,tabs:['vlog'],section:'tab-vlog',icon:ICON_V,open:()=>{showTab('vlog');vRender()},onShow:vRender});
})();
