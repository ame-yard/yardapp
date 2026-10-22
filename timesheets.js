/* Timesheets — crew timesheets per job per week (Traqspera-style), hours only: no pay rates, no SSNs.
   Data: tsw/<mon>_<siteId> = one crew sheet; config/tscodes = cost codes; config/tslock = locked pay periods. */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M4 4l2 2M20 4l-2 2"/></svg>';
const DOW=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const addD=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const monOf=x=>{const d=new Date(x+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const md=s=>{const d=new Date(s+'T12:00:00');return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})};
const wkLabel=m=>md(m)+' – '+md(addD(m,6))+', '+m.slice(0,4);
const n2=x=>{x=+x||0;return x%1?x.toFixed(2).replace(/0$/,''):String(x)};
const when=t=>t?new Date(t).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
const fl=n=>{const w=String(n||'').trim().split(/\s+/);return w.length>1?w[0]+' '+w[w.length-1][0]+'.':n};

/* ---- roles ---- */
const role=()=>{try{return typeof curRole==='function'?curRole():''}catch(e){return ''}};
const own=()=>typeof isOwner==='function'&&isOwner(curUser);
const office=()=>own()||['President','PM','HR','Office'].includes(role());   // sees every crew, approves
const foreman=()=>['FM','SFM','Yard'].includes(role());
const canUse=()=>!!curUser&&(office()||foreman()||role()==='Intern'||role()==='Crew');
const canApprove=()=>own()||['President','PM','Office'].includes(role());
const canLock=()=>own()||['President','Office','HR'].includes(role());

/* ---- data ---- */
let pend=null,pendT=0;const flush=()=>{clearTimeout(pendT);if(pend){const x=pend;pend=null;put(x)}};const later=t=>{pend=t;clearTimeout(pendT);pendT=setTimeout(flush,500)};
const S=document.getElementById('tab-ts')||(()=>{const s=document.createElement('section');s.id='tab-ts';s.hidden=true;document.querySelector('main').appendChild(s);return s})();
let TS=[],CODES=[],LOCK={},wk=monOf(today()),open_=null,tab='sheets',q='',sumWk=null;
const lockedWk=m=>!!(LOCK[m]&&LOCK[m].st==='locked');
(function w(){if(typeof db!=='undefined'&&db&&db.collection){
  db.collection('tsw').onSnapshot(s=>{if(pend){flush();return}TS=s.docs.map(d=>({...d.data(),_id:d.id}));if(AME.cur==='ts')render()},()=>{});
  db.doc('config/tscodes').onSnapshot(x=>{CODES=((x.data&&x.data())||{}).list||[];if(AME.cur==='ts'&&tab==='codes')render()},()=>{});
  db.doc('config/tslock').onSnapshot(x=>{LOCK=(x.data&&x.data())||{};if(AME.cur==='ts')render()},()=>{})}else setTimeout(w,400)})();
const staff=()=>(window.ameStaff?window.ameStaff():[]).filter(p=>p&&p.name&&p.active!==false);
const sheetsOf=m=>TS.filter(t=>t.week===m);
const mine=t=>office()||t.fm===curUser||t.by===curUser||(foreman()&&Object.keys(t.rows||{}).includes(curUser));
const visible=t=>mine(t)||!!(t.rows||{})[curUser];
const canEdit=t=>!lockedWk(t.week)&&t.status!=='approved'&&(office()||(mine(t)&&(t.status==='draft'||t.status==='rejected')));

/* ---- hours math: California daily OT (8 / 12) + weekly 40 ---- */
function split(day){const h=+day.h||0;if(day.ot!=null||day.dt!=null)return {r:Math.max(0,h-(+day.ot||0)-(+day.dt||0)),ot:+day.ot||0,dt:+day.dt||0};return {r:Math.min(h,8),ot:Math.min(Math.max(h-8,0),4),dt:Math.max(h-12,0)}}
function personTot(row){let r=0,ot=0,dt=0,h=0;for(let i=0;i<7;i++){const d=(row.d||{})[addD(wkOf(row),i)]||{};const s=split(d);r+=s.r;ot+=s.ot;dt+=s.dt;h+=(+d.h||0)}if(r>40){ot+=r-40;r=40}return {h,r,ot,dt}}
function wkOf(row){return row.__wk||wk}

/* ---- save ---- */
async function put(t,log){const {_id,...d}=t;if(pend&&pend._id===t._id){pend=null;clearTimeout(pendT)}d.at=new Date().toISOString();d.by=curUser;if(log){d.log=[...(d.log||[]),{ts:d.at,by:curUser,a:log}].slice(-60);t.log=d.log}try{await db.doc('tsw/'+_id).set(d)}catch(e){toast('Could not save: '+(e.message||e))}}
function newSheet(site,m,names){const id=m+'_'+(site.id||site.no||Math.random().toString(36).slice(2,8));const rows={};(names||[]).forEach(n=>rows[n]={d:{}});
  return {_id:id,week:m,site:{id:site.id||'',no:site.no||'',name:site.name||''},pic:site.pic||'',fm:curUser,status:'draft',rows,notes:{},log:[{ts:new Date().toISOString(),by:curUser,a:'created'}]}}

/* ---- UI ---- */
function render(){if(!S||S.hidden)return;if(!canUse()){S.innerHTML='<div class="panel muted">Timesheets are for office staff and foremen.</div>';return}
  if(open_&&!TS.find(t=>t._id===open_)){open_=null}
  if(open_){renderSheet(TS.find(t=>t._id===open_));return}
  const T=[['sheets','Timesheets'],['summary','Summary'],['codes','Cost codes']].filter(([k])=>k!=='codes'||office());
  S.innerHTML=`<div class="mplhead"><h2 style="display:flex;align-items:center;gap:10px"><span class="appic" style="width:34px;height:34px;margin:0;border-radius:9px">${IC}</span>Timesheets</h2><div class="seg" style="display:inline-flex;gap:4px">${T.map(([k,l])=>`<button type="button" class="btn small${tab===k?' on':''}" data-tt="${k}">${l}</button>`).join('')}</div><span style="flex:1"></span>${tab!=='codes'?`<div class="tswk"><button type="button" class="btn small" data-wk="-7">‹</button><button type="button" class="btn small" id="tsWkL" title="This week">${wkLabel(wk)}</button><button type="button" class="btn small" data-wk="7">›</button>${lockedWk(wk)?'<span class="tslk" title="Pay period locked">'+LK+' Locked</span>':''}</div>`:''}</div>
  <div id="tsBody"></div><style id="tsCss">${CSS}</style>`;
  $$('[data-tt]').forEach(b=>b.onclick=()=>{tab=b.dataset.tt;render()});$$('[data-wk]').forEach(b=>b.onclick=()=>{wk=addD(wk,+b.dataset.wk);render()});{const l=$('#tsWkL');if(l)l.onclick=()=>{wk=monOf(today());render()}}
  ({sheets:renderList,summary:renderSummary,codes:renderCodes})[tab]()}
const LK='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const STATUS={draft:['Draft','#8b8178'],submitted:['Submitted','#e8a33c'],approved:['Approved','#2ea043'],rejected:['Needs changes','#e2513a']};
const pill=st=>{const [l,c]=STATUS[st]||STATUS.draft;return `<span class="tsst" style="--c:${c}">${l}</span>`};

function renderList(){const B=$('#tsBody');const L=sheetsOf(wk).filter(visible);
  /* crews on the dispatch board this week that have no sheet yet */
  const have=new Set(L.map(t=>t.site.id||t.site.no));const sug=new Map();
  for(let i=0;i<7;i++)(window.ameDspCrews?window.ameDspCrews(addD(wk,i)):[]).forEach(r=>{const k=r.site.id||r.site.no;if(!k||have.has(k))return;const o=sug.get(k)||{site:r.site,names:new Set()};r.crew.forEach(n=>o.names.add(n));sug.set(k,o)});
  const sugL=[...sug.values()].filter(o=>office()||[...o.names].includes(curUser)||o.site.pic===curUser);
  const row=t=>{const ppl=Object.keys(t.rows||{});const tot=ppl.reduce((a,n)=>a+personTot({...t.rows[n],__wk:t.week}).h,0);const warn=ppl.filter(n=>!Object.values(t.rows[n].d||{}).some(d=>+d.h>0)).length;
    return `<div class="tsr" data-open="${t._id}"><div class="tsc1"><b>${E(t.site.no?t.site.no+' · ':'')}${E(t.site.name)}</b><small class="muted">${E(t.pic?'PIC '+fl(t.pic):'')}${t.fm?' · Foreman '+E(fl(t.fm)):''}</small></div><div class="tsc2"><span class="tsn" title="People on this sheet">${ppl.length}</span><span class="muted">${n2(tot)} h</span>${warn?`<span class="tswarn" title="${warn} with no hours">${warn} empty</span>`:''}</div><div class="tsc3 muted">${E(fl(t.by||''))}<br><small>${when(t.at)}</small></div><div class="tsc4">${pill(t.status)}</div><div class="tsc5">›</div></div>`};
  B.innerHTML=`<div class="tslist">
    ${L.length?`<div class="tsh"><span>Crew / job</span><span>Hours</span><span>Last updated</span><span>Status</span><span></span></div>${L.sort((a,b)=>(a.site.no||'').localeCompare(b.site.no||'')).map(row).join('')}`:'<div class="panel muted">No timesheets for this week yet.</div>'}
    ${sugL.length&&!lockedWk(wk)?`<div class="tsh" style="margin-top:14px"><span>On the dispatch board · tap + to start a sheet</span></div>${sugL.map((o,i)=>`<div class="tsr tssug" data-sug="${i}"><div class="tsc1"><b>${E(o.site.no?o.site.no+' · ':'')}${E(o.site.name)}</b><small class="muted">${[...o.names].map(fl).map(E).join(', ')}</small></div><div class="tsc2"><span class="tsn">${o.names.size}</span></div><div class="tsc3"></div><div class="tsc4"><span class="tsst" style="--c:#6b6460">Click to add</span></div><div class="tsc5"><b class="tsplus">+</b></div></div>`).join('')}`:''}
    ${!lockedWk(wk)?`<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="tsNew">+ Add timesheet for another job</button>${canLock()&&L.length&&L.every(t=>t.status==='approved')?`<button type="button" class="btn" id="tsLock">${LK} Lock pay period</button>`:''}</div>`:(canLock()?`<div style="margin-top:14px"><button type="button" class="btn" id="tsUnlock">Unlock pay period</button></div>`:'')}
  </div>`;
  $$('[data-open]').forEach(r=>r.onclick=()=>{open_=r.dataset.open;render()});
  $$('[data-sug]').forEach(r=>r.onclick=async()=>{const o=sugL[+r.dataset.sug];const t=newSheet(o.site,wk,[...o.names]);await put(t);open_=t._id;render()});
  {const b=$('#tsNew');if(b)b.onclick=pickJob}
  {const b=$('#tsLock');if(b)b.onclick=async()=>{if(!confirm('Lock '+wkLabel(wk)+'? Nobody can change hours after this (you can unlock).'))return;await db.doc('config/tslock').set({...LOCK,[wk]:{st:'locked',by:curUser,at:new Date().toISOString()}});toast('Pay period locked')}}
  {const b=$('#tsUnlock');if(b)b.onclick=async()=>{if(!confirm('Unlock '+wkLabel(wk)+'?'))return;const l={...LOCK};delete l[wk];await db.doc('config/tslock').set(l);toast('Unlocked')}}}

function pickJob(){const sites=(window.ameDspSites?window.ameDspSites():[]);const have=new Set(sheetsOf(wk).map(t=>t.site.id||t.site.no));
  $('#dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg" style="max-width:460px"><h3>New timesheet · ${wkLabel(wk)}</h3><input class="search" id="tsJq" placeholder="Job number or name" autocomplete="off"><div id="tsJl" style="max-height:50vh;overflow:auto;margin-top:8px"></div><div class="bar"><button class="btn" id="tsJx" style="width:auto">Cancel</button></div></div></div>`;
  const draw=()=>{const v=($('#tsJq').value||'').toLowerCase();const L=sites.filter(s=>!have.has(s._id||s.no)&&(!v||((s.no||'')+' '+(s.name||'')).toLowerCase().includes(v))).slice(0,40);
    $('#tsJl').innerHTML=L.map(s=>`<button type="button" class="tsjob" data-j="${E(s._id||s.no)}"><b>${E(s.no||'')}</b> ${E(s.name||'')}</button>`).join('')+(v&&!L.some(s=>(s.name||'').toLowerCase()===v)?`<button type="button" class="tsjob" data-j="__new"><b>+</b> Use “${E($('#tsJq').value)}” as the job name</button>`:'')||'<p class="muted">No jobs match.</p>';
    $$('#tsJl [data-j]').forEach(b=>b.onclick=async()=>{let site;if(b.dataset.j==='__new'){const nm=$('#tsJq').value.trim();site={id:'x'+Date.now().toString(36),no:'',name:nm}}else{const s=sites.find(x=>(x._id||x.no)===b.dataset.j);site={id:s._id||'',no:s.no||'',name:s.name||'',pic:s.pic||''}}closeDlg();const t=newSheet(site,wk,[]);await put(t);open_=t._id;render()})};
  $('#tsJq').oninput=draw;draw();$('#tsJq').focus();$('#tsJx').onclick=closeDlg}

/* ---- one crew sheet ---- */
function renderSheet(t){const ed=canEdit(t);const days=Array.from({length:7},(_,i)=>addD(t.week,i));const names=Object.keys(t.rows||{}).sort();const lk=lockedWk(t.week);
  const cell=(n,d)=>{const c=(t.rows[n].d||{})[d]||{};const s=split(c);const cls=c.h>12?' tsx':c.h>8?' tso':'';return `<td class="tsd${cls}">${ed?`<input type="number" inputmode="decimal" step="0.5" min="0" max="24" data-h="${E(n)}|${d}" value="${c.h||''}" placeholder="–">`:`<span>${c.h?n2(c.h):'<i class="muted">–</i>'}</span>`}${c.cc?`<small class="tscc" title="Cost code">${E(c.cc)}</small>`:''}${s.ot||s.dt?`<small class="tsot">${s.ot?'OT '+n2(s.ot):''}${s.dt?' DT '+n2(s.dt):''}</small>`:''}</td>`};
  const dayTot=d=>names.reduce((a,n)=>a+(+((t.rows[n].d||{})[d]||{}).h||0),0);
  const tot=names.reduce((a,n)=>{const p=personTot({...t.rows[n],__wk:t.week});a.h+=p.h;a.r+=p.r;a.ot+=p.ot;a.dt+=p.dt;return a},{h:0,r:0,ot:0,dt:0});
  S.innerHTML=`<div class="mplhead"><button type="button" class="btn" id="tsBack">‹ Timesheets</button><div><h2 style="margin:0">${E(t.site.no?t.site.no+' · ':'')}${E(t.site.name)}</h2><div class="muted" style="font-size:13px">${wkLabel(t.week)} · ${t.pic?'PIC '+E(fl(t.pic))+' · ':''}Foreman ${E(fl(t.fm||'—'))}</div></div><span style="flex:1"></span>${pill(t.status)}${lk?`<span class="tslk">${LK} Locked</span>`:''}</div>
  <div class="panel" style="padding:0;overflow:auto"><table class="tstbl"><thead><tr><th class="tsnm">Employee</th>${days.map((d,i)=>`<th class="${d===today()?'tstoday':''}">${DOW[i]}<br><small>${md(d)}</small></th>`).join('')}<th class="n">Reg</th><th class="n">OT</th><th class="n">DT</th><th class="n">Total</th>${ed?'<th></th>':''}</tr></thead>
   <tbody>${names.map(n=>{const p=personTot({...t.rows[n],__wk:t.week});const st=(window.ameStaffFind&&window.ameStaffFind(n))||{};return `<tr><td class="tsnm"><b>${E(fl(n))}</b><small class="muted">${E(st.role||'')}${st.emp?' · #'+E(st.emp):''}</small></td>${days.map(d=>cell(n,d)).join('')}<td class="n">${n2(p.r)}</td><td class="n tso">${p.ot?n2(p.ot):''}</td><td class="n tsx">${p.dt?n2(p.dt):''}</td><td class="n"><b>${n2(p.h)}</b></td>${ed?`<td><button type="button" class="tsrm" data-rm="${E(n)}" title="Remove from this sheet">×</button></td>`:''}</tr>`}).join('')||`<tr><td colspan="12" class="muted" style="padding:14px">No people yet${ed?' — add the crew below.':'.'}</td></tr>`}</tbody>
   <tfoot><tr><td class="tsnm">Daily total</td>${days.map(d=>`<td class="n">${n2(dayTot(d))||''}</td>`).join('')}<td class="n">${n2(tot.r)}</td><td class="n tso">${n2(tot.ot)}</td><td class="n tsx">${n2(tot.dt)}</td><td class="n"><b>${n2(tot.h)}</b></td>${ed?'<td></td>':''}</tr></tfoot></table></div>
  <div class="tsnotes">${days.map((d,i)=>`<label><b>${DOW[i]} ${md(d)}</b>${ed?`<input data-note="${d}" value="${E((t.notes||{})[d]||'')}" placeholder="Note · weather · what got done">`:`<span>${E((t.notes||{})[d]||'')||'<i class="muted">—</i>'}</span>`}</label>`).join('')}</div>
  <div class="tsact">${ed?`<button type="button" class="btn" id="tsAdd">+ Add person</button><button type="button" class="btn" id="tsFill" title="Everyone on the dispatch board for this job this week">Fill from Dispatch</button><button type="button" class="btn" id="tsCode">Cost code for a day…</button>`:''}<span style="flex:1"></span>
    ${!lk&&ed&&(t.status==='draft'||t.status==='rejected')?'<button type="button" class="btn tsgo" id="tsSubmit">Submit for approval</button>':''}
    ${!lk&&canApprove()&&t.status==='submitted'?'<button type="button" class="btn" id="tsRej" style="color:#e2513a">Needs changes</button><button type="button" class="btn tsgo" id="tsAppr">Approve</button>':''}
    ${!lk&&canApprove()&&t.status==='approved'?'<button type="button" class="btn" id="tsReopen">Reopen</button>':''}
    ${!lk&&ed&&t.status==='submitted'&&!canApprove()?'<button type="button" class="btn" id="tsRecall">Recall</button>':''}
    <button type="button" class="btn" id="tsPrint">Print</button>${office()&&!lk?'<button type="button" class="btn" id="tsDel" title="Delete this sheet" style="color:#e2513a">Delete</button>':''}</div>
  ${t.status==='rejected'&&t.why?`<div class="panel" style="border-color:#e2513a;margin-top:10px"><b>Needs changes:</b> ${E(t.why)} <small class="muted">— ${E(fl(t.whyBy||''))}</small></div>`:''}
  <details class="tslog"><summary>History (${(t.log||[]).length})</summary>${(t.log||[]).slice().reverse().map(l=>`<div><small class="muted">${when(l.ts)}</small> ${E(fl(l.by))} — ${E(l.a)}</div>`).join('')}</details><style id="tsCss">${CSS}</style>`;
  $('#tsBack').onclick=()=>{open_=null;render()};
  const save=()=>later(t);
  $$('[data-h]').forEach(i=>{i.onchange=()=>{const [n,d]=i.dataset.h.split('|');const r=t.rows[n];r.d=r.d||{};let v=Math.max(0,Math.min(24,+i.value||0));if(!v){delete r.d[d]}else{r.d[d]={...(r.d[d]||{}),h:v}}save();const td=i.closest('td');td.classList.toggle('tso',v>8&&v<=12);td.classList.toggle('tsx',v>12)};
    i.onkeydown=e=>{if(e.key==='Enter'||e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const all=$$('[data-h]');const k=all.indexOf(i);const nx=all[k+(e.key==='ArrowUp'?-7:7)];nx&&nx.focus()}};i.onfocus=()=>i.select()});
  $$('[data-note]').forEach(i=>i.onchange=()=>{t.notes=t.notes||{};t.notes[i.dataset.note]=i.value.trim();save()});
  $$('[data-rm]').forEach(b=>b.onclick=()=>{if(!confirm('Remove '+fl(b.dataset.rm)+' from this sheet?'))return;delete t.rows[b.dataset.rm];put(t,'removed '+fl(b.dataset.rm));renderSheet(t)});
  {const b=$('#tsAdd');if(b)b.onclick=()=>addPerson(t)}
  {const b=$('#tsFill');if(b)b.onclick=()=>{let k=0;for(let i=0;i<7;i++)(window.ameDspCrews?window.ameDspCrews(addD(t.week,i)):[]).filter(r=>(r.site.id&&r.site.id===t.site.id)||(r.site.no&&r.site.no===t.site.no)).forEach(r=>r.crew.forEach(n=>{if(!t.rows[n]){t.rows[n]={d:{}};k++}}));if(k){put(t,'added '+k+' from dispatch');renderSheet(t)}else toast('Nobody new on the board for this job')}}
  {const b=$('#tsCode');if(b)b.onclick=()=>codeDlg(t)}
  {const b=$('#tsSubmit');if(b)b.onclick=async()=>{const empty=names.filter(n=>!Object.values(t.rows[n].d||{}).some(d=>+d.h>0));if(empty.length&&!confirm(empty.map(fl).join(', ')+' ha'+(empty.length>1?'ve':'s')+' no hours. Submit anyway?'))return;t.status='submitted';t.subBy=curUser;t.subAt=new Date().toISOString();await put(t,'submitted');note(t,'submitted');renderSheet(t)}}
  {const b=$('#tsRecall');if(b)b.onclick=async()=>{t.status='draft';await put(t,'recalled');renderSheet(t)}}
  {const b=$('#tsAppr');if(b)b.onclick=async()=>{t.status='approved';t.apBy=curUser;t.apAt=new Date().toISOString();await put(t,'approved');note(t,'approved');renderSheet(t)}}
  {const b=$('#tsRej');if(b)b.onclick=async()=>{const why=prompt('What needs to change?');if(why==null)return;t.status='rejected';t.why=why.trim();t.whyBy=curUser;await put(t,'needs changes: '+why.trim());note(t,'needs changes');renderSheet(t)}}
  {const b=$('#tsReopen');if(b)b.onclick=async()=>{t.status='draft';await put(t,'reopened');renderSheet(t)}}
  {const b=$('#tsDel');if(b)b.onclick=async()=>{if(!confirm('Delete this timesheet? It goes to Trash for 90 days.'))return;await db.doc('tsw/'+t._id).delete();open_=null;render()}}
  {const b=$('#tsPrint');if(b)b.onclick=()=>printSheet(t)}}
function note(t,what){try{db.collection('logs').add({ts:new Date().toISOString(),by:curUser,action:'TSHEET',name:(t.site.no?t.site.no+' ':'')+t.site.name+' · '+wkLabel(t.week)+' · '+what,sheet:t._id})}catch(e){}}
function addPerson(t){const L=staff().filter(p=>!t.rows[p.name]);$('#dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg" style="max-width:420px"><h3>Add to this sheet</h3><input class="search" id="tsPq" placeholder="Name" autocomplete="off"><div id="tsPl" style="max-height:50vh;overflow:auto;margin-top:8px"></div><div class="bar"><button class="btn" id="tsPx" style="width:auto">Done</button></div></div></div>`;
  const draw=()=>{const v=($('#tsPq').value||'').toLowerCase();$('#tsPl').innerHTML=L.filter(p=>!t.rows[p.name]&&(!v||p.name.toLowerCase().includes(v))).slice(0,60).map(p=>`<button type="button" class="tsjob" data-p="${E(p.name)}"><b>${E(p.name)}</b> <small class="muted">${E(p.role||'')}</small></button>`).join('')||'<p class="muted">Nobody left to add.</p>';
    $$('#tsPl [data-p]').forEach(b=>b.onclick=()=>{t.rows[b.dataset.p]={d:{}};put(t,'added '+fl(b.dataset.p));draw()})};
  $('#tsPq').oninput=draw;draw();$('#tsPq').focus();$('#tsPx').onclick=()=>{closeDlg();renderSheet(t)}}
function codeDlg(t){const days=Array.from({length:7},(_,i)=>addD(t.week,i));$('#dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg" style="max-width:420px"><h3>Cost code</h3><p class="muted" style="margin-top:0">Tags everyone's hours on that day. Leave blank to clear.</p><select id="tsCd" class="search">${days.map((d,i)=>`<option value="${d}">${DOW[i]} ${md(d)}</option>`).join('')}</select><input class="search" id="tsCv" list="tsCodes" placeholder="Code (e.g. 100 Tear-off)" style="margin-top:8px"><datalist id="tsCodes">${CODES.map(c=>`<option value="${E(c.code)}">${E(c.name||'')}</option>`).join('')}</datalist><div class="bar"><button class="btn" id="tsCx" style="width:auto">Cancel</button><button class="go" id="tsCo" style="width:auto">Apply</button></div></div></div>`;
  $('#tsCx').onclick=closeDlg;$('#tsCo').onclick=()=>{const d=$('#tsCd').value,v=$('#tsCv').value.trim();Object.keys(t.rows).forEach(n=>{const r=t.rows[n];r.d=r.d||{};if(r.d[d]){if(v)r.d[d].cc=v;else delete r.d[d].cc}});put(t,'cost code '+(v||'cleared')+' on '+md(d));closeDlg();renderSheet(t)}}

/* ---- summary (all crews, one week): hours per person, flags ---- */
function renderSummary(){const B=$('#tsBody');const L=sheetsOf(wk).filter(visible);const days=Array.from({length:7},(_,i)=>addD(wk,i));const P={};
  L.forEach(t=>Object.keys(t.rows||{}).forEach(n=>{const p=P[n]=P[n]||{d:{},jobs:new Set(),st:new Set()};p.st.add(t.status);days.forEach(d=>{const c=(t.rows[n].d||{})[d];if(c&&+c.h){p.d[d]=(p.d[d]||0)+(+c.h);p.jobs.add(t.site.no||t.site.name);(p.dj=p.dj||{})[d]=((p.dj||{})[d]||0)+1}})}));
  const names=Object.keys(P).sort();if(!names.length){B.innerHTML='<div class="panel muted">No hours recorded this week.</div>';return}
  const rows=names.map(n=>{const p=P[n];const row={d:Object.fromEntries(days.map(d=>[d,{h:p.d[d]||0}])),__wk:wk};const tt=personTot(row);const dup=days.filter(d=>(p.dj||{})[d]>1);const miss=days.slice(0,5).filter(d=>!p.d[d]);
    return `<tr><td class="tsnm"><b>${E(fl(n))}</b><small class="muted">${[...p.jobs].map(E).join(', ')}</small></td>${days.map(d=>`<td class="n ${p.d[d]>12?'tsx':p.d[d]>8?'tso':''} ${dup.includes(d)?'tsdup':''}" title="${dup.includes(d)?'On more than one crew sheet this day':''}">${p.d[d]?n2(p.d[d]):''}</td>`).join('')}<td class="n">${n2(tt.r)}</td><td class="n tso">${tt.ot?n2(tt.ot):''}</td><td class="n tsx">${tt.dt?n2(tt.dt):''}</td><td class="n"><b>${n2(tt.h)}</b></td><td>${[...p.st].map(pill).join(' ')}${dup.length?'<span class="tswarn">double-booked</span>':''}${miss.length&&miss.length<5?`<span class="tswarn" title="${miss.map(md).join(', ')}">${miss.length} day${miss.length>1?'s':''} missing</span>`:''}</td></tr>`});
  const tot=names.reduce((a,n)=>{const p=P[n];const tt=personTot({d:Object.fromEntries(days.map(d=>[d,{h:p.d[d]||0}])),__wk:wk});a.h+=tt.h;a.r+=tt.r;a.ot+=tt.ot;a.dt+=tt.dt;return a},{h:0,r:0,ot:0,dt:0});
  B.innerHTML=`<div class="mplhead" style="margin-top:0"><span class="muted">${names.length} people · ${L.length} crew sheets · ${L.filter(t=>t.status==='approved').length} approved</span><span style="flex:1"></span>${office()?'<button type="button" class="btn small" id="tsCsv">Export CSV (hours)</button>':''}<button type="button" class="btn small" id="tsPrintS">Print</button></div>
  <div class="panel" style="padding:0;overflow:auto"><table class="tstbl"><thead><tr><th class="tsnm">Employee</th>${days.map((d,i)=>`<th>${DOW[i]}<br><small>${md(d)}</small></th>`).join('')}<th class="n">Reg</th><th class="n">OT</th><th class="n">DT</th><th class="n">Total</th><th>Status</th></tr></thead><tbody>${rows.join('')}</tbody><tfoot><tr><td class="tsnm">Total</td>${days.map(d=>`<td class="n">${n2(names.reduce((a,n)=>a+(P[n].d[d]||0),0))||''}</td>`).join('')}<td class="n">${n2(tot.r)}</td><td class="n tso">${n2(tot.ot)}</td><td class="n tsx">${n2(tot.dt)}</td><td class="n"><b>${n2(tot.h)}</b></td><td></td></tr></tfoot></table></div>
  <p class="muted" style="font-size:12px">OT = over 8 h in a day or over 40 regular in the week · DT = over 12 h in a day (California). Hours only — no pay rates are stored in the app.</p>`;
  {const b=$('#tsCsv');if(b)b.onclick=()=>{const hdr=['Employee','Emp #','Job',...days,'Reg','OT','DT','Total'];const out=[hdr];L.forEach(t=>Object.keys(t.rows||{}).forEach(n=>{const st=(window.ameStaffFind&&window.ameStaffFind(n))||{};const tt=personTot({...t.rows[n],__wk:t.week});out.push([n,st.emp||'',(t.site.no?t.site.no+' ':'')+t.site.name,...days.map(d=>((t.rows[n].d||{})[d]||{}).h||''),n2(tt.r),n2(tt.ot),n2(tt.dt),n2(tt.h)])}));
    const csv=out.map(r=>r.map(v=>/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':v).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='timesheets_'+wk+'.csv';a.click()}}
  {const b=$('#tsPrintS');if(b)b.onclick=()=>printHtml('Timesheet summary · '+wkLabel(wk),B.querySelector('table').outerHTML)}}

function renderCodes(){const B=$('#tsBody');B.innerHTML=`<div class="panel"><p class="muted" style="margin-top:0">Cost codes tag a day's hours (tear-off, install, sheet metal, cleanup…). Optional.</p><table class="tstbl"><thead><tr><th>Code</th><th>Name</th><th></th></tr></thead><tbody>${CODES.map((c,i)=>`<tr><td><input data-cc="${i}|code" value="${E(c.code)}" style="width:90px"></td><td><input data-cc="${i}|name" value="${E(c.name||'')}"></td><td><button type="button" class="tsrm" data-ccx="${i}">×</button></td></tr>`).join('')}</tbody></table><button type="button" class="btn small" id="tsCcAdd" style="margin-top:8px">+ Add code</button></div>`;
  const save=()=>db.doc('config/tscodes').set({list:CODES,by:curUser,at:new Date().toISOString()});
  $$('[data-cc]').forEach(i=>i.onchange=()=>{const [k,f]=i.dataset.cc.split('|');CODES[+k][f]=i.value.trim();save()});$$('[data-ccx]').forEach(b=>b.onclick=()=>{CODES.splice(+b.dataset.ccx,1);save();renderCodes()});$('#tsCcAdd').onclick=()=>{CODES.push({code:'',name:''});renderCodes();const x=$$('[data-cc]');x[x.length-2]&&x[x.length-2].focus()}}

/* ---- print ---- */
function printSheet(t){const days=Array.from({length:7},(_,i)=>addD(t.week,i));const names=Object.keys(t.rows||{}).sort();
  const body=`<table><thead><tr><th>Employee</th>${days.map((d,i)=>`<th>${DOW[i]}<br>${md(d)}</th>`).join('')}<th>Reg</th><th>OT</th><th>DT</th><th>Total</th></tr></thead><tbody>${names.map(n=>{const p=personTot({...t.rows[n],__wk:t.week});return `<tr><td>${E(n)}</td>${days.map(d=>`<td class="n">${n2(((t.rows[n].d||{})[d]||{}).h||'')||''}</td>`).join('')}<td class="n">${n2(p.r)}</td><td class="n">${n2(p.ot)||''}</td><td class="n">${n2(p.dt)||''}</td><td class="n"><b>${n2(p.h)}</b></td></tr>`}).join('')}</tbody></table>
  ${Object.values(t.notes||{}).some(Boolean)?`<h3>Notes</h3>${days.map((d,i)=>(t.notes||{})[d]?`<div><b>${DOW[i]} ${md(d)}:</b> ${E(t.notes[d])}</div>`:'').join('')}`:''}
  <p style="margin-top:28px">Foreman: ${E(t.fm||'')} &nbsp; Signature: ____________________ &nbsp;&nbsp; ${t.apBy?'Approved by '+E(t.apBy)+' '+when(t.apAt):'Approved: ____________________'}</p>`;
  printHtml((t.site.no?t.site.no+' · ':'')+t.site.name+' · '+wkLabel(t.week),body)}
function printHtml(title,html){const w=window.open('','_blank');w.document.write(`<!doctype html><title>${E(title)}</title><style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h2{margin:0 0 10px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}td.n,th.n{text-align:right}small{color:#666}.tsst,.tswarn{font-size:10px;border:1px solid #999;border-radius:8px;padding:1px 6px}</style><h2>${E(title)}</h2><div>AME Builders, Inc. · printed ${new Date().toLocaleString()}</div>${html}`);w.document.close();setTimeout(()=>w.print(),300)}

const CSS=`.tswk{display:flex;align-items:center;gap:4px}.tslk{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:#e8a33c;border:1px solid #e8a33c;border-radius:999px;padding:3px 9px}
.tslist .tsh{display:grid;grid-template-columns:minmax(0,1fr) 150px 150px 130px 30px;gap:10px;padding:4px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.tsr{display:grid;grid-template-columns:minmax(0,1fr) 150px 150px 130px 30px;gap:10px;align-items:center;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel);margin-bottom:8px;cursor:pointer}.tsr:hover{border-color:var(--accent,#f47b20)}.tssug{border-style:dashed;opacity:.85}
.tsc1 b{display:block;font-size:15px}.tsc1 small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tsc2{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.tsn{display:inline-grid;place-items:center;min-width:26px;height:22px;padding:0 6px;border-radius:11px;background:var(--chip);font-size:12px;font-weight:700}.tsc3{font-size:13px}.tsc5{text-align:right;font-size:20px;color:var(--muted)}.tsplus{color:#2ea043;font-size:22px}
.tsst{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700;color:#fff;background:var(--c)}.tswarn{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(226,81,58,.18);color:#ff8a75;margin-left:4px}
.tstbl{border-collapse:collapse;width:100%;font-size:13.5px}.tstbl th,.tstbl td{border-bottom:1px solid var(--line);border-right:1px solid rgba(255,255,255,.06);padding:6px 8px;text-align:center;vertical-align:middle}.tstbl th{font-size:12px;color:var(--muted);font-weight:700;white-space:nowrap}.tstbl th small{font-weight:500}.tstbl td.n,.tstbl th.n{text-align:right;white-space:nowrap}.tstbl .tsnm{text-align:left;min-width:170px;white-space:nowrap}.tstbl .tsnm small{display:block;font-size:11px}.tstbl tfoot td{font-weight:700;background:rgba(255,255,255,.03)}
.tstbl .tsd{min-width:64px;padding:4px}.tstbl .tsd input{width:58px;text-align:center;padding:6px 4px;font-size:14px;font-weight:600;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}.tstbl .tsd input::placeholder{color:var(--muted)}.tstbl .tsd span{font-weight:600}.tstbl .tsd small{display:block;font-size:10px;line-height:1.2;margin-top:2px}.tsot{color:#e8a33c}.tscc{color:var(--muted)}
.tstbl td.tso,.tstbl .tso{color:#e8a33c}.tstbl td.tsx,.tstbl .tsx{color:#ff8a75}.tstbl td.tso input{border-color:#e8a33c}.tstbl td.tsx input{border-color:#e2513a}.tstbl .tstoday{color:var(--accent,#f47b20)}.tsdup{background:rgba(226,81,58,.14)}
.tsrm{border:0;background:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0 6px}.tsrm:hover{color:#e2513a}
.tsnotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:12px}.tsnotes label{display:flex;flex-direction:column;gap:4px;font-size:12px}.tsnotes label b{color:var(--muted)}.tsnotes input{padding:6px 8px;font-size:13px}.tsnotes span{font-size:13px;padding:6px 0}
.tsgo{background:var(--accent,#f47b20)!important;color:#fff!important;border-color:var(--accent,#f47b20)!important}.tstbl .tsnm{position:sticky;left:0;background:var(--panel);z-index:1}.tsact{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px}.tslog{margin-top:14px;font-size:13px}.tslog summary{cursor:pointer;color:var(--muted)}.tslog div{padding:3px 0}
.tsjob{display:block;width:100%;text-align:left;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);font:inherit;margin-bottom:6px;cursor:pointer}.tsjob:hover{border-color:var(--accent,#f47b20)}
.seg .btn.on{background:var(--accent,#f47b20);color:#fff;border-color:var(--accent,#f47b20)}
@media(max-width:700px){.tsr,.tslist .tsh{grid-template-columns:minmax(0,1fr) 90px 24px}.tsc3,.tslist .tsh span:nth-child(3){display:none}.tsc4{grid-column:1/3}.tslist .tsh span:nth-child(4){display:none}.tstbl{font-size:12.5px}.tstbl .tsnm{min-width:120px;white-space:normal}.tstbl .tsd input{width:46px}}`;

AME.register({id:'ts',name:'Timesheets',desc:'Crew timesheets per job · hours by day · OT · approve · lock pay period · summary & CSV',beta:true,allow:canUse,tabs:['ts'],section:'tab-ts',icon:IC,
  open:()=>{showTab('ts');render()},onShow:render});
window.ameTimesheets={render,sheets:()=>TS};
})();
