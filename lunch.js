/* AME Lunch — daily office lunch order: pick a restaurant, everyone answers eat / no, see who hasn't answered, one order sheet. */
(function(){
const own=()=>typeof isOwner==='function'&&typeof curUser!=='undefined'&&isOwner(curUser);
const mk=id=>{let s=document.getElementById('tab-'+id);if(!s){s=document.createElement('section');s.id='tab-'+id;s.hidden=true;(document.querySelector('main')||document.body).appendChild(s)}return s};
const S=mk('lunch');let CFG={},DAYS=[],STAFF=[],day=today(),typing=false,chg=false;
const DEF=[['Panda Express','https://www.pandaexpress.com/'],['Chipotle','https://www.chipotle.com/order'],['Chick-fil-A','https://order.chick-fil-a.com/'],['El Pollo Loco','https://order.elpolloloco.com/location/central-ave-moreno-st/menu'],['In-N-Out','https://www.in-n-out.com/menu'],['Mexican Food',''],["Domino's Pizza",'https://www.dominos.com/']].map(([name,url])=>({name,url,menu:[]}));
function today(){const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)}
const rests=()=>CFG.rests&&CFG.rests.length?CFG.rests:DEF;
const people=()=>CFG.people&&CFG.people.length?CFG.people:STAFF.filter(p=>p.wemail&&(p.st||'Active')!=='Inactive').map(p=>p.name);
const D=()=>DAYS.find(x=>x._id===day);
const BUD=()=>CFG.budget!=null&&CFG.budget!==''?+CFG.budget:15;const over=p=>p!=null&&+p>BUD()?+(+p-BUD()).toFixed(2):0;
/* who picks the restaurant & runs the order (Nicole later; for now the owner) */
const orgs=()=>CFG.orgs||[];const isOrg=()=>own()||orgs().includes(curUser);
const mine=n=>isOrg()||n===curUser||n===((STAFF.find(p=>p.short===curUser||p.name===curUser)||{}).name);
const money=v=>v==null||v===''||isNaN(v)?'':'$'+(+v).toFixed(2);
const rerender=()=>{if(AME.cur==='lunch'&&!typing)render()};
(function w(){if(typeof db!=='undefined'&&db&&db.collection){db.doc('config/lunch').onSnapshot(s=>{CFG=s.data()||{};rerender()},()=>{});db.collection('lunch').onSnapshot(s=>{DAYS=s.docs.map(d=>({...d.data(),_id:d.id}));rerender()},()=>{});db.doc('config/staff').onSnapshot(s=>{STAFF=(s.data&&s.data()||{}).list||[];rerender()},()=>{})}else setTimeout(w,400)})();
const ICR='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v7a2 2 0 002 2v9M5 3v5M9 3v5M17 21V3c-2 1-3 4-3 8h3"/></svg>';
/* last order this person had at this restaurant (before the current day) */
function lastAt(name,rest){return DAYS.filter(x=>x.rest===rest&&x._id<day&&x.o&&x.o[name]&&x.o[name].st==='eat'&&x.o[name].item).sort((a,b)=>b._id.localeCompare(a._id))[0]?.o[name]}
function menuFor(rest){const r=rests().find(x=>x.name===rest)||{};const m=new Map();(r.menu||[]).forEach(x=>m.set(x.n,x.p));DAYS.filter(x=>x.rest===rest).forEach(x=>Object.values(x.o||{}).forEach(o=>{if(o.item&&!m.has(o.item))m.set(o.item,o.price)}));return [...m].map(([n,p])=>({n,p}))}
async function save(o){try{await db.doc('lunch/'+day).set({...(D()||{}),...o,_id:undefined,updated:new Date().toISOString(),by:curUser})}catch(e){toast('Could not save: '+(e.message||e))}}
async function setP(name,patch){const d=D();if(!d)return;const o={...(d.o||{})};o[name]={...(o[name]||{}),...patch,at:new Date().toISOString()};d.o=o;await save({o})}

function render(){const d=D();const isT=day===today();
  const nav=`<div class="lnav"><button class="btn small" data-dd="-1" aria-label="Previous day">‹</button><input type="date" id="lDay" value="${day}"><button class="btn small" data-dd="1" aria-label="Next day">›</button>${isT?'':'<button class="btn small" id="lToday">Today</button>'}<span style="flex:1"></span>${isOrg()?'<button class="btn small" id="lRest">Restaurants</button><button class="btn small" id="lPpl">People</button>':''}</div>`;
  S.innerHTML=`<div class="mplhead"><h2>Lunch</h2></div>${nav}${d&&!chg?board(d):isOrg()?start():'<div class="panel"><b>No lunch set for this day yet.</b><br><small class="muted">'+esc(orgs().join(', ')||'The organizer')+' picks the restaurant.</small></div>'}`;
  bind(d)}
function start(){const last=[...DAYS].filter(x=>x.rest).sort((a,b)=>b._id.localeCompare(a._id))[0];
  return `<div class="panel"><h3 style="margin-top:0">Start lunch for ${new Date(day+'T12:00').toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</h3>
  <div class="lrow2"><label class="f">Order by<input type="time" id="lCut" value="${esc(CFG.cut||'09:30')}"></label>${last?`<small class="muted">Last time: ${esc(last.rest)} · ${esc(last._id)}</small>`:''}</div>
  <div class="lrests">${rests().map((r,i)=>`<button class="lrest" data-sr="${i}">${ICR}<b>${esc(r.name)}</b><small>${DAYS.filter(x=>x.rest===r.name).length} times</small></button>`).join('')}</div>
  <p style="margin-bottom:0"><button class="btn" id="lNone">No group lunch today</button></p></div>`}
function board(d){if(d.none)return `<div class="panel"><b>No group lunch on this day.</b> <button class="btn small" id="lUndo">Undo</button></div>`;
  const P=people();const o=d.o||{};const st=n=>(o[n]||{}).st||'';const eat=P.filter(n=>st(n)==='eat'),no=P.filter(n=>st(n)==='no'),out=P.filter(n=>st(n)==='out'),wait=P.filter(n=>!st(n));
  const r=rests().find(x=>x.name===d.rest)||{};const M=menuFor(d.rest);
  const grp={};eat.forEach(n=>{const k=((o[n].item||'(no item yet)')+(o[n].note?' — '+o[n].note:''));(grp[k]=grp[k]||[]).push(n)});
  const tot=eat.reduce((a,n)=>a+(+o[n].price||0),0);
  return `<div class="panel lhead"><div><b class="lrn">${esc(d.rest)}</b>${r.url?` <a href="${esc(r.url)}" target="_blank" rel="noopener">Menu / order online</a>`:''}<br><small class="muted">Order by ${esc(fmtT(d.cut))}${d.closed?' · <b>Closed</b>':''}</small></div>
   <div class="lcnt"><span class="c-eat">${eat.length}<small>Eating</small></span><span class="c-no">${no.length}<small>Not eating</small></span><span class="c-out">${out.length}<small>Out</small></span><span class="c-wait">${wait.length}<small>No answer</small></span></div>
   <div class="lbtns"${isOrg()?'':' hidden'}><button class="btn small" id="lCopyA">Copy Teams message</button>${wait.length?'<button class="btn small" id="lCopyR">Copy reminder</button>':''}${isOrg()?'':'<!--'}<button class="btn small" id="lClose">${d.closed?'Reopen':'Close orders'}</button><button class="btn small" id="lChg">Change restaurant</button>${isOrg()?'':'-->'}</div></div>
  <datalist id="lMenu">${M.map(m=>`<option value="${esc(m.n)}" label="${m.p!=null?money(m.p)+(over(m.p)?' · over $'+BUD():''):''}">`).join('')}</datalist>
  <div class="lgrid"><div class="panel"><h3 style="margin-top:0">People</h3><div class="ltbl">
   <div class="lr lh"><span>Name</span><span>Answer</span><span>Order</span><span>Note</span><span class="n">Price</span><span></span></div>
   ${P.map(n=>{const x=o[n]||{};const s=x.st||'';const L=lastAt(n,d.rest);return `<div class="lr ${s?'s-'+s:'s-wait'}${mine(n)?'':' ro'}" data-n="${esc(n)}"><span><b>${esc(n)}</b></span>
     <span class="lseg">${[['eat','Eat'],['no','No'],['out','Out']].map(([k,t])=>`<button data-st="${esc(n)}|${k}" aria-pressed="${s===k}">${t}</button>`).join('')}</span>
     <span>${s==='eat'?`<input class="lin" list="lMenu" data-it="${esc(n)}" value="${esc(x.item||'')}" placeholder="Item">`:''}${s==='eat'&&L&&L.item!==x.item?`<button class="lsame" data-same="${esc(n)}" title="${esc(L.item)}">Same as last</button>`:''}</span>
     <span>${s==='eat'?`<input class="lin" data-nt="${esc(n)}" value="${esc(x.note||'')}" placeholder="e.g. extra salsa">`:''}</span>
     <span class="n">${s==='eat'?`<input class="lin lpr" inputmode="decimal" data-pr="${esc(n)}" value="${esc(x.price??'')}" placeholder="$">${over(x.price)?`<small class="lover">+${money(over(x.price))} own</small>`:''}`:''}</span>
     <span>${s?`<button class="eqdel" data-clr="${esc(n)}" aria-label="Clear answer" title="Clear answer">×</button>`:''}</span></div>`}).join('')}
   </div></div>
   <div class="panel lsum"><h3 style="margin-top:0">Order sheet</h3>${eat.length?`<div class="lsl">${Object.entries(grp).sort((a,b)=>b[1].length-a[1].length).map(([k,ns])=>`<div><b>${ns.length}×</b> <span>${esc(k)}</span><small class="muted">${esc(ns.join(', '))}</small></div>`).join('')}</div><div class="ltot"><span>${eat.length} meals · subtotal</span><b>${tot?money(tot):''}</b></div>${tot?(()=>{const ov=eat.reduce((a,n)=>a+over(o[n].price),0);return `<div class="ltot2"><span>Company (up to ${money(BUD())} each, before tax)</span><b>${money(tot-ov)}</b></div>${ov?`<div class="ltot2 lover"><span>Over the limit — ${eat.filter(n=>over(o[n].price)).map(n=>esc(n)+' '+money(over(o[n].price))).join(', ')}</span><b>${money(ov)}</b></div>`:''}`})():''}<button class="btn" id="lCopyO" style="width:100%">Copy order sheet</button>`:'<p class="muted">Nobody is eating yet.</p>'}</div></div>`}
const fmtT=t=>{if(!t)return '';const[h,m]=t.split(':');const H=+h;return (H%12||12)+':'+m+(H<12?' AM':' PM')};
async function copy(t){try{await navigator.clipboard.writeText(t);toast('Copied — paste it in Teams')}catch(e){prompt('Copy this:',t)}}
function bind(d){const $=q=>S.querySelector(q);
  S.querySelectorAll('[data-dd]').forEach(b=>b.onclick=()=>{const x=new Date(day+'T12:00');x.setDate(x.getDate()+ +b.dataset.dd);day=x.toISOString().slice(0,10);render()});
  $('#lDay').onchange=e=>{if(e.target.value){day=e.target.value;render()}};const t=$('#lToday');if(t)t.onclick=()=>{day=today();chg=false;render()};
  if(isOrg()){$('#lRest').onclick=restDlg;$('#lPpl').onclick=pplDlg}
  S.querySelectorAll('[data-sr]').forEach(b=>b.onclick=async()=>{const r=rests()[+b.dataset.sr];const cut=($('#lCut')||{}).value||'09:30';const prev=D();chg=false;await save({rest:r.name,cut,none:false,closed:false,o:prev&&prev.o||{}});if(!prev)copyAnn(r.name,cut,true)});
  const nn=$('#lNone');if(nn)nn.onclick=()=>save({none:true});const un=$('#lUndo');if(un)un.onclick=async()=>{await db.doc('lunch/'+day).delete();render()};
  if(!d||d.none)return;if(!isOrg()){S.querySelectorAll('.lr:not(.lh)').forEach(r=>{const n=r.dataset.n;if(n&&!mine(n))r.querySelectorAll('button,input').forEach(x=>x.disabled=true)})}
  S.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{const[n,k]=b.dataset.st.split('|');const cur=((d.o||{})[n]||{}).st;setP(n,{st:cur===k?'':k})});
  S.querySelectorAll('[data-clr]').forEach(b=>b.onclick=()=>{const o={...(d.o||{})};delete o[b.dataset.clr];save({o})});
  S.querySelectorAll('[data-same]').forEach(b=>b.onclick=()=>{const n=b.dataset.same;const L=lastAt(n,d.rest);if(L)setP(n,{item:L.item,note:L.note||'',price:L.price??null})});
  const M=menuFor(d.rest);
  const inp=(sel,f)=>S.querySelectorAll(sel).forEach(i=>{i.onfocus=()=>typing=true;i.onblur=()=>{typing=false;setTimeout(()=>{if(!typing)render()},50)};i.onchange=()=>{const n=i.dataset[f];const v=i.value.trim();const p={};if(f==='it'){p.item=v;const m=M.find(x=>x.n===v);if(m&&m.p!=null&&!((d.o||{})[n]||{}).price)p.price=m.p}else if(f==='nt')p.note=v;else p.price=v===''?null:+String(v).replace(/[$,]/g,'')||null;setP(n,p)}});
  inp('[data-it]','it');inp('[data-nt]','nt');inp('[data-pr]','pr');
  if(!isOrg())return;$('#lCopyA').onclick=()=>copyAnn(d.rest,d.cut);
  const cr=$('#lCopyR');if(cr)cr.onclick=()=>{const w=people().filter(n=>!((d.o||{})[n]||{}).st);copy(`${w.join(', ')} — will you be ordering lunch today? (${d.rest}, order by ${fmtT(d.cut)})`)};
  if(isOrg()){$('#lClose').onclick=()=>save({closed:!d.closed});$('#lChg').onclick=()=>{chg=true;render()}}
  const co=$('#lCopyO');if(co)co.onclick=()=>{const o=d.o||{};const eat=people().filter(n=>(o[n]||{}).st==='eat');copy(`${d.rest} — ${day}\n`+eat.map(n=>`${n}: ${o[n].item||'?'}${o[n].note?' ('+o[n].note+')':''}${o[n].price?' '+money(o[n].price):''}`).join('\n')+`\n\n${eat.length} meals`+(eat.some(n=>o[n].price)?' · '+money(eat.reduce((a,n)=>a+(+o[n].price||0),0)):''))}}
function copyAnn(rest,cut,auto){const r=rests().find(x=>x.name===rest)||{};const t=`Good morning All, today's lunch will be ${rest}. Please send me your selection by ${fmtT(cut)}.${r.url?'\n'+r.url:''}`;if(auto){navigator.clipboard?.writeText(t).then(()=>toast('Lunch started · Teams message copied'),()=>toast('Lunch started'))}else copy(t)}
/* menu editor: paste the menu text from the restaurant's site; lines with prices become items */
function parseMenu(t){const out=[];const ls=t.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);let pend='';
  for(const l of ls){const m=l.match(/\$\s*(\d{1,3}(?:\.\d{2})?)|(?:^|\s)(\d{1,3}\.\d{2})(?:\s|$)/);const p=m?+(m[1]||m[2]):null;const name=l.replace(/\$\s*\d{1,3}(?:\.\d{2})?|(?:^|\s)\d{1,3}\.\d{2}(?=\s|$)/g,'').replace(/\b\d{2,4}\s*cal\b.*$/i,'').replace(/[|•·\-–]+\s*$/,'').trim();
    if(p!=null&&name.length>1){out.push({n:name,p});pend=''}else if(p!=null&&pend){out.push({n:pend,p});pend=''}else if(p==null&&!/^\d+\s*cal/i.test(l)&&l.length<70)pend=l}
  const seen=new Set();return out.filter(x=>{const k=x.n.toLowerCase();if(seen.has(k))return false;seen.add(k);return true})}
function menuDlg(r,back){let M=(r.menu||[]).map(x=>({...x}));
  const draw=()=>{document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>Menu · ${esc(r.name||'')}</h3>
   <p class="muted" style="margin-top:0">${r.url?`Open <a href="${esc(r.url)}" target="_blank" rel="noopener">the online menu</a>, select the items (Ctrl+A), copy, and paste below.`:'Paste the menu text below.'} Lines with a price become items. Over ${money(BUD())} shows in red.</p>
   <textarea id="mP" rows="4" style="width:100%;box-sizing:border-box;padding:8px;font:inherit" placeholder="Classic Tostada  $13.18&#10;2pc Chicken Meal  $11.49"></textarea>
   <div class="bar" style="justify-content:flex-start"><button class="btn" id="mAdd">Add from pasted text</button><button class="btn" id="mOne">+ Add item</button>${M.length?'<button class="btn dng" id="mClr">Clear all</button>':''}</div>
   <div class="lml">${M.map((m,i)=>`<div class="lmr${over(m.p)?' ov':''}"><input data-mn="${i}" value="${esc(m.n)}" placeholder="Item"><input data-mp="${i}" inputmode="decimal" value="${esc(m.p??'')}" placeholder="$"><button class="eqdel" data-mx="${i}" aria-label="Remove">×</button></div>`).join('')||'<p class="muted">No items yet.</p>'}</div>
   <div class="bar"><button class="btn" id="mC">Back</button><button class="go" id="mS" style="width:auto">Done</button></div></div></div>`;
   const rd=()=>M.forEach((m,i)=>{m.n=document.querySelector(`[data-mn="${i}"]`).value.trim();const v=document.querySelector(`[data-mp="${i}"]`).value.trim().replace(/[$,]/g,'');m.p=v===''?null:+v});
   document.getElementById('mAdd').onclick=()=>{rd();const add=parseMenu(document.getElementById('mP').value);if(!add.length){toast('No prices found in that text.');return}const have=new Set(M.map(m=>m.n.toLowerCase()));let n=0;add.forEach(a=>{if(!have.has(a.n.toLowerCase())){M.push(a);n++}else{const e=M.find(m=>m.n.toLowerCase()===a.n.toLowerCase());e.p=a.p}});draw();toast(n+' items added')};
   document.getElementById('mOne').onclick=()=>{rd();M.unshift({n:'',p:null});draw();document.querySelector('[data-mn="0"]').focus()};
   const cl=document.getElementById('mClr');if(cl)cl.onclick=()=>{if(confirm('Remove all menu items?')){M=[];draw()}};
   document.querySelectorAll('[data-mx]').forEach(b=>b.onclick=()=>{rd();M.splice(+b.dataset.mx,1);draw()});
   document.getElementById('mC').onclick=back;document.getElementById('mS').onclick=()=>{rd();r.menu=M.filter(m=>m.n);back();toast('Menu updated — press Save to keep it')}};draw()}
function restDlg(){let L=rests().map(r=>({...r,menu:[...(r.menu||[])]}));
  const draw=()=>{document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>Restaurants</h3><div class="lrl">${L.map((r,i)=>`<div class="lrr"><input data-rn="${i}" value="${esc(r.name)}" placeholder="Name"><input data-ru="${i}" value="${esc(r.url||'')}" placeholder="Online order link (optional)"><button type="button" class="btn small" data-rm="${i}">Menu${(r.menu||[]).length?' · '+r.menu.length:''}</button><button class="eqdel" data-rx="${i}" aria-label="Remove">×</button></div>`).join('')}</div>
   <label class="f" style="margin-top:12px;max-width:320px">Company pays per person, before tax ($)<input id="rB" inputmode="decimal" value="${esc(CFG.budget??15)}"></label>
   <p class="muted">Menu: paste it from the restaurant's site, or let it fill in from what people order.</p><div class="bar" style="justify-content:flex-start"><button class="btn" id="rA">+ Add restaurant</button></div><div class="bar"><button class="btn" id="rC">Cancel</button><button class="go" id="rS" style="width:auto">Save</button></div></div></div>`;
   const rd=()=>L.forEach((r,i)=>{r.name=document.querySelector(`[data-rn="${i}"]`).value.trim();r.url=document.querySelector(`[data-ru="${i}"]`).value.trim()});
   document.getElementById('rA').onclick=()=>{rd();L.push({name:'',url:'',menu:[]});draw()};document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{rd();menuDlg(L[+b.dataset.rm],()=>draw())});document.querySelectorAll('[data-rx]').forEach(b=>b.onclick=()=>{rd();L.splice(+b.dataset.rx,1);draw()});
   document.getElementById('rC').onclick=closeDlg;document.getElementById('rS').onclick=async()=>{rd();const bv=document.getElementById('rB').value.trim();await db.doc('config/lunch').set({...CFG,rests:L.filter(r=>r.name),budget:bv===''?15:+bv.replace(/[$,]/g,'')||15});closeDlg();toast('Saved')}};draw()}
function pplDlg(){const cur=new Set(people());const all=[...new Set([...STAFF.filter(p=>(p.st||'Active')!=='Inactive').map(p=>p.name),...cur])].sort();
  document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>Who orders lunch</h3><p class="muted" style="margin-top:0">${cur.size} checked</p><input id="pQ" placeholder="Search…" style="width:100%;padding:8px;margin-bottom:8px;box-sizing:border-box"><div class="lppl">${all.map(n=>`<label><input type="checkbox" value="${esc(n)}" ${cur.has(n)?'checked':''}> ${esc(n)}</label>`).join('')}</div>
   <div class="lrr" style="margin-top:8px"><input id="pAdd" placeholder="Add a name not in Staff"></div>${own()?`<h3 style="margin:14px 0 4px">Lunch organizers</h3><p class="muted" style="margin:0 0 6px">They pick the restaurant, remind people, close orders and edit lists. Everyone else only picks their own meal. You always can.</p><input id="pOrg" list="pOrgL" value="${esc(orgs().join(', '))}" placeholder="e.g. Nicole D." style="width:100%;padding:8px;box-sizing:border-box"><datalist id="pOrgL">${all.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`:''}<div class="bar"><button class="btn" id="pC">Cancel</button><button class="go" id="pS" style="width:auto">Save</button></div></div></div>`;
  document.getElementById('pQ').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.lppl label').forEach(l=>l.hidden=!l.textContent.toLowerCase().includes(q))};
  document.getElementById('pC').onclick=closeDlg;document.getElementById('pS').onclick=async()=>{const L=[...document.querySelectorAll('.lppl input:checked')].map(i=>i.value);const a=document.getElementById('pAdd').value.trim();if(a)L.push(a);const og=document.getElementById('pOrg');const O=og?og.value.split(',').map(x=>x.trim()).filter(Boolean):orgs();await db.doc('config/lunch').set({...CFG,people:L.sort(),orgs:O});closeDlg();toast('Saved')}}

document.head.insertAdjacentHTML('beforeend',`<style>
#tab-lunch{max-width:1200px;margin:0 auto}.lnav{display:flex;gap:6px;align-items:center;margin-bottom:12px;flex-wrap:wrap}.lnav input[type=date]{padding:6px 8px;font:inherit}
.lrow2{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px}.lrow2 input{padding:8px;font:inherit}
.lrests{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}.lrest{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:14px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:inherit;font:inherit;text-align:left;cursor:pointer}.lrest:hover{border-color:var(--hi,#f47b20)}.lrest svg{color:var(--hi,#f47b20)}.lrest small{color:var(--muted)}
.lhead{display:grid;grid-template-columns:1fr auto;gap:10px 16px;align-items:center}.lrn{font-size:20px}.lbtns{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}
.lcnt{display:flex;gap:6px}.lcnt span{display:flex;flex-direction:column;align-items:center;min-width:70px;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,.04);font-size:22px;font-weight:800;line-height:1.1}.lcnt small{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
.c-eat{color:#3fb950}.c-no{color:var(--muted)}.c-out{color:#8aa4ff}.c-wait{color:#e8594a}
.lgrid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:12px;align-items:start}
.ltbl{display:grid}.lr{display:grid;grid-template-columns:150px 150px minmax(0,1fr) minmax(0,.8fr) 80px 30px;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid var(--line)}.lr.lh{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}.lr .n{text-align:right}
.lr.s-wait b{color:#e8594a}.lr.ro input,.lr.ro .lseg{opacity:.55}.lr.s-no,.lr.s-out{opacity:.6}
.lseg{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden}.lseg button{border:0;background:none;color:inherit;font:inherit;font-size:13px;font-weight:700;padding:6px 10px;cursor:pointer}.lseg button+button{border-left:1px solid var(--line)}.lseg button[aria-pressed=true]{background:var(--hi,#f47b20);color:#fff}
.lin{width:100%;box-sizing:border-box;padding:6px 8px;font:inherit;font-size:14px}.lpr{text-align:right}.lsame{margin-top:3px;border:0;background:none;color:var(--hi,#f47b20);font:inherit;font-size:12px;font-weight:700;cursor:pointer;padding:0}
.lsl{display:grid;gap:8px}.lsl div{display:grid;grid-template-columns:34px 1fr;gap:0 6px}.lsl small{grid-column:2}.lover{color:#e8594a;font-weight:700}.lr small.lover{display:block;font-size:11px;text-align:right}.ltot2{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin:-4px 0 8px}.lml{display:grid;gap:4px;max-height:45vh;overflow:auto;margin-top:8px}.lmr{display:grid;grid-template-columns:1fr 90px 30px;gap:6px}.lmr input{padding:7px;font:inherit;min-width:0}.lmr.ov input[data-mp]{color:#e8594a;font-weight:700}.lrr{grid-template-columns:1fr 1.4fr auto 30px!important}.ltot{display:flex;justify-content:space-between;border-top:1px solid var(--line);margin:10px 0;padding-top:8px}
.lrl{display:grid;gap:6px}.lrr{display:grid;grid-template-columns:1fr 1.4fr 30px;gap:6px}.lrr input{padding:8px;font:inherit;min-width:0}.lppl{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 12px;max-height:50vh;overflow:auto}
@media(max-width:900px){.lgrid{grid-template-columns:1fr}.lhead{grid-template-columns:1fr}.lr{grid-template-columns:1fr auto;grid-auto-rows:auto}.lr.lh{display:none}.lr>span:nth-child(3),.lr>span:nth-child(4){grid-column:1/-1}.lr>span:nth-child(5){grid-column:1}.lcnt span{min-width:0;flex:1}}
</style>`);
const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v7a2 2 0 002 2v9M5 3v5M9 3v5"/><path d="M17 21V3c-2 1-3 4-3 8h3"/></svg>';
AME.register({id:'lunch',ownerOnly:true,name:'Lunch',desc:'Today’s restaurant · who’s eating · one order sheet',allow:own,tabs:['lunch'],section:'tab-lunch',icon:ICON,open:()=>{showTab('lunch');day=today();render()},onShow:render});
})();
