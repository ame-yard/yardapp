/* AME Dispatch — daily crew dispatch per job site. Jobs keep their foreman + crew from day to day;
   PMs adjust the day, then send it (email / Teams / app bell). Staff directory comes from the
   Field Employees Contact workbook (imported in the app — no personal data lives in this file). */
(function(){
const sec=document.getElementById('tab-dsp');
let S=[],DAY={},STAFF=[],CFG={},LEAVE=[],view='day',date=today(),q='',fltSite='active';
const LV=['FM','SFM','JM','A7','A6','A5','A4','A3','A2','A1'];
const lvRank=l=>{const i=LV.indexOf(l);return i<0?99:i};
const PIC_COL={'Jin Yang':'#f2b705','Fred Barra':'#7b4bb7','Kyle Kim':'#8bc34a','Don Seo':'#5fc3c9','Suji Ham':'#e66aa8'};
const picCol=n=>PIC_COL[n]||'#9aa0a6';
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const addD=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const code=s=>s.slice(2,4)+s.slice(5,7)+s.slice(8,10);
const dLabel=s=>new Date(s+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const canEdit=()=>{try{return !!(isAdmin||(typeof can==='function'&&can('DISPATCH')))}catch(e){return false}};
const E=s=>esc(s==null?'':String(s));
const sid=()=>Math.random().toString(36).slice(2,10);
const jno=n=>String(n||'').replace(/^#/,'');
const person=n=>STAFF.find(p=>p.name===n)||STAFF.find(p=>p.short===n||(p.alias||[]).includes(n));
/* match a schedule name ("Sergio Cerna") to a staff record ("Sergio Cerna Galvez") */
function matchStaff(raw){const n=raw.trim().toLowerCase();if(!n)return null;let p=STAFF.find(x=>x.name.toLowerCase()===n||(x.short||'').toLowerCase()===n);if(p)return p;
  const w=n.replace(/[.,]/g,'').split(/\s+/);const c=STAFF.filter(x=>{const v=x.name.toLowerCase().replace(/[.,]/g,'').split(/\s+/);return w.every(t=>v.includes(t))});return c.length===1?c[0]:null}
const lvOf=n=>(person(n)||{}).lv||'';
const short=n=>{const p=person(n);return p&&p.short||n};
window.ameStaff=()=>STAFF;window.ameStaffFind=person;

(function w(){if(typeof db!=='undefined'&&db&&db.collection){
  db.collection('dsites').onSnapshot(s=>{S=s.docs.map(d=>({...d.data(),_id:d.id}));if(AME.cur==='dsp')render()},()=>{});
  db.collection('dday').onSnapshot(s=>{DAY={};s.docs.forEach(d=>DAY[d.id]=d.data());if(AME.cur==='dsp')render()},()=>{});
  db.doc('config/staff').onSnapshot(s=>{STAFF=(s.data&&s.data()||{}).list||[];if(AME.cur==='dsp')render()},()=>{});
  db.collection('dleave').onSnapshot(s=>{LEAVE=s.docs.map(d=>({...d.data(),_id:d.id}));if(AME.cur==='dsp')render()},()=>{});
  db.doc('config/dispatch').onSnapshot(s=>{CFG=(s.data&&s.data())||{};if(AME.cur==='dsp')render()},()=>{});
}else setTimeout(w,400)})();

/* ---------- time off ---------- */
const LT=['Time off','Vacation','Sick','Personal','Injury','Other'];
const offOn=(n,d)=>LEAVE.find(l=>l.n===n&&l.from<=d&&(l.to||l.from)>=d);
const offList=d=>LEAVE.filter(l=>l.from<=d&&(l.to||l.from)>=d);
/* ---------- day model ---------- */
const activeOn=(s,d)=>(s.status||'Active')==='Active'&&(!s.start||s.start<=d)&&(!s.end||s.end>=d)&&(!s.asg||!s.asg.length||s.asg.some(a=>a.from<=d&&a.to>=d));
const sortCrew=c=>[...c].sort((a,b)=>lvRank(lvOf(a.n))-lvRank(lvOf(b.n)));
function rowsFor(d){const day=DAY[d]||{};const R=day.rows||{};
  return S.filter(s=>R[s._id]?!R[s._id].off:activeOn(s,d)).sort((a,b)=>jno(a.no).localeCompare(jno(b.no),undefined,{numeric:true}))
    .map(s=>{const r=R[s._id];const asg=s.asg&&s.asg.length?s.asg.filter(a=>a.from<=d&&a.to>=d).reduce((o,a)=>o.some(x=>x.n===a.n)?o:[...o,{n:a.n,...(a.t?{t:a.t}:{})}],[]):null;return {s,crew:sortCrew((r&&r.crew)||asg||s.crew||[]),note:(r&&r.note!=null)?r.note:(s.note||''),own:!!r}})}
function whereIs(d,n){return rowsFor(d).filter(r=>r.crew.some(c=>c.n===n)).map(r=>r.s)}
async function saveRow(d,site,crew,extra,keepDef){const day=DAY[d]||{};const rows={...(day.rows||{})};rows[site._id]={...(rows[site._id]||{}),crew,...(extra||{})};
  await db.doc('dday/'+d).set({...day,rows,rev:(day.rev||0),editAt:new Date().toISOString(),editBy:curUser});
  if(d>=today()&&!keepDef)await db.doc('dsites/'+site._id).update({crew,updated:new Date().toISOString()}).catch(()=>{})}
const changed=d=>{const day=DAY[d];if(!day||!day.sent)return false;return JSON.stringify(snap(d))!==JSON.stringify(day.sent.snap||{})};
const snap=d=>{const o={};rowsFor(d).forEach(r=>o[r.s._id]=r.crew.map(c=>(c.t||'')+'|'+c.n));return o};

/* ---------- render ---------- */
function render(){if(!sec)return;const ed=canEdit();
  const seg=`<div class="viewseg" style="margin-bottom:12px">${[['day','Dispatch'],['gantt','Schedule'],['sites','Jobs'],['staff','Staff']].map(([k,l])=>`<button data-dv="${k}" aria-pressed="${view===k}">${l}</button>`).join('')}</div>`;
  if(view==='gantt')return renderGantt(seg,ed);if(view==='sites')return renderSites(seg,ed);if(view==='staff')return renderStaff(seg,ed);
  const rows=rowsFor(date);const day=DAY[date]||{};const sent=day.sent;const ch=changed(date);
  const used=new Set(rows.flatMap(r=>r.crew.map(c=>c.n)));const dup=new Set();{const seen=new Set();rows.forEach(r=>r.crew.forEach(c=>{if(seen.has(c.n))dup.add(c.n);seen.add(c.n)}))}
  const OFF=offList(date);const free=STAFF.filter(p=>p.st==='Active'&&p.cls!=='Office'&&!used.has(p.name)&&!offOn(p.name,date)).sort((a,b)=>lvRank(a.lv)-lvRank(b.lv)||a.name.localeCompare(b.name));
  const total=rows.reduce((a,r)=>a+r.crew.length,0);
  const prevSent=sent&&sent.snap||{};
  sec.innerHTML=`<div class="mplhead"><h2>Dispatch</h2>${ed?`<span class="mtop"><button class="btn pri" id="dsSend">${sent?(ch?'Send update':'Sent ✓'):'Send dispatch'}</button></span>`:''}</div>${seg}
   <div class="dsdate"><button class="btn" data-dd="-1" aria-label="Previous day">‹</button><label><input type="date" id="dsD" value="${date}"><b>${dLabel(date)}</b><small class="muted">${code(date)} Dispatch</small></label><button class="btn" data-dd="1" aria-label="Next day">›</button>${date!==today()?'<button class="btn small" id="dsToday">Today</button>':''}</div>
   <div class="dsstat">${sent?`<span class="pill ${ch?'p-needs':'p-good'}">${ch?'Changed since sent':'Sent'}</span><small class="muted">${E(sent.by)} · ${E(fmtD(sent.at))} ${new Date(sent.at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}${sent.rev>1?' · revision '+sent.rev:''}</small>`:'<span class="pill">Not sent yet</span>'}<small class="muted" style="margin-left:auto">${rows.length} job${rows.length===1?'':'s'} · ${total} people</small></div>
   <input id="dsQ" class="search" placeholder="Find a person or job…" value="${E(q)}">
   <div class="dswrap"><div class="dsmain"><div id="dsRows">${rows.length?'':`<div class="panel muted">No jobs on this day.${ed?' Add or reopen jobs in the <b>Jobs</b> tab.':''}</div>`}${rows.map(r=>{const s=r.s;const was=prevSent[s._id];const fm=r.crew.find(c=>['FM','SFM'].includes(lvOf(c.n)));
     return `<div class="panel dscard" data-site="${s._id}"><div class="dsh"><b class="dsno">${E(jno(s.no))}</b><span class="dsnm">${E(s.name||'')}</span>${s.isNew?'<span class="pill p-needs">New</span>':''}</div>
      <div class="dsmeta">${s.sys?`<span>${E(s.sys)}</span>`:''}${s.pic?`<span class="dspic" style="--c:${picCol(s.pic)}">${E(s.pic)}</span>`:''}<span class="muted">Crew ${r.crew.length}</span></div>
      <div class="dscrew">${r.crew.map(c=>{const l=lvOf(c.n);const nw=sent&&was&&!was.some(x=>x.split('|')[1]===c.n);return `<button type="button" class="dschip${['FM','SFM'].includes(l)?' fm':''}${dup.has(c.n)?' dup':''}${nw?' nw':''}${offOn(c.n,date)?' off':''}" data-cn="${E(c.n)}" ${ed?'':'disabled'}>${c.t?`<i>${E(c.t)}</i>`:''}${E(short(c.n))}${l?`<em>${E(l)}</em>`:''}${offOn(c.n,date)?`<em class="offb">${E(offOn(c.n,date).type||'Off')}</em>`:''}</button>`}).join('')}${ed?`<button type="button" class="dschip add" data-add="${s._id}">+ Add</button>`:''}</div>
      ${sent&&was?(()=>{const gone=was.map(x=>x.split('|')[1]).filter(n=>!r.crew.some(c=>c.n===n));return gone.length?`<small class="dsgone">Removed since sent: ${gone.map(n=>E(short(n))).join(', ')}</small>`:''})():''}
      ${r.note?`<p class="dsnote">${E(r.note)}</p>`:''}${ed?`<button type="button" class="btn small dsnb" data-note="${s._id}">${r.note?'Edit note':'+ Note'}</button>`:''}</div>`}).join('')}</div>
   </div><aside class="dsside"><div class="panel dsoff"><div class="dsoffh"><b>Time off</b><span class="muted">${OFF.length?OFF.length+' off this day':'Nobody off'}</span>${ed?'<button type="button" class="btn small" id="dsLv" style="margin-left:auto">+ Time off</button>':''}</div>${OFF.length?`<div class="dscrew" style="margin-top:8px">${OFF.map(l=>`<button type="button" class="dschip off" data-lv="${l._id}" ${ed?'':'disabled'}>${E(short(l.n))}<em class="offb">${E(l.type||'Off')}</em><small class="muted">${l.to&&l.to!==l.from?E(fmtD(l.from))+'–'+E(fmtD(l.to)):''}</small></button>`).join('')}</div>`:''}</div>
   ${ed&&free.length?`<details class="panel dsfree" ${innerWidth>=900?'open':''}><summary><b>Not dispatched</b> <span class="muted">${free.length} active field people</span></summary><div class="dscrew">${free.map(p=>`<button type="button" class="dschip" data-free="${E(p.name)}">${E(short(p.name))}<em>${E(p.lv||'')}</em></button>`).join('')}</div></details>`:''}</aside></div>
   ${!STAFF.length?`<div class="panel muted">No staff list yet.${ed?' Open <b>Staff</b> and import the Field Employees Contact workbook.':''}</div>`:''}`;
  bindCommon();
  const go=n=>{date=addD(date,n);render()};sec.querySelectorAll('[data-dd]').forEach(b=>b.onclick=()=>go(+b.dataset.dd));
  {const t=sec.querySelector('#dsToday');if(t)t.onclick=()=>{date=today();render()}}
  sec.querySelector('#dsD').onchange=e=>{if(e.target.value){date=e.target.value;render()}};
  const qi=sec.querySelector('#dsQ');qi.oninput=()=>{q=qi.value;filt()};filt();
  if(window.ameSwipe&&!('ontouchstart' in window)){}
  {let x0=null;const R=sec.querySelector('#dsRows');R.addEventListener('touchstart',e=>{if(e.target.closest('.dschip'))return;x0=e.touches[0].clientX},{passive:true});R.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>90)go(dx<0?1:-1)})}
  if(!ed)return;
  sec.querySelector('#dsSend').onclick=()=>sendDlg();
  {const b=sec.querySelector('#dsLv');if(b)b.onclick=()=>leaveDlg()}
  sec.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>leaveDlg(LEAVE.find(l=>l._id===b.dataset.lv)));
  sec.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>pick(S.find(s=>s._id===b.dataset.add)));
  sec.querySelectorAll('[data-cn]').forEach(b=>b.onclick=()=>b._dr?(b._dr=0):chipMenu(S.find(s=>s._id===b.closest('[data-site]').dataset.site),b.dataset.cn));
  sec.querySelectorAll('[data-free]').forEach(b=>b.onclick=()=>b._dr?(b._dr=0):toJob(b.dataset.free));
  dragSetup();
  sec.querySelectorAll('[data-note]').forEach(b=>b.onclick=async()=>{const s=S.find(x=>x._id===b.dataset.note);const r=rowsFor(date).find(x=>x.s._id===s._id);const v=prompt('Note for '+jno(s.no)+' on '+dLabel(date)+' (shows in the dispatch):',r.note||'');if(v==null)return;await saveRow(date,s,r.crew,{note:v.trim()})})}
/* drag a person chip onto another job (mouse, iPad, phone: hold then drag) */
function dragSetup(){sec.querySelectorAll('[data-cn],[data-free]').forEach(ch=>{ch.style.touchAction='manipulation';
  ch.addEventListener('pointerdown',e=>{if(e.button)return;const n=ch.dataset.cn||ch.dataset.free;const from=ch.closest('[data-site]');const x0=e.clientX,y0=e.clientY;let on=false,gh=null,tgt=null,tm=null;
    const start=()=>{on=true;ch._dr=1;ch.classList.add('dragsrc');gh=ch.cloneNode(true);gh.className='dschip dsghost';document.body.appendChild(gh);document.body.classList.add('dsdragging');mv(e)};
    const hit=(x,y)=>{gh.style.display='none';const el=document.elementFromPoint(x,y);gh.style.display='';return el&&(el.closest('.dscard')||el.closest('.dsside'))};
    const mv=ev=>{if(!on){if(e.pointerType==='mouse'&&Math.hypot(ev.clientX-x0,ev.clientY-y0)>6)start();else if(e.pointerType!=='mouse'&&Math.hypot(ev.clientX-x0,ev.clientY-y0)>10)cleanup();return}
      gh.style.left=ev.clientX+'px';gh.style.top=ev.clientY+'px';const t=hit(ev.clientX,ev.clientY);if(t!==tgt){tgt&&tgt.classList.remove('droph');tgt=t;tgt&&tgt.classList.add('droph')}
      const H=innerHeight;if(ev.clientY<70)scrollBy(0,-12);else if(ev.clientY>H-70)scrollBy(0,12)};
    const tmv=ev=>{if(on)ev.preventDefault()};
    const up=async ev=>{const t=on&&hit(ev.clientX,ev.clientY);const was=on;cleanup();if(!was)return;setTimeout(()=>ch._dr=0,350);
      if(!t)return;if(t.classList.contains('dsside')){if(from){const s=S.find(x=>x._id===from.dataset.site);const r=rowsFor(date).find(x=>x.s._id===s._id);await saveRow(date,s,r.crew.filter(c=>c.n!==n));toast(short(n)+' taken off '+jno(s.no))}return}
      const to=S.find(x=>x._id===t.dataset.site);if(!to||(from&&from.dataset.site===to._id))return;const o=offOn(n,date);if(o&&!confirm(short(n)+' is off ('+(o.type||'time off')+'). Add anyway?'))return;await moveTo(n,to);toast(short(n)+' → '+jno(to.no))};
    function cleanup(){clearTimeout(tm);removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',cleanup);removeEventListener('touchmove',tmv);gh&&gh.remove();tgt&&tgt.classList.remove('droph');ch.classList.remove('dragsrc');document.body.classList.remove('dsdragging');on=false}
    addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',()=>{if(!on)cleanup()});addEventListener('touchmove',tmv,{passive:false});
    if(e.pointerType!=='mouse')tm=setTimeout(()=>{start();try{navigator.vibrate&&navigator.vibrate(15)}catch(x){}},320)})})}
function filt(){const t=q.trim().toLowerCase();sec.querySelectorAll('.dscard').forEach(c=>{if(!t){c.hidden=false;c.querySelectorAll('.dschip').forEach(x=>x.classList.remove('hit'));return}
  const s=S.find(x=>x._id===c.dataset.site);const jobHit=(jno(s.no)+' '+(s.name||'')+' '+(s.pic||'')).toLowerCase().includes(t);let any=false;
  c.querySelectorAll('[data-cn]').forEach(x=>{const h=x.dataset.cn.toLowerCase().includes(t);x.classList.toggle('hit',h);any=any||h});c.hidden=!(jobHit||any)})}
function bindCommon(){sec.querySelectorAll('[data-dv]').forEach(b=>b.onclick=()=>{view=b.dataset.dv;render();scrollTo({top:0})})}

/* ---------- crew editing ---------- */
function dlg(html){document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg">${html}</div></div>`;return document.querySelector('#dlgRoot .dlg')}
async function moveTo(n,site,tag){const rows=rowsFor(date);for(const r of rows){if(r.s._id!==site._id&&r.crew.some(c=>c.n===n))await saveRow(date,r.s,r.crew.filter(c=>c.n!==n))}
  const r=rows.find(x=>x.s._id===site._id);const crew=(r?r.crew:[]).filter(c=>c.n!==n);const old=r&&r.crew.find(c=>c.n===n);crew.push({n,t:tag!=null?tag:(old&&old.t)||''});await saveRow(date,site,sortCrew(crew))}
function pick(site){let t='';let lv='';const d=dlg(`<h3>Add to ${E(jno(site.no))} · ${E(site.name||'')}</h3><input id="pkQ" class="search" placeholder="Search name…" autocomplete="off"><div class="viewseg" id="pkL" style="margin:8px 0;flex-wrap:wrap">${['','FM','JM','A'].map(k=>`<button data-l="${k}" aria-pressed="${k===''}">${k||'All'}${k==='A'?'pprentice':''}</button>`).join('')}</div><div id="pkList" class="dspick"></div><div class="bar"><button class="btn" id="pkC">Done</button></div>`);
  const draw=()=>{const rows=rowsFor(date);const at=n=>rows.filter(r=>r.crew.some(c=>c.n===n)).map(r=>r.s);const here=new Set((rows.find(r=>r.s._id===site._id)||{crew:[]}).crew.map(c=>c.n));
    const L=STAFF.filter(p=>p.cls!=='Office'&&p.st!=='Inactive'&&(!t||p.name.toLowerCase().includes(t)||(p.short||'').toLowerCase().includes(t))&&(!lv||(lv==='FM'?['FM','SFM'].includes(p.lv):lv==='A'?/^A\d/.test(p.lv||''):p.lv===lv)))
      .sort((a,b)=>(a.st==='Active'?0:1)-(b.st==='Active'?0:1)||(at(a.name).length?1:0)-(at(b.name).length?1:0)||lvRank(a.lv)-lvRank(b.lv)||a.name.localeCompare(b.name));
    d.querySelector('#pkList').innerHTML=L.map(p=>{const w=at(p.name);const h=here.has(p.name);return `<button type="button" class="dsprow${h?' on':''}" data-pn="${E(p.name)}"><b>${E(short(p.name))}</b><em>${E(p.lv||'')}</em>${p.st!=='Active'?`<small class="muted">${E(p.st)}</small>`:''}<small class="muted" style="margin-left:auto">${offOn(p.name,date)?'<b style="color:#ff8a80">Off · '+E(offOn(p.name,date).type||'')+'</b> ':''}${h?'On this job ✓':w.length?'On '+E(w.map(s=>jno(s.no)).join(', ')):'Free'}</small></button>`}).join('')||'<p class="muted">Nobody found. Check the Staff tab.</p>';
    d.querySelectorAll('[data-pn]').forEach(b=>b.onclick=async()=>{const n=b.dataset.pn;if(here.has(n)){const r=rowsFor(date).find(x=>x.s._id===site._id);await saveRow(date,site,r.crew.filter(c=>c.n!==n))}else{const o=offOn(n,date);if(o&&!confirm(short(n)+' is off ('+(o.type||'time off')+') on this day. Add anyway?'))return;const w=at(n);if(w.length&&!confirm(short(n)+' is on '+w.map(s=>jno(s.no)).join(', ')+'. Move to '+jno(site.no)+'?'))return;await moveTo(n,site)}setTimeout(draw,150)})};
  d.querySelector('#pkQ').oninput=e=>{t=e.target.value.trim().toLowerCase();draw()};d.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{lv=b.dataset.l;d.querySelectorAll('[data-l]').forEach(x=>x.setAttribute('aria-pressed',x===b));draw()});
  d.querySelector('#pkC').onclick=closeDlg;draw()}
function chipMenu(site,n){const r=rowsFor(date).find(x=>x.s._id===site._id);const c=r.crew.find(x=>x.n===n)||{};const p=person(n)||{};const others=rowsFor(date).filter(x=>x.s._id!==site._id);
  const d=dlg(`<h3>${E(short(n))} <small class="muted">${E(p.lv||'')}</small></h3>${p.cell||p.email?`<p class="dscontact dsinfo">${p.cell?`<span><b>Phone</b> ${E(p.cell)}</span>`:''}${p.email?`<span><b>Email</b> ${E(p.email)}</span>`:''}</p>`:''}
   <label class="f wide">Crew code <small class="muted">(e.g. 03 — shows before the name)</small><input id="cmT" value="${E(c.t||'')}" maxlength="4" inputmode="numeric"></label>
   <label class="f wide">Move to job<select id="cmM"><option value="">— stay on ${E(jno(site.no))} —</option>${others.map(x=>`<option value="${x.s._id}">${E(jno(x.s.no))} · ${E(x.s.name||'')}</option>`).join('')}</select></label>
   <div class="bar"><button class="btn dng" id="cmR">Remove from job</button><button class="btn" id="cmC">Cancel</button><button class="go" id="cmS" style="width:auto">Save</button></div>`);
  d.querySelector('#cmC').onclick=closeDlg;
  d.querySelector('#cmR').onclick=async()=>{await saveRow(date,site,r.crew.filter(x=>x.n!==n));closeDlg();toast(short(n)+' removed from '+jno(site.no))};
  d.querySelector('#cmS').onclick=async()=>{const t=d.querySelector('#cmT').value.trim();const m=d.querySelector('#cmM').value;
    if(m){await moveTo(n,S.find(s=>s._id===m),t);toast(short(n)+' moved')}else{await saveRow(date,site,r.crew.map(x=>x.n===n?{...x,t}:x))}closeDlg()}}
function toJob(n){const rows=rowsFor(date);if(!rows.length){toast('No jobs on this day');return}
  const d=dlg(`<h3>Send ${E(short(n))} to…</h3><div class="dspick">${rows.map(r=>`<button type="button" class="dsprow" data-tj="${r.s._id}"><b>${E(jno(r.s.no))}</b><span>${E(r.s.name||'')}</span><small class="muted" style="margin-left:auto">Crew ${r.crew.length}</small></button>`).join('')}</div><div class="bar"><button class="btn" id="tjC">Cancel</button></div>`);
  d.querySelector('#tjC').onclick=closeDlg;d.querySelectorAll('[data-tj]').forEach(b=>b.onclick=async()=>{await moveTo(n,S.find(s=>s._id===b.dataset.tj));closeDlg();toast(short(n)+' → '+jno(S.find(s=>s._id===b.dataset.tj).no))})}

function leaveDlg(l,who){const nw=!l;l=l||{n:who||'',type:'Vacation',from:date,to:date};const L=STAFF.filter(p=>p.cls!=='Office'&&p.st!=='Inactive').sort((a,b)=>short(a.name).localeCompare(short(b.name)));
  const d=dlg(`<h3>${nw?'Add time off':'Time off'}</h3>
   <label class="f wide">Person<input id="lvN" list="lvNL" value="${E(l.n?short(l.n):'')}" autocomplete="off" placeholder="Type a name…"><datalist id="lvNL">${L.map(p=>`<option value="${E(short(p.name))}">${E(p.lv||'')}</option>`).join('')}</datalist></label>
   <label class="f wide">Type<select id="lvT">${LT.map(t=>`<option ${t===l.type?'selected':''}>${t}</option>`).join('')}</select></label>
   <div style="display:flex;gap:10px"><label class="f" style="flex:1">From<input type="date" id="lvF" value="${E(l.from)}"></label><label class="f" style="flex:1">To<input type="date" id="lvTo" value="${E(l.to||l.from)}"></label></div>
   <label class="f wide">Note<input id="lvO" value="${E(l.note||'')}" placeholder="optional"></label>
   <p class="muted" style="font-size:13px">They’re taken off any job on these days and won’t show as free to dispatch.</p>
   <div class="bar">${nw?'':'<button class="btn dng" id="lvD">Delete</button>'}<button class="btn" id="lvC">Cancel</button><button class="go" id="lvS" style="width:auto">Save</button></div>`);
  d.querySelector('#lvC').onclick=closeDlg;{const x=d.querySelector('#lvD');if(x)x.onclick=async()=>{await db.doc('dleave/'+l._id).delete();closeDlg();toast('Time off removed')}}
  d.querySelector('#lvS').onclick=async()=>{const v=d.querySelector('#lvN').value.trim();const p=STAFF.find(x=>short(x.name).toLowerCase()===v.toLowerCase()||x.name.toLowerCase()===v.toLowerCase());if(!p){toast('Pick a name from the list');return}
    const from=d.querySelector('#lvF').value,to=d.querySelector('#lvTo').value||from;if(!from||to<from){toast('Check the dates');return}
    const o={n:p.name,type:d.querySelector('#lvT').value,from,to,note:d.querySelector('#lvO').value.trim(),by:curUser,at:new Date().toISOString()};
    await db.doc('dleave/'+(nw?sid():l._id)).set(o);
    let moved=0;for(let x=from;x<=to&&moved<400;x=addD(x,1)){if(!DAY[x]&&x!==date)continue;for(const r of rowsFor(x)){if(r.crew.some(c=>c.n===p.name)){await saveRow(x,r.s,r.crew.filter(c=>c.n!==p.name),null,true);moved++}}}
    closeDlg();toast(short(p.name)+' off '+fmtD(from)+(to!==from?'–'+fmtD(to):'')+(moved?' · taken off '+moved+' job day(s)':''))}}
/* ---------- send ---------- */
const DEF_TO=[];
function tableHTML(d){const rows=rowsFor(d);const th='border:1px solid #999;padding:4px 8px;font:13px Calibri,Arial;text-align:left;vertical-align:middle;background:#f2f2f2';const td='border:1px solid #999;padding:4px 8px;font:13px Calibri,Arial;vertical-align:middle';
  return `<table style="border-collapse:collapse"><tr><th style="${th}">Task Name</th><th style="${th}">Roof System</th><th style="${th}">PIC</th><th style="${th}">New Project (Y/N)</th><th style="${th}">Crew Size</th><th style="${th}">Resource Names</th></tr>${rows.map(r=>`<tr><td style="${td}">${E(jno(r.s.no))}-${E(r.s.name||'')}</td><td style="${td}">${E(r.s.sys||'')}</td><td style="${td};text-align:center">${E(r.s.pic||'')}</td><td style="${td};text-align:center">${r.s.isNew?'Y':'N'}</td><td style="${td};text-align:center">${r.crew.length}</td><td style="${td}">${r.note?`<span style="color:#1f5fbf">** ${E(r.note)}</span><br>`:''}${r.crew.map(c=>`${c.t?E(c.t)+' ':''}${E(short(c.n))}_${E(lvOf(c.n)||'')}`).join('<br>')}</td></tr>`).join('')}${offList(d).length?`<tr><td style="${td}" colspan="5"><b>Time off</b></td><td style="${td}">${offList(d).map(l=>E(short(l.n))+' ('+E(l.type||'Off')+')').join('<br>')}</td></tr>`:''}</table>`}
function textTable(d){return (offList(d).length?'Time off: '+offList(d).map(l=>short(l.n)+' ('+(l.type||'Off')+')').join(', ')+'\n\n':'')+rowsFor(d).map(r=>`${jno(r.s.no)}-${r.s.name||''} · ${r.s.sys||''} · PIC ${r.s.pic||''}${r.s.isNew?' · NEW':''} · Crew ${r.crew.length}\n`+(r.note?'  ** '+r.note+'\n':'')+r.crew.map(c=>`  ${c.t?c.t+' ':''}${short(c.n)}_${lvOf(c.n)}`).join('\n')).join('\n\n')}
function sendDlg(){const day=DAY[date]||{};const rev=day.sent?(day.sent.rev||1)+1:1;const subj=(rev>1?'Revised ':'')+code(date)+' Dispatch';
  const to=(CFG.to&&CFG.to.length?CFG.to:DEF_TO).join('; ');const me=(person(curUser)||STAFF.find(p=>short(p.name)===curUser)||{});
  const intro=rev>1?`Hello All,\n\nHere is the revised dispatch for ${code(date)}. Thank you.`:`Hello All,\n\nHere is the dispatch for ${code(date)}. Thank you.`;
  const d=dlg(`<h3>${rev>1?'Send revised dispatch':'Send dispatch'} · ${dLabel(date)}</h3>
   <label class="f wide">To <small class="muted">(separate with ;)</small><textarea id="sdTo" rows="3">${E(to)}</textarea></label>
   <label class="f wide">Subject<input id="sdSub" value="${E(subj)}"></label>
   <label class="f wide">Message<textarea id="sdMsg" rows="4">${E(intro)}</textarea></label>
   <details><summary class="muted">Preview the table</summary><div class="dsprev">${tableHTML(date)}</div></details>
   <label class="chk"><input type="checkbox" id="sdMail" checked> Email it from my Outlook</label>
   <label class="chk"><input type="checkbox" id="sdTeams" ${CFG.teams!==false?'checked':''}> Post to the Teams chat</label>
   <label class="chk"><input type="checkbox" id="sdBell" checked> App bell + phone alert for everyone</label>
   <div class="bar"><button class="btn" id="sdCopy">Copy table only</button><button class="btn" id="sdC">Cancel</button><button class="go" id="sdS" style="width:auto">Send</button></div>`);
  d.querySelector('#sdC').onclick=closeDlg;
  d.querySelector('#sdCopy').onclick=async()=>{await copyHTML(tableHTML(date),textTable(date));toast('Table copied — paste it into Outlook')};
  d.querySelector('#sdS').onclick=async e=>{const b=e.target;b.disabled=true;b.textContent='Sending…';const toL=d.querySelector('#sdTo').value.split(/[;,\s]+/).map(x=>x.trim()).filter(x=>/@/.test(x));const sub=d.querySelector('#sdSub').value.trim();const msg=d.querySelector('#sdMsg').value.trim();
    const html=`<div style="font:14px Calibri,Arial">${E(msg).replace(/\n/g,'<br>')}</div><br>${tableHTML(date)}<br><div style="font:14px Calibri,Arial">${E(curUser||'')}</div>`;const res=[];
    if(d.querySelector('#sdMail').checked){try{if(!window.ameMail)throw new Error('mail');await window.ameMail(toL,sub,html);res.push('Email sent')}catch(err){await copyHTML(html,msg+'\n\n'+textTable(date));location.href='mailto:'+encodeURIComponent(toL.join(';'))+'?subject='+encodeURIComponent(sub);res.push('Email couldn’t send from the app — the dispatch is copied, paste it into the new Outlook email')}}
    if(d.querySelector('#sdTeams').checked){try{const c=await db.doc('config/trucks').get();const hook=((c.data&&c.data())||{}).hook;if(hook){await fetch(hook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'message',attachments:[{contentType:'application/vnd.microsoft.card.adaptive',content:{type:'AdaptiveCard',version:'1.4',$schema:'http://adaptivecards.io/schemas/adaptive-card.json',body:[{type:'TextBlock',weight:'Bolder',size:'Medium',text:sub},{type:'TextBlock',wrap:true,text:textTable(date).replace(/\n/g,'\n\n')}]}}]})});res.push('Posted to Teams')}else res.push('No Teams chat connected')}catch(err){res.push('Teams post failed')}}
    const now=new Date().toISOString();
    if(d.querySelector('#sdBell').checked){try{await db.collection('logs').add({ts:now,action:'DISPATCH',name:sub,by:curUser,note:rowsFor(date).length+' jobs · '+rowsFor(date).reduce((a,r)=>a+r.crew.length,0)+' people',dsp:date})}catch(err){}}
    await db.doc('dday/'+date).set({...(DAY[date]||{}),rows:Object.fromEntries(rowsFor(date).map(r=>[r.s._id,{...((DAY[date]||{}).rows||{})[r.s._id],crew:r.crew,note:r.note}])),sent:{at:now,by:curUser,rev,snap:snap(date)}});
    try{await db.doc('config/dispatch').set({...CFG,to:toL,teams:d.querySelector('#sdTeams').checked})}catch(err){}
    closeDlg();toast(res.join(' · ')||'Saved')}}
async function copyHTML(html,text){try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})])}catch(e){try{await navigator.clipboard.writeText(text)}catch(x){}}}

/* ---------- schedule (Gantt) ---------- */
let gz=(()=>{try{return +localStorage.getItem('dsGz')||7}catch(e){return 7}})(),gShowOld=false;
const dn=s=>Math.round(new Date(s+'T12:00:00')/864e5);const fromN=n=>{const d=new Date(n*864e5);return d.toISOString().slice(0,10)};
const crewNames=s=>{const a=s.asg&&s.asg.length?[...new Map(s.asg.map(x=>[x.n,x])).values()]:(s.crew||[]);return sortCrew(a).map(c=>(c.t?c.t+' ':'')+short(c.n)+(lvOf(c.n)?'_'+lvOf(c.n):''))};
function renderGantt(seg,ed){const T=dn(today());const ppd=gz;
  const jobs=S.filter(s=>(s.status||'Active')!=='Done'&&s.start&&(gShowOld||!s.end||dn(s.end)>=T-14)).sort((a,b)=>(a.start||'').localeCompare(b.start||'')||jno(a.no).localeCompare(jno(b.no),undefined,{numeric:true}));
  const lv=LEAVE.filter(l=>dn(l.to||l.from)>=T-14).sort((a,b)=>a.from.localeCompare(b.from));
  const all=[...jobs.map(s=>[dn(s.start),dn(s.end||s.start)]),...lv.map(l=>[dn(l.from),dn(l.to||l.from)])];
  let a=Math.min(T-14,...all.map(x=>x[0]));if(!gShowOld)a=Math.max(a,T-28);a-=((new Date(a*864e5).getUTCDay()+6)%7);const b=Math.max(T+120,...all.map(x=>x[1]))+14;const W=(b-a)*ppd;
  const x=n=>(n-a)*ppd;
  let hdr='';for(let n=a;n<=b;n++){const d=new Date(n*864e5);if(d.getUTCDate()===1||(n===a&&d.getUTCDate()<22))hdr+=`<span class="gm" style="left:${x(n)}px">${d.toLocaleDateString('en-US',{month:'short',year:'2-digit',timeZone:'UTC'})}</span>`;if(d.getUTCDay()===1&&ppd>=4)hdr+=`<span class="gw" style="left:${x(n)}px">${d.getUTCDate()}</span>`}
  let grid='';for(let n=a;n<=b;n++){const d=new Date(n*864e5);if(d.getUTCDay()===1)grid+=`<i style="left:${x(n)}px"></i>`}
  const bar=(s0,e0,col,lab,cls)=>`<div class="gbar ${cls||''}" style="left:${x(s0)}px;width:${Math.max(ppd,(e0-s0+1)*ppd)}px;--c:${col}"></div>${lab?`<span class="glab" style="left:${x(e0+1)+6}px">${E(lab)}</span>`:''}`;
  const row=(left,right,attrs)=>`<div class="grow" ${attrs||''}><div class="gl">${left}</div><div class="gr" style="width:${W}px">${grid}${right}</div></div>`;
  const leaveRows=lv.length?row(`<b class="gno">000</b><span class="gnm">Time off</span>`,bar(Math.min(...lv.map(l=>dn(l.from))),Math.max(...lv.map(l=>dn(l.to||l.from))),'#e53935','',' gsum'),'')+lv.map(l=>row(`<span class="gnm gind">${E(short(l.n))}</span><span class="gsm">${E(l.type||'')}</span>`,bar(dn(l.from),dn(l.to||l.from),'#5fc3c9',short(l.n)+(lvOf(l.n)?'_'+lvOf(l.n):''),' ghatch'),ed?`data-glv="${l._id}"`:'')).join(''):'';
  const jobRows=jobs.map(s=>{const cn=crewNames(s);return row(`<b class="gno">${E(jno(s.no))}</b><span class="gnm">${E(s.name||'')}</span><span class="gsys">${E(s.sys||'')}</span><span class="gpic" style="--c:${s.pic?picCol(s.pic):'transparent'}">${E(s.pic||'')}</span><span class="gnew${s.isNew?' y':''}">${s.isNew?'Y':'N'}</span><span class="gcs">${cn.length}</span><span class="gdt">${E(fmtD(s.start))} – ${E(fmtD(s.end||s.start))}</span>`,
     `<span class="gtitle" style="left:${x(dn(s.start))}px">${E(jno(s.no)+'-'+(s.name||''))}</span>`+bar(dn(s.start),dn(s.end||s.start),s.pic?picCol(s.pic):'#9aa0a6',cn.join(', ')),`data-gs="${s._id}"`)}).join('');
  sec.innerHTML=`<div class="mplhead"><h2>Dispatch</h2></div>${seg}
   <div class="gtools"><div class="viewseg">${[[3,'Months'],[7,'Weeks'],[16,'Days']].map(([k,l])=>`<button data-gz="${k}" aria-pressed="${gz===k}">${l}</button>`).join('')}</div><button class="btn small" id="gToday">Today</button><label class="chk" style="margin:0"><input type="checkbox" id="gOld" ${gShowOld?'checked':''}> Past jobs</label><span class="gleg">${Object.entries(PIC_COL).map(([n,c])=>`<span class="dspic" style="--c:${c}">${E(n)}</span>`).join('')}</span></div>
   <div class="gwrap" id="gWrap"><div class="ghead"><div class="gl"><b class="gno">#</b><span class="gnm"><b>Task Name</b></span><span class="gsys">Roof System</span><span class="gpic">PIC</span><span class="gnew">New</span><span class="gcs">Crew</span><span class="gdt">Dates</span></div><div class="gr gh" style="width:${W}px">${hdr}</div></div>
    <div class="gbody">${leaveRows}${jobRows||'<div class="panel muted" style="margin:10px">No jobs. Import MS Project or add jobs in the Jobs tab.</div>'}<div class="gnow" style="left:calc(var(--glw) + ${x(T)+ppd/2}px)"></div></div></div>`;
  bindCommon();const wr=sec.querySelector('#gWrap');
  const toToday=()=>{wr.scrollLeft=Math.max(0,x(T)-140)};requestAnimationFrame(toToday);
  sec.querySelectorAll('[data-gz]').forEach(b=>b.onclick=()=>{gz=+b.dataset.gz;try{localStorage.setItem('dsGz',gz)}catch(e){}render()});
  sec.querySelector('#gToday').onclick=toToday;sec.querySelector('#gOld').onchange=e=>{gShowOld=e.target.checked;render()};
  sec.querySelectorAll('[data-gs]').forEach(r=>r.onclick=()=>{const s=S.find(x=>x._id===r.dataset.gs);if(ed)siteDlg(s);else{date=s.start>today()?s.start:today();view='day';render()}});
  sec.querySelectorAll('[data-glv]').forEach(r=>r.onclick=()=>leaveDlg(LEAVE.find(l=>l._id===r.dataset.glv)))}
/* ---------- jobs ---------- */
function renderSites(seg,ed){const L=S.filter(s=>fltSite==='all'||(fltSite==='active'?(s.status||'Active')==='Active':(s.status||'Active')!=='Active')).sort((a,b)=>jno(a.no).localeCompare(jno(b.no),undefined,{numeric:true}));
  sec.innerHTML=`<div class="mplhead"><h2>Dispatch</h2>${ed?'<span class="mtop"><button class="btn" id="dsMpp">Import MS Project</button><button class="btn pri" id="dsNew">+ Add job</button></span>':''}</div>${seg}<input type="file" id="dsMppF" accept=".xml" hidden>
   <div class="viewseg" style="margin-bottom:12px">${[['active','Active'],['done','On hold / Done'],['all','All']].map(([k,l])=>`<button data-sf="${k}" aria-pressed="${fltSite===k}">${l}</button>`).join('')}</div>
   <div class="mplcards">${L.map(s=>`<button class="mplcard dvc" data-se="${s._id}"><span class="dvh"><b>${E(jno(s.no))} · ${E(s.name||'')}</b>${(s.status||'Active')!=='Active'?`<span class="pill">${E(s.status)}</span>`:''}</span><small class="muted">${[s.sys,s.pic,(s.crew||[]).length+' crew',s.start?('from '+fmtD(s.start)):'',s.end?('to '+fmtD(s.end)):''].filter(Boolean).map(E).join(' · ')}</small></button>`).join('')||'<div class="panel muted">No jobs here.</div>'}</div>`;
  bindCommon();sec.querySelectorAll('[data-sf]').forEach(b=>b.onclick=()=>{fltSite=b.dataset.sf;render()});
  {const n=sec.querySelector('#dsNew');if(n)n.onclick=()=>siteDlg()}
  {const b=sec.querySelector('#dsMpp'),f=sec.querySelector('#dsMppF');if(b){b.onclick=()=>{toast('In MS Project: File → Save As → XML format, then pick that file');f.click()};f.onchange=()=>f.files[0]&&importMSP(f.files[0])}}
  sec.querySelectorAll('[data-se]').forEach(b=>b.onclick=()=>ed?siteDlg(S.find(s=>s._id===b.dataset.se)):null);
  if(ed)sec.querySelectorAll('[data-se]').forEach(b=>window.ameSwipe&&ameSwipe(b,'Done',async()=>{const s=S.find(x=>x._id===b.dataset.se);if(!confirm('Mark '+jno(s.no)+' as Done? It stops showing on the dispatch from today.'))return;await db.doc('dsites/'+s._id).update({status:'Done',end:s.end&&s.end<today()?s.end:addD(today(),-1)});toast(jno(s.no)+' done')}))}
function siteDlg(s){const nw=!s;s=s||{status:'Active',start:date,isNew:true,crew:[]};const pics=[...new Set([...Object.keys(PIC_COL),...STAFF.filter(p=>p.cls==='Office'&&p.st==='Active').map(p=>p.name),...S.map(x=>x.pic).filter(Boolean)])];
  const sp=(typeof SPJ!=='undefined'&&SPJ.jobs)||[];const SYS=['Single Ply','BUR','Coating','Waterproofing','BUR & Waterproofing','Single Ply & Painting','SSMR','Sheet Metal','Repair','Tile','Shingle'];
  const d=dlg(`<h3>${nw?'Add job to dispatch':'Edit '+E(jno(s.no))}</h3>
   <label class="f wide">Job #<input id="seN" list="seL" value="${E(s.no||'')}" autocomplete="off" data-jobno><datalist id="seL">${sp.filter(x=>x.active!==false).map(x=>`<option value="#${E(x.no)}">${E(x.name||'')}</option>`).join('')}</datalist></label>
   <label class="f wide">Job name<input id="seM" value="${E(s.name||'')}"></label>
   <label class="f wide">Roof system<input id="seY" list="seYL" value="${E(s.sys||'')}"><datalist id="seYL">${SYS.map(x=>`<option value="${E(x)}">`).join('')}</datalist></label>
   <label class="f wide">PIC<select id="seP"><option value="">—</option>${pics.map(p=>`<option ${p===s.pic?'selected':''}>${E(p)}</option>`).join('')}</select></label>
   <div style="display:flex;gap:10px"><label class="f" style="flex:1">Start<input type="date" id="seS" value="${E(s.start||'')}"></label><label class="f" style="flex:1">End <small class="muted">(blank = ongoing)</small><input type="date" id="seE" value="${E(s.end||'')}"></label></div>
   <label class="f wide">Status<select id="seT">${['Active','On hold','Done'].map(x=>`<option ${x===(s.status||'Active')?'selected':''}>${x}</option>`).join('')}</select></label>
   <label class="chk"><input type="checkbox" id="seW" ${s.isNew?'checked':''}> New project</label>
   <div class="bar">${!nw&&isOwner(curUser)?'<button class="btn dng" id="seD">Delete</button>':''}<button class="btn" id="seC">Cancel</button><button class="go" id="seO" style="width:auto">Save</button></div>`);
  const ni=d.querySelector('#seN');ni.onchange=()=>{const x=sp.find(j=>'#'+j.no===ni.value||j.no===ni.value.replace(/^#/,''));const m=d.querySelector('#seM');if(x&&!m.value)m.value=x.name||''};
  d.querySelector('#seC').onclick=closeDlg;{const x=d.querySelector('#seD');if(x)x.onclick=async()=>{if(!confirm('Delete '+jno(s.no)+' from dispatch? Past dispatches keep their crew list.'))return;await db.doc('dsites/'+s._id).delete();closeDlg()}}
  d.querySelector('#seO').onclick=async()=>{const o={no:jno(d.querySelector('#seN').value.trim()),name:d.querySelector('#seM').value.trim(),sys:d.querySelector('#seY').value.trim(),pic:d.querySelector('#seP').value,start:d.querySelector('#seS').value,end:d.querySelector('#seE').value,status:d.querySelector('#seT').value,isNew:d.querySelector('#seW').checked,updated:new Date().toISOString(),by:curUser};
    if(!o.no){toast('Job # is needed');return}if(nw)await db.doc('dsites/'+sid()).set({...o,crew:[]});else await db.doc('dsites/'+s._id).update(o);closeDlg();toast('Saved')}}

/* ---------- MS Project (XML) import ---------- */
function importMSP(file){const rd=new FileReader();rd.onload=async()=>{try{
  const x=new DOMParser().parseFromString(rd.result,'application/xml');if(x.querySelector('parsererror'))throw new Error('Not an XML file — in MS Project use File → Save As → XML format');
  const g=(el,t)=>{const c=el.getElementsByTagName(t)[0];return c?c.textContent:''};const day=v=>String(v||'').slice(0,10);
  const T={},order=[];for(const t of x.getElementsByTagName('Task')){const uid=g(t,'UID');const ex={};for(const e of t.getElementsByTagName('ExtendedAttribute'))ex[g(e,'FieldID')]=g(e,'Value');T[uid]={uid,name:g(t,'Name').trim(),lvl:+g(t,'OutlineLevel')||0,start:day(g(t,'Start')),end:day(g(t,'Finish')),sum:g(t,'Summary')==='1',ex};order.push(uid)}
  const FA={};for(const e of x.querySelectorAll('Project>ExtendedAttributes>ExtendedAttribute'))FA[g(e,'FieldID')]=(g(e,'Alias')||'').toLowerCase();
  const fid=re=>Object.keys(FA).filter(k=>re.test(FA[k]));const fSys=fid(/roof/),fNew=fid(/new project/),fPic=[...fid(/^pic$/),'188743750'];
  const exv=(t,ids)=>{for(const i of ids){const v=(t.ex||{})[i];if(v)return v.trim()}return ''};
  /* each task belongs to the nearest job heading above it ("404-Rancho …") */
  let job=null;const stack=[];for(const uid of order){const t=T[uid];while(stack.length&&stack[stack.length-1].lvl>=t.lvl)stack.pop();stack.push(t);const j=[...stack].reverse().find(a=>/^\d{3}/.test(a.name));t.job=j||null}
  const R={};for(const r of x.getElementsByTagName('Resource')){const nm=g(r,'Name').trim();if(nm)R[g(r,'UID')]=nm}
  const parseRes=raw=>{const m=raw.match(/^(\d{1,2})\s+(.*)$/);let t='',rest=raw;if(m){t=m[1].padStart(2,'0');rest=m[2]}const mm=rest.match(/^(.*?)_([A-Za-z0-9]+)$/);const nm=(mm?mm[1]:rest).trim(),lv=mm?mm[2].toUpperCase():'';const p=matchStaff(nm);return {n:p?p.name:nm,t,lv,known:!!p}};
  const jobs={},leave=[],unk=new Set();
  for(const a of x.getElementsByTagName('Assignment')){const t=T[g(a,'TaskUID')];const rn=R[g(a,'ResourceUID')];if(!t||!rn||!t.job)continue;const pr=parseRes(rn);if(!pr.known)unk.add(pr.n);
    const from=day(g(a,'Start'))||t.start,to=day(g(a,'Finish'))||t.end;if(!from)continue;
    if(/time.?off/i.test(t.job.name)){leave.push({n:pr.n,type:/sick/i.test(t.name)?'Sick':/vac/i.test(t.name)?'Vacation':'Time off',from,to,note:(t.name===t.job.name||matchStaff(t.name))?'':t.name});continue}
    const k=t.job.uid;(jobs[k]=jobs[k]||{t:t.job,asg:[]}).asg.push({n:pr.n,...(pr.t?{t:pr.t}:{}),from,to})}
  const J=Object.values(jobs).filter(j=>j.asg.length);
  if(!J.length)throw new Error('No jobs found (tasks named like “404-Job name”)');
  const msg=`Import ${J.length} jobs and ${J.reduce((a,j)=>a+j.asg.length,0)} crew assignments${leave.length?' + '+leave.length+' time-off entries':''}?`+(unk.size?`\n\n${unk.size} name(s) aren’t in the staff list yet (they still import): ${[...unk].slice(0,8).join(', ')}${unk.size>8?'…':''}`:'')+'\n\nJobs with the same # are updated; days you already changed by hand stay as they are.';
  if(!confirm(msg))return;
  for(const j of J){const m=j.t.name.match(/^([\d ]+?)\s*-\s*(.*)$/);const no=m?m[1].trim():j.t.name,name=m?m[2].trim():'';const id='mp'+no.replace(/\s+/g,'_');const old=S.find(s=>s._id===id)||S.find(s=>jno(s.no)===no);
    const from=j.asg.length?j.asg.reduce((a,b)=>b.from<a?b.from:a,j.asg[0].from):j.t.start,to=j.asg.length?j.asg.reduce((a,b)=>b.to>a?b.to:a,j.asg[0].to):j.t.end;
    const sys=exv(j.t,fSys),pic=exv(j.t,fPic),nwv=exv(j.t,fNew);
    const o={no,name:old&&old.name||name,asg:j.asg,start:from,end:to,status:old&&old.status||'Active',src:'msp',updated:new Date().toISOString(),by:curUser,...(sys?{sys}:{}),...(pic?{pic}:{}),...(nwv?{isNew:/^y/i.test(nwv)}:{})};
    if(old)await db.doc('dsites/'+old._id).update(o);else await db.doc('dsites/'+id).set({sys:'',pic:'',isNew:false,crew:[],...o})}
  for(const l of leave){const id='mpl_'+(l.n+'_'+l.from).replace(/[^\w]+/g,'_');await db.doc('dleave/'+id).set({...l,by:curUser,at:new Date().toISOString(),src:'msp'})}
  toast(J.length+' jobs imported');view='day';render()}catch(e){toast('Import failed: '+(e.message||e))}};rd.readAsText(file)}
/* ---------- staff directory ---------- */
let stQ='',stF='Active',stS=(()=>{try{return localStorage.getItem('dsStS')||'lv'}catch(e){return 'lv'}})(),stD=1;
const STS={name:['Name',p=>short(p.name).toLowerCase()],emp:['Emp #',p=>+p.emp||1e9],lv:['Level',p=>lvRank(p.lv)+(p.lv==='Office'?50:0)],cls:['Classification',p=>(p.cls||'~').toLowerCase()],st:['Status',p=>['Active','On hold','Inactive'].indexOf(p.st)]};
function renderStaff(seg,ed){const own=isOwner(curUser);if(!own&&stF==='Inactive')stF='Active';const L=STAFF.filter(p=>(own||p.st!=='Inactive')&&(stF==='All'||p.st===stF)&&(!stQ||(p.name+' '+(p.short||'')+' '+(p.lv||'')+' '+(p.cls||'')+' #'+(p.emp||'')+' '+(p.cell||'')).toLowerCase().includes(stQ.toLowerCase()))).sort((a,b)=>{if((a.st==='Inactive')!==(b.st==='Inactive'))return (a.st==='Inactive')-(b.st==='Inactive');const f=STS[stS][1];const x=f(a),y=f(b);return (x<y?-1:x>y?1:0)*stD||short(a.name).localeCompare(short(b.name))});
  sec.innerHTML=`<div class="mplhead"><h2>Dispatch</h2>${ed?'<span class="mtop"><button class="btn" id="stImp">Import Excel</button></span>':''}</div>${seg}
   <div class="viewseg" style="margin-bottom:10px">${(own?['Active','On hold','Inactive','All']:['Active','On hold','All']).map(k=>`<button data-stf="${k}" aria-pressed="${stF===k}" ${k==='Inactive'?'class="dsinact"':''}>${k}${k!=='All'?' · '+STAFF.filter(p=>p.st===k).length:''}</button>`).join('')}</div>
   <div class="stsort"><input id="stQ" class="search" placeholder="Search name, #, level, phone…" value="${E(stQ)}"><label class="muted">Sort<select id="stS">${Object.entries(STS).map(([k,[l]])=>`<option value="${k}" ${k===stS?'selected':''}>${l}</option>`).join('')}</select></label><button type="button" class="btn small" id="stD" aria-label="Reverse order">${stD>0?'↑':'↓'}</button></div><div class="dssrow dsshead"><span class="dsemp">Emp #</span><div class="dssn"><b>Name</b></div><span class="dscls">Class</span><em class="dslv">Level</em><span class="dssc"></span></div>
   <div class="dsstaff">${L.map(p=>`<div class="dssrow${p.st==='Inactive'?' inact':''}" data-sp="${E(p.name)}"><span class="dsemp">${E(p.emp||'')}</span><div class="dssn"><b>${E(p.short||p.name)}</b>${p.short?`<small class="muted">${E(p.name)}</small>`:''}</div><span class="dscls">${E(p.cls||'')}</span><em class="dslv">${E(p.lv||'')}${p.st==='Inactive'?' · Inactive':''}${p.st==='On hold'?' · Hold':''}</em><span class="dssc">${p.cell?`<span class="dsph">${E(p.cell)}</span>`:''}${p.email?`<span class="dsem">${E(p.email)}</span>`:''}</span></div>`).join('')||'<div class="panel muted">'+(STAFF.length?'Nobody matches.':'No staff yet. Tap Import Excel and pick the AME Field Employees Contact file.')+'</div>'}</div>
   <input type="file" id="stF" accept=".xlsx,.xls" hidden>`;
  {const ss=sec.querySelector('#stS');ss.onchange=()=>{stS=ss.value;stD=1;try{localStorage.setItem('dsStS',stS)}catch(e){}render()};sec.querySelector('#stD').onclick=()=>{stD=-stD;render()};sec.querySelectorAll('.dsshead').forEach(h=>h.onclick=null)}
  bindCommon();sec.querySelectorAll('[data-stf]').forEach(b=>b.onclick=()=>{stF=b.dataset.stf;render()});
  const qi=sec.querySelector('#stQ');qi.oninput=()=>{stQ=qi.value;const p=qi.selectionStart;render();const n=sec.querySelector('#stQ');n.focus();try{n.setSelectionRange(p,p)}catch(e){}};
  sec.querySelectorAll('[data-sp]').forEach(r=>r.onclick=e=>{if(e.target.closest('a'))return;staffDlg(person(r.dataset.sp),ed)});
  {const b=sec.querySelector('#stImp');if(b){const f=sec.querySelector('#stF');b.onclick=()=>f.click();f.onchange=()=>f.files[0]&&importXL(f.files[0])}}}
function staffDlg(p,ed){if(!p)return;const sk=Object.entries(p.skills||{}),ct=Object.entries(p.certs||{});
  const d=dlg(`<h3>${E(p.name)}</h3><p class="muted" style="margin-top:0">${E([p.lv,p.cls,p.st,p.emp?'Emp #'+p.emp:''].filter(Boolean).join(' · '))}</p>
   <p class="dscontact dsinfo">${p.cell?`<span><b>Phone</b> ${E(p.cell)}</span>`:''}${p.email?`<span><b>Email</b> ${E(p.email)}</span>`:''}</p>
   ${sk.length?`<h4 style="margin:12px 0 4px">Skills</h4><p>${sk.map(([k,v])=>`<span class="pill">${E(k)}: ${E(v)}</span>`).join(' ')}</p>`:''}
   ${ct.length?`<h4 style="margin:12px 0 4px">Training</h4><p>${ct.map(([k,v])=>`<span class="pill">${E(k)}${v&&v!=='Yes'?' · '+E(v):''}</span>`).join(' ')}</p>`:''}
   ${(()=>{const L=LEAVE.filter(l=>l.n===p.name&&(l.to||l.from)>=today()).sort((a,b)=>a.from.localeCompare(b.from));return `<h4 style="margin:12px 0 4px">Time off</h4>${L.length?L.map(l=>`<p style="margin:2px 0">${E(l.type)} · ${E(fmtD(l.from))}${l.to!==l.from?' – '+E(fmtD(l.to)):''}${l.note?' · '+E(l.note):''}</p>`).join(''):'<p class="muted" style="margin:2px 0">None coming up</p>'}${ed?'<button type="button" class="btn small" id="spLv">+ Time off</button>':''}`})()}
   ${(()=>{const w=whereIs(today(),p.name);return w.length?`<p><b>Today:</b> ${w.map(s=>E(jno(s.no)+' · '+(s.name||''))).join(', ')}</p>`:''})()}
   ${ed?`<label class="f wide">Name on dispatch <small class="muted">(short name)</small><input id="spS" value="${E(p.short||'')}" placeholder="${E(p.name)}"></label><label class="f wide">Level<select id="spL">${[...LV,'Office',''].map(l=>`<option ${l===(p.lv||'')?'selected':''}>${l}</option>`).join('')}</select></label><label class="f wide">Status<select id="spT">${['Active','On hold','Inactive'].map(l=>`<option ${l===p.st?'selected':''}>${l}</option>`).join('')}</select></label>`:''}
   <div class="bar"><button class="btn" id="spC">${ed?'Cancel':'Close'}</button>${ed?'<button class="go" id="spO" style="width:auto">Save</button>':''}</div>`);
  d.querySelector('#spC').onclick=closeDlg;{const b=d.querySelector('#spLv');if(b)b.onclick=()=>leaveDlg(null,p.name)}{const o=d.querySelector('#spO');if(o)o.onclick=async()=>{const list=STAFF.map(x=>x.name===p.name?{...x,short:d.querySelector('#spS').value.trim(),lv:d.querySelector('#spL').value,st:d.querySelector('#spT').value}:x);await db.doc('config/staff').set({list,updated:new Date().toISOString(),by:curUser});closeDlg();toast('Saved')}}}
function importXL(file){if(!window.XLSX){toast('Excel reader still loading — try again in a moment');return}const rd=new FileReader();rd.onload=async()=>{try{
  const wb=XLSX.read(rd.result,{type:'array',cellDates:true});const ws=wb.Sheets['Emp List']||wb.Sheets[wb.SheetNames[0]];const A=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
  const hi=A.findIndex(r=>r&&r.includes('Name')&&r.some(x=>/Emp/.test(String(x||''))));if(hi<0)throw new Error('Could not find the header row (Emp #, Name, …)');const H=A[hi].map(x=>String(x||'').trim());const col=n=>H.indexOf(n);
  const lv=s=>{s=String(s||'').trim().toLowerCase();if(s.startsWith('fore'))return 'FM';if(s.startsWith('sub'))return 'SFM';if(s.startsWith('jou'))return 'JM';const m=s.match(/app\w*\s*(\d)/);if(m)return 'A'+m[1];if(s.startsWith('off'))return 'Office';return s.toUpperCase().slice(0,6)};
  const st=s=>{s=String(s||'').replace(/\s/g,'').toLowerCase();return s.startsWith('1')?'Active':s.startsWith('2')?'On hold':s.startsWith('3')?'Inactive':s.startsWith('term')?'Terminated':'Not qualified'};
  const ph=v=>{const d=String(v||'').replace(/\D/g,'');return d.length===10?`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`:String(v||'').trim()};
  const dv=v=>v instanceof Date?v.toISOString().slice(0,10):(v==null||/^(none|n\/a)$/i.test(String(v).trim())?'':String(v).trim());
  const SK=['Forklift','Single Ply','BUR','SSMR','Coating','Sheet Metal'],CT=['Fall Protection Competent Person','First Aid & CPR','OHSA 10','OSHA 30','Telescopic Handler Safety'];
  const old=Object.fromEntries(STAFF.map(p=>[p.name,p]));const out=[];
  for(const r of A.slice(hi+1)){const nm=r[col('Name')];if(!nm)continue;const s=st(r[col('Status')]);if(s==='Terminated'||s==='Not qualified')continue;const name=String(nm).replace(/\s+/g,' ').trim();
    const e={emp:r[col('Emp #')]||'',name,cell:ph(r[col('Cell #')]),email:String(r[col('e-mail')]||'').trim(),cls:String(r[col('Classification')]||'').trim(),lv:lv(r[col('Level')]),st:s};
    const sk={};SK.forEach(k=>{const v=col(k)>=0?dv(r[col(k)]):'';if(v)sk[k]=v});const ct={};CT.forEach(k=>{const v=col(k)>=0?dv(r[col(k)]):'';if(v)ct[k]=v});if(Object.keys(sk).length)e.skills=sk;if(Object.keys(ct).length)e.certs=ct;
    if(old[name]&&old[name].short)e.short=old[name].short;out.push(e)}
  if(!out.length)throw new Error('No employees found');if(!confirm('Import '+out.length+' people ('+out.filter(p=>p.st==='Active').length+' active)? This replaces the staff list. Short names you set are kept.'))return;
  await db.doc('config/staff').set({list:out,updated:new Date().toISOString(),by:curUser,src:file.name});toast(out.length+' people imported')}catch(e){toast('Import failed: '+(e.message||e))}};rd.readAsArrayBuffer(file)}

AME.register({id:'dsp',beta:true,name:'Dispatch',desc:'Daily crews per job · foreman · send to the team',tabs:['dsp'],section:'tab-dsp',
  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="9" cy="14.5" r="1.6"/><circle cx="15" cy="14.5" r="1.6"/><path d="M6.5 19c.5-1.4 1.4-2 2.5-2s2 .6 2.5 2M12.5 19c.5-1.4 1.4-2 2.5-2s2 .6 2.5 2"/></svg>',
  open:()=>{view='day';showTab('dsp')},onShow:render});
AME.nav&&(AME.nav.dsp={get:()=>({view,date}),set:o=>{view=o.view;date=o.date;render()}});
const _ar=window.applyRole;window.applyRole=function(){_ar();const b=document.querySelector('nav.tabs [data-tab="dsp"]');if(b)b.hidden=!AME.allowed(AME.mod('dsp'))};
document.head.insertAdjacentHTML('beforeend',`<style>
.dsdate{display:flex;align-items:center;gap:8px;margin-bottom:8px}.dsdate label{position:relative;display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;cursor:pointer}.dsdate label b{font-size:18px}.dsdate input[type=date]{position:absolute;inset:0;opacity:0;width:100%;cursor:pointer}.dsdate>.btn{min-width:44px;font-size:20px;padding:6px 10px}
.dsstat{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.dscard{padding:12px 14px!important;margin-bottom:10px}.dscard[hidden]{display:none}.dsh{display:flex;align-items:baseline;gap:8px;min-width:0}.dsno{font-size:17px;flex:none}.dsnm{font-weight:700;font-size:16px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.dsmeta{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px;margin:4px 0 8px;align-items:center}.dspic{display:inline-flex;align-items:center;gap:6px;font-weight:600}.dspic::before{content:'';width:10px;height:10px;border-radius:3px;background:var(--c)}
.dscrew{display:flex;flex-wrap:wrap;gap:6px}.dschip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:18px;border:1px solid var(--line,#555);background:rgba(255,255,255,.04);color:inherit;font:inherit;font-size:14px;cursor:pointer;min-height:34px}.dschip:disabled{cursor:default;opacity:1}
.dschip i{font-style:normal;font-size:11px;font-weight:700;opacity:.7}.dschip em{font-style:normal;font-size:10px;font-weight:700;letter-spacing:.04em;padding:1px 5px;border-radius:6px;background:rgba(255,255,255,.1)}
.dschip.fm{border-color:#f47b20;background:rgba(244,123,32,.12)}.dschip.fm em{background:#f47b20;color:#1d1a18}.dschip.dup{border-color:#ff6b6b;box-shadow:0 0 0 1px #ff6b6b inset}.dschip.nw{border-style:dashed;border-color:#3fb950}.dschip.hit{outline:2px solid #ffd54a}
.dschip.add{border-style:dashed;color:#f47b20;border-color:#f47b20;font-weight:600}
.dschip.off{border-color:#ff6b6b;opacity:.85}.dschip em.offb{background:#ff6b6b;color:#1d1a18}.dschip small{font-size:11px}.dsoff{padding:10px 14px!important;margin-bottom:10px}.dsoffh{display:flex;align-items:center;gap:10px}.dsghost{position:fixed;z-index:99999;pointer-events:none;transform:translate(-50%,-120%);box-shadow:0 8px 24px rgba(0,0,0,.5);background:#3a3430;border-color:#f47b20}.dschip.dragsrc{opacity:.35}.droph{outline:2px dashed #f47b20;outline-offset:2px;background:rgba(244,123,32,.08)!important}body.dsdragging{user-select:none;-webkit-user-select:none}.dschip{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}
@media(min-width:900px){.dswrap{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}#dsRows{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}#dsRows .dscard{margin:0}.dsside{position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto}.dsside .panel{margin-bottom:12px}.dsfree summary{pointer-events:none}.dsfree summary::marker{content:''}
 #tab-dsp .dsdate{max-width:520px}#tab-dsp #dsQ{max-width:520px}}
@media(min-width:1400px){.dswrap{grid-template-columns:minmax(0,1fr) 340px}}
.stsort{display:flex;gap:8px;align-items:center}.stsort .search{flex:1;min-width:0}.stsort label{display:flex;align-items:center;gap:6px;font-size:13px}.stsort select{padding:8px}.dsemp{width:42px;flex:none;font-size:12px;opacity:.7;font-variant-numeric:tabular-nums}.dscls{width:52px;flex:none;font-size:12px;opacity:.75}.dssrow.dsshead{cursor:default;border-color:transparent;padding-bottom:0;font-size:12px;opacity:.7}.dsshead .dssn b{font-size:12px}.dslv{min-width:30px;text-align:right}
@media(max-width:600px){.dsstaff .dssrow{flex-wrap:wrap}.dsstaff .dssc{order:5;flex:1 1 100%;max-width:none;flex-direction:row;flex-wrap:wrap;gap:2px 12px;align-items:flex-start;text-align:left;padding-left:52px}.dsstaff .dssc:empty{display:none}.dscls{display:none}.stsort{flex-wrap:wrap}.stsort .search{flex:1 1 100%}}
.dsinact[aria-pressed]{color:#ff8a80}.dssrow.inact{border-color:rgba(255,107,107,.5);color:#ff8a80;background:rgba(255,107,107,.06)}
.gtools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.gleg{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin-left:auto}
.gwrap{--glw:560px;overflow:auto;max-height:calc(100vh - 240px);border:1px solid var(--line,#555);border-radius:12px;position:relative;background:rgba(0,0,0,.12)}
.ghead{display:flex;position:sticky;top:0;z-index:4;background:#2f2a27;border-bottom:1px solid var(--line,#555);width:max-content;min-width:100%}
.grow{display:flex;width:max-content;min-width:100%;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer}.grow:hover .gl{background:#3a3430}
.gl{position:sticky;left:0;z-index:3;flex:none;width:var(--glw);display:flex;align-items:center;gap:8px;padding:6px 10px;background:#2f2a27;border-right:1px solid var(--line,#555);font-size:13px;box-sizing:border-box;min-height:46px}
.gl .gno{width:44px;flex:none}.gl .gnm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gl .gind{padding-left:14px;opacity:.9}.gl .gsm{font-size:11px;opacity:.6}
.gl .gsys{width:96px;flex:none;font-size:12px;opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gl .gpic{width:74px;flex:none;font-size:11px;font-weight:700;padding:3px 5px;border-radius:5px;background:var(--c);color:#1d1a18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ghead .gpic{background:none;color:inherit}
.gl .gnew{width:24px;flex:none;text-align:center;font-size:12px}.gl .gnew.y{background:#ffd400;color:#1d1a18;border-radius:4px;font-weight:700}.gl .gcs{width:30px;flex:none;text-align:right;font-size:12px}.gl .gdt{width:100px;flex:none;font-size:11px;opacity:.75}
.gr{position:relative;flex:none;min-height:46px}.gr>i{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.05)}
.gh{height:40px}.gm{position:absolute;top:3px;font-size:11px;font-weight:700;white-space:nowrap;padding-left:4px;border-left:1px solid rgba(255,255,255,.25)}.gw{position:absolute;top:22px;font-size:10px;opacity:.6;padding-left:3px}
.gbar{position:absolute;top:20px;height:12px;border-radius:3px;background:var(--c)}.gbar.gsum{top:16px;height:8px;border-radius:0}.gbar.ghatch{background:repeating-linear-gradient(90deg,var(--c) 0 3px,transparent 3px 5px)}
.glab{position:absolute;top:16px;font-size:11px;font-weight:600;white-space:nowrap}.gtitle{position:absolute;top:2px;font-size:11px;font-weight:700;white-space:nowrap;opacity:.9}
.gbody{position:relative}.gnow{position:absolute;top:0;bottom:0;width:2px;background:#ff6b6b;z-index:2;pointer-events:none}
@media(max-width:899px){.gwrap{--glw:150px}.gl .gsys,.gl .gnew,.gl .gcs,.gl .gdt{display:none}.gl .gpic{width:12px;padding:0;height:12px;font-size:0}.gl .gno{width:auto}.gleg{display:none}}
.dsgone{display:block;margin-top:6px;color:#ff8a80;font-size:12px}.dsnote{margin:8px 0 0;color:#8ab4ff;font-size:14px}.dsnb{margin-top:8px}
.dsfree summary{cursor:pointer;padding:2px 0 8px}.dspick{display:flex;flex-direction:column;gap:6px;max-height:52vh;overflow:auto;margin-bottom:10px}
.dsprow{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--line,#555);border-radius:10px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}.dsprow.on{border-color:#3fb950;background:rgba(63,185,80,.1)}.dsprow em{font-style:normal;font-size:11px;font-weight:700;opacity:.75}
.dsprev{overflow:auto;background:#fff;color:#000;padding:8px;border-radius:8px;margin:6px 0}.dscontact{display:flex;gap:8px;flex-wrap:wrap}
.dsstaff{display:flex;flex-direction:column;gap:6px;margin-top:10px;padding-bottom:30px}.dssrow{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line,#555);border-radius:12px;cursor:pointer}.dssn{flex:1;min-width:0;display:flex;flex-direction:column}.dssn b,.dssn small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dslv{font-style:normal;font-size:11px;font-weight:700;opacity:.8;flex:none}.dssc{display:flex;flex-direction:column;align-items:flex-end;gap:1px;flex:none;font-size:12px;user-select:text;-webkit-user-select:text;max-width:46%;text-align:right}.dssc span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}.dsem{opacity:.7}.dsinfo{flex-direction:column;gap:4px;user-select:text;-webkit-user-select:text}.dsinfo b{display:inline-block;width:52px;font-size:12px;opacity:.7}.dssc .btn{padding:6px 8px;line-height:0}
.dlg label.f{min-width:0}.dlg input[type=date]{min-width:0;width:100%;box-sizing:border-box}label.chk{display:flex;align-items:center;gap:8px;margin:6px 0}
</style>`);
})();
