/* AME Dispatch — daily crew dispatch per job site. Jobs keep their foreman + crew from day to day;
   PMs adjust the day, then send it (email / Teams / app bell). Staff directory comes from the
   Field Employees Contact workbook (imported in the app — no personal data lives in this file). */
(function(){
const sec=document.getElementById('tab-dsp');
let S=[],DAY={},STAFF=[],CFG={},view='day',date=today(),q='',fltSite='active';
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
const person=n=>STAFF.find(p=>p.name===n)||STAFF.find(p=>(p.alias||[]).includes(n));
const lvOf=n=>(person(n)||{}).lv||'';
const short=n=>{const p=person(n);return p&&p.short||n};
window.ameStaff=()=>STAFF;window.ameStaffFind=person;

(function w(){if(typeof db!=='undefined'&&db&&db.collection){
  db.collection('dsites').onSnapshot(s=>{S=s.docs.map(d=>({...d.data(),_id:d.id}));if(AME.cur==='dsp')render()},()=>{});
  db.collection('dday').onSnapshot(s=>{DAY={};s.docs.forEach(d=>DAY[d.id]=d.data());if(AME.cur==='dsp')render()},()=>{});
  db.doc('config/staff').onSnapshot(s=>{STAFF=(s.data&&s.data()||{}).list||[];if(AME.cur==='dsp')render()},()=>{});
  db.doc('config/dispatch').onSnapshot(s=>{CFG=(s.data&&s.data())||{};if(AME.cur==='dsp')render()},()=>{});
}else setTimeout(w,400)})();

/* ---------- day model ---------- */
const activeOn=(s,d)=>(s.status||'Active')==='Active'&&(!s.start||s.start<=d)&&(!s.end||s.end>=d);
const sortCrew=c=>[...c].sort((a,b)=>lvRank(lvOf(a.n))-lvRank(lvOf(b.n)));
function rowsFor(d){const day=DAY[d]||{};const R=day.rows||{};
  return S.filter(s=>R[s._id]?!R[s._id].off:activeOn(s,d)).sort((a,b)=>jno(a.no).localeCompare(jno(b.no),undefined,{numeric:true}))
    .map(s=>{const r=R[s._id];return {s,crew:sortCrew((r&&r.crew)||s.crew||[]),note:(r&&r.note!=null)?r.note:(s.note||''),own:!!r}})}
function whereIs(d,n){return rowsFor(d).filter(r=>r.crew.some(c=>c.n===n)).map(r=>r.s)}
async function saveRow(d,site,crew,extra){const day=DAY[d]||{};const rows={...(day.rows||{})};rows[site._id]={...(rows[site._id]||{}),crew,...(extra||{})};
  await db.doc('dday/'+d).set({...day,rows,rev:(day.rev||0),editAt:new Date().toISOString(),editBy:curUser});
  if(d>=today())await db.doc('dsites/'+site._id).update({crew,updated:new Date().toISOString()}).catch(()=>{})}
const changed=d=>{const day=DAY[d];if(!day||!day.sent)return false;return JSON.stringify(snap(d))!==JSON.stringify(day.sent.snap||{})};
const snap=d=>{const o={};rowsFor(d).forEach(r=>o[r.s._id]=r.crew.map(c=>(c.t||'')+'|'+c.n));return o};

/* ---------- render ---------- */
function render(){if(!sec)return;const ed=canEdit();
  const seg=`<div class="viewseg" style="margin-bottom:12px">${[['day','Dispatch'],['sites','Jobs'],['staff','Staff']].map(([k,l])=>`<button data-dv="${k}" aria-pressed="${view===k}">${l}</button>`).join('')}</div>`;
  if(view==='sites')return renderSites(seg,ed);if(view==='staff')return renderStaff(seg,ed);
  const rows=rowsFor(date);const day=DAY[date]||{};const sent=day.sent;const ch=changed(date);
  const used=new Set(rows.flatMap(r=>r.crew.map(c=>c.n)));const dup=new Set();{const seen=new Set();rows.forEach(r=>r.crew.forEach(c=>{if(seen.has(c.n))dup.add(c.n);seen.add(c.n)}))}
  const free=STAFF.filter(p=>p.st==='Active'&&p.cls!=='Office'&&!used.has(p.name)).sort((a,b)=>lvRank(a.lv)-lvRank(b.lv)||a.name.localeCompare(b.name));
  const total=rows.reduce((a,r)=>a+r.crew.length,0);
  const prevSent=sent&&sent.snap||{};
  sec.innerHTML=`<div class="mplhead"><h2>Dispatch</h2>${ed?`<span class="mtop"><button class="btn pri" id="dsSend">${sent?(ch?'Send update':'Sent ✓'):'Send dispatch'}</button></span>`:''}</div>${seg}
   <div class="dsdate"><button class="btn" data-dd="-1" aria-label="Previous day">‹</button><label><input type="date" id="dsD" value="${date}"><b>${dLabel(date)}</b><small class="muted">${code(date)} Dispatch</small></label><button class="btn" data-dd="1" aria-label="Next day">›</button>${date!==today()?'<button class="btn small" id="dsToday">Today</button>':''}</div>
   <div class="dsstat">${sent?`<span class="pill ${ch?'p-needs':'p-good'}">${ch?'Changed since sent':'Sent'}</span><small class="muted">${E(sent.by)} · ${E(fmtD(sent.at))} ${new Date(sent.at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}${sent.rev>1?' · revision '+sent.rev:''}</small>`:'<span class="pill">Not sent yet</span>'}<small class="muted" style="margin-left:auto">${rows.length} job${rows.length===1?'':'s'} · ${total} people</small></div>
   <input id="dsQ" class="search" placeholder="Find a person or job…" value="${E(q)}">
   <div id="dsRows">${rows.length?'':`<div class="panel muted">No jobs on this day.${ed?' Add or reopen jobs in the <b>Jobs</b> tab.':''}</div>`}${rows.map(r=>{const s=r.s;const was=prevSent[s._id];const fm=r.crew.find(c=>['FM','SFM'].includes(lvOf(c.n)));
     return `<div class="panel dscard" data-site="${s._id}"><div class="dsh"><b class="dsno">${E(jno(s.no))}</b><span class="dsnm">${E(s.name||'')}</span>${s.isNew?'<span class="pill p-needs">New</span>':''}</div>
      <div class="dsmeta">${s.sys?`<span>${E(s.sys)}</span>`:''}${s.pic?`<span class="dspic" style="--c:${picCol(s.pic)}">${E(s.pic)}</span>`:''}<span class="muted">Crew ${r.crew.length}</span></div>
      <div class="dscrew">${r.crew.map(c=>{const l=lvOf(c.n);const nw=sent&&was&&!was.some(x=>x.split('|')[1]===c.n);return `<button type="button" class="dschip${['FM','SFM'].includes(l)?' fm':''}${dup.has(c.n)?' dup':''}${nw?' nw':''}" data-cn="${E(c.n)}" ${ed?'':'disabled'}>${c.t?`<i>${E(c.t)}</i>`:''}${E(short(c.n))}${l?`<em>${E(l)}</em>`:''}</button>`}).join('')}${ed?`<button type="button" class="dschip add" data-add="${s._id}">+ Add</button>`:''}</div>
      ${sent&&was?(()=>{const gone=was.map(x=>x.split('|')[1]).filter(n=>!r.crew.some(c=>c.n===n));return gone.length?`<small class="dsgone">Removed since sent: ${gone.map(n=>E(short(n))).join(', ')}</small>`:''})():''}
      ${r.note?`<p class="dsnote">${E(r.note)}</p>`:''}${ed?`<button type="button" class="btn small dsnb" data-note="${s._id}">${r.note?'Edit note':'+ Note'}</button>`:''}</div>`}).join('')}</div>
   ${ed&&free.length?`<details class="panel dsfree"><summary><b>Not dispatched</b> <span class="muted">${free.length} active field people</span></summary><div class="dscrew">${free.map(p=>`<button type="button" class="dschip" data-free="${E(p.name)}">${E(short(p.name))}<em>${E(p.lv||'')}</em></button>`).join('')}</div></details>`:''}
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
  sec.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>pick(S.find(s=>s._id===b.dataset.add)));
  sec.querySelectorAll('[data-cn]').forEach(b=>b.onclick=()=>chipMenu(S.find(s=>s._id===b.closest('[data-site]').dataset.site),b.dataset.cn));
  sec.querySelectorAll('[data-free]').forEach(b=>b.onclick=()=>toJob(b.dataset.free));
  sec.querySelectorAll('[data-note]').forEach(b=>b.onclick=async()=>{const s=S.find(x=>x._id===b.dataset.note);const r=rowsFor(date).find(x=>x.s._id===s._id);const v=prompt('Note for '+jno(s.no)+' on '+dLabel(date)+' (shows in the dispatch):',r.note||'');if(v==null)return;await saveRow(date,s,r.crew,{note:v.trim()})})}
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
    d.querySelector('#pkList').innerHTML=L.map(p=>{const w=at(p.name);const h=here.has(p.name);return `<button type="button" class="dsprow${h?' on':''}" data-pn="${E(p.name)}"><b>${E(short(p.name))}</b><em>${E(p.lv||'')}</em>${p.st!=='Active'?`<small class="muted">${E(p.st)}</small>`:''}<small class="muted" style="margin-left:auto">${h?'On this job ✓':w.length?'On '+E(w.map(s=>jno(s.no)).join(', ')):'Free'}</small></button>`}).join('')||'<p class="muted">Nobody found. Check the Staff tab.</p>';
    d.querySelectorAll('[data-pn]').forEach(b=>b.onclick=async()=>{const n=b.dataset.pn;if(here.has(n)){const r=rowsFor(date).find(x=>x.s._id===site._id);await saveRow(date,site,r.crew.filter(c=>c.n!==n))}else{const w=at(n);if(w.length&&!confirm(short(n)+' is on '+w.map(s=>jno(s.no)).join(', ')+'. Move to '+jno(site.no)+'?'))return;await moveTo(n,site)}setTimeout(draw,150)})};
  d.querySelector('#pkQ').oninput=e=>{t=e.target.value.trim().toLowerCase();draw()};d.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{lv=b.dataset.l;d.querySelectorAll('[data-l]').forEach(x=>x.setAttribute('aria-pressed',x===b));draw()});
  d.querySelector('#pkC').onclick=closeDlg;draw()}
function chipMenu(site,n){const r=rowsFor(date).find(x=>x.s._id===site._id);const c=r.crew.find(x=>x.n===n)||{};const p=person(n)||{};const others=rowsFor(date).filter(x=>x.s._id!==site._id);
  const d=dlg(`<h3>${E(short(n))} <small class="muted">${E(p.lv||'')}</small></h3>${p.cell||p.email?`<p class="dscontact">${p.cell?`<a class="btn small" href="tel:${E(p.cell.replace(/\D/g,''))}">Call ${E(p.cell)}</a>`:''}${p.cell?`<a class="btn small" href="sms:${E(p.cell.replace(/\D/g,''))}">Text</a>`:''}</p>`:''}
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

/* ---------- send ---------- */
const DEF_TO=[];
function tableHTML(d){const rows=rowsFor(d);const th='border:1px solid #999;padding:4px 8px;font:13px Calibri,Arial;text-align:left;vertical-align:middle;background:#f2f2f2';const td='border:1px solid #999;padding:4px 8px;font:13px Calibri,Arial;vertical-align:middle';
  return `<table style="border-collapse:collapse"><tr><th style="${th}">Task Name</th><th style="${th}">Roof System</th><th style="${th}">PIC</th><th style="${th}">New Project (Y/N)</th><th style="${th}">Crew Size</th><th style="${th}">Resource Names</th></tr>${rows.map(r=>`<tr><td style="${td}">${E(jno(r.s.no))}-${E(r.s.name||'')}</td><td style="${td}">${E(r.s.sys||'')}</td><td style="${td};text-align:center">${E(r.s.pic||'')}</td><td style="${td};text-align:center">${r.s.isNew?'Y':'N'}</td><td style="${td};text-align:center">${r.crew.length}</td><td style="${td}">${r.note?`<span style="color:#1f5fbf">** ${E(r.note)}</span><br>`:''}${r.crew.map(c=>`${c.t?E(c.t)+' ':''}${E(short(c.n))}_${E(lvOf(c.n)||'')}`).join('<br>')}</td></tr>`).join('')}</table>`}
function textTable(d){return rowsFor(d).map(r=>`${jno(r.s.no)}-${r.s.name||''} · ${r.s.sys||''} · PIC ${r.s.pic||''}${r.s.isNew?' · NEW':''} · Crew ${r.crew.length}\n`+(r.note?'  ** '+r.note+'\n':'')+r.crew.map(c=>`  ${c.t?c.t+' ':''}${short(c.n)}_${lvOf(c.n)}`).join('\n')).join('\n\n')}
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

/* ---------- jobs ---------- */
function renderSites(seg,ed){const L=S.filter(s=>fltSite==='all'||(fltSite==='active'?(s.status||'Active')==='Active':(s.status||'Active')!=='Active')).sort((a,b)=>jno(a.no).localeCompare(jno(b.no),undefined,{numeric:true}));
  sec.innerHTML=`<div class="mplhead"><h2>Dispatch</h2>${ed?'<span class="mtop"><button class="btn pri" id="dsNew">+ Add job</button></span>':''}</div>${seg}
   <div class="viewseg" style="margin-bottom:12px">${[['active','Active'],['done','On hold / Done'],['all','All']].map(([k,l])=>`<button data-sf="${k}" aria-pressed="${fltSite===k}">${l}</button>`).join('')}</div>
   <div class="mplcards">${L.map(s=>`<button class="mplcard dvc" data-se="${s._id}"><span class="dvh"><b>${E(jno(s.no))} · ${E(s.name||'')}</b>${(s.status||'Active')!=='Active'?`<span class="pill">${E(s.status)}</span>`:''}</span><small class="muted">${[s.sys,s.pic,(s.crew||[]).length+' crew',s.start?('from '+fmtD(s.start)):'',s.end?('to '+fmtD(s.end)):''].filter(Boolean).map(E).join(' · ')}</small></button>`).join('')||'<div class="panel muted">No jobs here.</div>'}</div>`;
  bindCommon();sec.querySelectorAll('[data-sf]').forEach(b=>b.onclick=()=>{fltSite=b.dataset.sf;render()});
  {const n=sec.querySelector('#dsNew');if(n)n.onclick=()=>siteDlg()}
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

/* ---------- staff directory ---------- */
let stQ='',stF='Active';
function renderStaff(seg,ed){const L=STAFF.filter(p=>(stF==='All'||p.st===stF)&&(!stQ||(p.name+' '+(p.short||'')+' '+(p.lv||'')+' '+(p.cell||'')).toLowerCase().includes(stQ.toLowerCase()))).sort((a,b)=>(a.cls==='Office')-(b.cls==='Office')||lvRank(a.lv)-lvRank(b.lv)||a.name.localeCompare(b.name));
  sec.innerHTML=`<div class="mplhead"><h2>Dispatch</h2>${ed?'<span class="mtop"><button class="btn" id="stImp">Import Excel</button></span>':''}</div>${seg}
   <div class="viewseg" style="margin-bottom:10px">${['Active','On hold','Inactive','All'].map(k=>`<button data-stf="${k}" aria-pressed="${stF===k}">${k}${k!=='All'?' · '+STAFF.filter(p=>p.st===k).length:''}</button>`).join('')}</div>
   <input id="stQ" class="search" placeholder="Search name, level, phone…" value="${E(stQ)}">
   <div class="dsstaff">${L.map(p=>`<div class="dssrow" data-sp="${E(p.name)}"><div class="dssn"><b>${E(p.short||p.name)}</b>${p.short?`<small class="muted">${E(p.name)}</small>`:''}</div><em class="dslv">${E(p.lv||'')}</em><span class="dssc">${p.cell?`<a href="tel:${E(p.cell.replace(/\D/g,''))}" class="btn small" aria-label="Call"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg></a>`:''}${p.email?`<a href="mailto:${E(p.email)}" class="btn small" aria-label="Email"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></a>`:''}</span></div>`).join('')||'<div class="panel muted">'+(STAFF.length?'Nobody matches.':'No staff yet. Tap Import Excel and pick the AME Field Employees Contact file.')+'</div>'}</div>
   <input type="file" id="stF" accept=".xlsx,.xls" hidden>`;
  bindCommon();sec.querySelectorAll('[data-stf]').forEach(b=>b.onclick=()=>{stF=b.dataset.stf;render()});
  const qi=sec.querySelector('#stQ');qi.oninput=()=>{stQ=qi.value;const p=qi.selectionStart;render();const n=sec.querySelector('#stQ');n.focus();try{n.setSelectionRange(p,p)}catch(e){}};
  sec.querySelectorAll('[data-sp]').forEach(r=>r.onclick=e=>{if(e.target.closest('a'))return;staffDlg(person(r.dataset.sp),ed)});
  {const b=sec.querySelector('#stImp');if(b){const f=sec.querySelector('#stF');b.onclick=()=>f.click();f.onchange=()=>f.files[0]&&importXL(f.files[0])}}}
function staffDlg(p,ed){if(!p)return;const sk=Object.entries(p.skills||{}),ct=Object.entries(p.certs||{});
  const d=dlg(`<h3>${E(p.name)}</h3><p class="muted" style="margin-top:0">${E([p.lv,p.cls,p.st,p.emp?'Emp #'+p.emp:''].filter(Boolean).join(' · '))}</p>
   <p class="dscontact">${p.cell?`<a class="btn" href="tel:${E(p.cell.replace(/\D/g,''))}">Call ${E(p.cell)}</a><a class="btn" href="sms:${E(p.cell.replace(/\D/g,''))}">Text</a>`:''}${p.email?`<a class="btn" href="mailto:${E(p.email)}">Email</a>`:''}</p>
   ${p.email?`<p class="muted" style="font-size:13px">${E(p.email)}</p>`:''}
   ${sk.length?`<h4 style="margin:12px 0 4px">Skills</h4><p>${sk.map(([k,v])=>`<span class="pill">${E(k)}: ${E(v)}</span>`).join(' ')}</p>`:''}
   ${ct.length?`<h4 style="margin:12px 0 4px">Training</h4><p>${ct.map(([k,v])=>`<span class="pill">${E(k)}${v&&v!=='Yes'?' · '+E(v):''}</span>`).join(' ')}</p>`:''}
   ${(()=>{const w=whereIs(today(),p.name);return w.length?`<p><b>Today:</b> ${w.map(s=>E(jno(s.no)+' · '+(s.name||''))).join(', ')}</p>`:''})()}
   ${ed?`<label class="f wide">Name on dispatch <small class="muted">(short name)</small><input id="spS" value="${E(p.short||'')}" placeholder="${E(p.name)}"></label><label class="f wide">Level<select id="spL">${[...LV,'Office',''].map(l=>`<option ${l===(p.lv||'')?'selected':''}>${l}</option>`).join('')}</select></label><label class="f wide">Status<select id="spT">${['Active','On hold','Inactive'].map(l=>`<option ${l===p.st?'selected':''}>${l}</option>`).join('')}</select></label>`:''}
   <div class="bar"><button class="btn" id="spC">${ed?'Cancel':'Close'}</button>${ed?'<button class="go" id="spO" style="width:auto">Save</button>':''}</div>`);
  d.querySelector('#spC').onclick=closeDlg;{const o=d.querySelector('#spO');if(o)o.onclick=async()=>{const list=STAFF.map(x=>x.name===p.name?{...x,short:d.querySelector('#spS').value.trim(),lv:d.querySelector('#spL').value,st:d.querySelector('#spT').value}:x);await db.doc('config/staff').set({list,updated:new Date().toISOString(),by:curUser});closeDlg();toast('Saved')}}}
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
.dsgone{display:block;margin-top:6px;color:#ff8a80;font-size:12px}.dsnote{margin:8px 0 0;color:#8ab4ff;font-size:14px}.dsnb{margin-top:8px}
.dsfree summary{cursor:pointer;padding:2px 0 8px}.dspick{display:flex;flex-direction:column;gap:6px;max-height:52vh;overflow:auto;margin-bottom:10px}
.dsprow{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--line,#555);border-radius:10px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}.dsprow.on{border-color:#3fb950;background:rgba(63,185,80,.1)}.dsprow em{font-style:normal;font-size:11px;font-weight:700;opacity:.75}
.dsprev{overflow:auto;background:#fff;color:#000;padding:8px;border-radius:8px;margin:6px 0}.dscontact{display:flex;gap:8px;flex-wrap:wrap}
.dsstaff{display:flex;flex-direction:column;gap:6px;margin-top:10px;padding-bottom:30px}.dssrow{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line,#555);border-radius:12px;cursor:pointer}.dssn{flex:1;min-width:0;display:flex;flex-direction:column}.dssn b,.dssn small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dslv{font-style:normal;font-size:11px;font-weight:700;opacity:.8;flex:none}.dssc{display:flex;gap:6px;flex:none}.dssc .btn{padding:6px 8px;line-height:0}
label.chk{display:flex;align-items:center;gap:8px;margin:6px 0}
</style>`);
})();
