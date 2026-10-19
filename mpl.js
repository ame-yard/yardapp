/* AME Yard — Mobilization Prep List (MPL) module */
(function(){
let REF=null,MPLS=[],MAP={},CH={},W=null,view='list',openId='';
const ORDER=['Roof System','Equipment and Tool','General','Safety','Demo','Staging Area','Fastener','Custom'];
const STEPS=[['job','Job & crew'],['sys','Roof system'],['deck','Deck type'],['scope','Other scope'],['list','Item list'],['go','Check out']];
const SCOPE_PARENTS=[6,7,9,3,4,5,10,2];
const el=()=>document.getElementById('tab-mpl');
const norm=s=>String(s||'').toLowerCase().replace(/["'”]/g,' in ').replace(/[^a-z0-9.\/ ]+/g,' ').split(/\s+/).filter(w=>w&&!['w','with','for','the','and','of','in','ea','cord','-'].includes(w));
const rItem=id=>REF&&REF.its.find(x=>x[0]===id);
const stName=id=>(REF.st.find(s=>s[0]===id)||[,'?'])[1];
const kids=p=>REF.st.filter(s=>s[2]===p);

/* ---------- Mob Prep (amebuilders.org) API ---------- */
const MPAPI='https://api.amebuilders.org/v1';
const MP={tok(){try{return localStorage.getItem('mpTok')||''}catch(e){return ''}},
  async login(email,pw){const r=await fetch(MPAPI+'/users/login',{method:'POST',headers:{'Content-Type':'application/json',accept:'application/json'},body:JSON.stringify({email,password:pw})});if(!r.ok)throw new Error('Mob Prep sign-in failed — check email/password');const j=await r.json();localStorage.setItem('mpTok',j.access_token);localStorage.setItem('mpEmail',email);MP.cache={};return j},
  logout(){try{localStorage.removeItem('mpTok')}catch(e){}MP.cache={}},
  async call(p,opt={}){const r=await fetch(MPAPI+p,{...opt,headers:{accept:'application/json','Content-Type':'application/json',Authorization:'Bearer '+MP.tok(),...(opt.headers||{})}});
    if(r.status===401||r.status===403){MP.logout();throw new Error('Mob Prep session expired — connect again')}if(r.status===404)return null;if(!r.ok)throw new Error('Mob Prep error '+r.status+': '+(await r.text()).slice(0,160));return r.status===204?{}:r.json()},
  cache:{},async get(p){if(!MP.cache[p])MP.cache[p]=MP.call(p).catch(e=>{delete MP.cache[p];throw e});return MP.cache[p]}};
window.MP=MP;
async function mpJobs(){const [sj,pr]=await Promise.all([MP.get('/spectrum/jobs'),MP.get('/projects')]);const m=new Map();
  (sj?.jobs||[]).forEach(j=>m.set(String(j.Job_Number).trim(),{no:String(j.Job_Number).trim(),name:(j.Job_Description||'').trim(),city:j.City||'',addr:[j.Address_1,j.City,[j.State,j.Zip_Code].filter(Boolean).join(' ')].filter(Boolean).join(', '),active:j.Status_Code==='A',spectrum:true}));
  (pr?.projects||[]).forEach(p=>{const k=String(p.metadata.custom_id).trim();const o=m.get(k)||{no:k,name:p.metadata.project_name,active:p.metadata.status!=='completed'};o.pid=p.metadata.id;o.mp=true;m.set(k,o)});
  const L=[...m.values()].sort((a,b)=>b.no.localeCompare(a.no,undefined,{numeric:true}));
  try{const jobs=L.map(j=>({no:j.no,name:j.name||'',city:j.city||'',addr:j.addr||'',active:!!j.active}));db.doc('config/spectrum').get().then(c=>{const o=c.data()||{};if(JSON.stringify(o.jobs)!==JSON.stringify(jobs))db.doc('config/spectrum').set({jobs,at:new Date().toISOString(),by:curUser||''})}).catch(()=>{})}catch(e){}
  return L}
async function mpUsers(){const u=await MP.get('/users');return (u?.users||[]).filter(x=>x.is_active!==false)}
async function sendToMobPrep(){if(!MP.tok()){connectDlg(sendToMobPrep);return}const num=String(W.job||'').replace(/^#/,'');if(!num){toast('Pick the job first.');return}
  if(!confirm('Create this prep list in Mob Prep (amebuilders.org) under job '+num+'?'))return;
  try{toast('Sending to Mob Prep…');let p=await MP.call('/projects/custom/'+encodeURIComponent(num));let pid=p?.metadata?.id;
    if(!pid){const c=await MP.call('/projects',{method:'POST',body:JSON.stringify({custom_id:num,project_name:W.jobName||jobLabel(W.job).replace(/^#\S+\s·\s/,'')||num,project_location:'',integrated_with_spectrum:true})});pid=c?.metadata?.id}
    if(!pid)throw new Error('Could not create the project');
    const me=await MP.get('/users/me');const body={pm_id:W.mpPm||null,fm_id:W.mpFm||null,mob_prep_preparer_id:me?.id||null,crew_size:W.crew,notes:'From AME App',surface_type_ids:W.st};
    const ct=await MP.call('/projects/'+pid+'/contents',{method:'POST',body:JSON.stringify(body)});const cid=ct?.id;if(!cid)throw new Error('Could not create the prep list');
    let n=0;for(const l of W.lines||[]){if(!l.rid)continue;try{await MP.call('/projects/'+pid+'/contents/'+cid+'/items',{method:'POST',body:JSON.stringify({item_id:l.rid,quantity:l.n})});n++}catch(e){console.warn(e)}}
    try{await MP.call('/projects/'+pid+'/contents/'+cid,{method:'PUT',body:JSON.stringify({status:'mob_prep'})})}catch(e){}
    W.mp={pid,cid,num,at:new Date().toISOString(),items:n};await save(W.status||'draft',{mp:W.mp});MP.cache={};toast('Sent to Mob Prep: job '+num+' · '+n+' items');render()}
  catch(e){toast(e.message||String(e))}}
function connectDlg(after){const r=document.getElementById('dlgRoot');let em='';try{em=localStorage.getItem('mpEmail')||''}catch(e){}
  r.innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>Connect Mob Prep</h3><p class="muted">Sign in with your amebuilders.org account. Job numbers come from Spectrum through Mob Prep. Your password is sent only to amebuilders.org and is not saved; this device stays connected.</p>
   <div class="fields"><label class="f">Email<input id="mpE" type="email" autocomplete="username" value="${esc(em)}"></label><label class="f">Password<input id="mpP" type="password" autocomplete="current-password"></label></div>
   <div class="bar"><button class="btn" id="mpC">Cancel</button><button class="go" id="mpGo" style="width:auto">Connect</button></div></div></div>`;
  document.getElementById('mpC').onclick=closeDlg;document.getElementById('mpGo').onclick=async()=>{const b=document.getElementById('mpGo');b.disabled=true;b.textContent='Connecting…';
    try{await MP.login(document.getElementById('mpE').value.trim(),document.getElementById('mpP').value);closeDlg();toast('Mob Prep connected');if(after)after();else render()}catch(e){toast(e.message);b.disabled=false;b.textContent='Connect'}}}

/* ---------- matching ref items to yard inventory ---------- */
function bestYard(name){const a=norm(name);if(!a.length)return null;let best=null,bs=0;
  for(const it of items){const b=norm(it.name+' '+(it.size||''));if(!b.length)continue;const hit=a.filter(w=>b.includes(w)).length;const sc=hit/Math.max(a.length,Math.min(b.length,a.length+2));
    if(sc>bs){bs=sc;best=it}}
  return bs>=0.5?best:null}
function yardFor(line){if(line.yid&&byId(line.yid))return byId(line.yid);if(line.nolink)return null;const m=line.rid&&MAP[line.rid];if(m&&byId(m))return byId(m);return line.rid?bestYard(line.name):null}

/* ---------- data ---------- */
function load(){db.doc('mplref/ref').onSnapshot(s=>{REF=s.data()||null;if(isOn())render()},()=>{});
  db.collection('mpl').onSnapshot(s=>{MPLS=s.docs.map(d=>({...d.data(),_id:d.id}));AME.badges&&AME.badges();if(isOn())render()},()=>{});
  db.doc('config/spectrum').onSnapshot(s=>{SPC=s.data()||null},()=>{});
  db.doc('config/mplmap').onSnapshot(s=>{MAP=s.data()||{}},()=>{});
  db.doc('config/mplchain').onSnapshot(s=>{CH=s.data()||{};if(isOn()&&document.getElementById('chDlg'))chDraw()},()=>{})}
const isOn=()=>el()&&!el().hidden;
window.addEventListener('message',async e=>{if(e.origin!=='https://amebuilders.org'||!e.data||e.data.type!=='MPLREF')return;
  try{await db.doc('mplref/ref').set(e.data.ref);toast('Mob Prep reference data imported: '+e.data.ref.its.length+' items, '+e.data.ref.asm.length+' assemblies');try{e.source.postMessage({type:'MPLREF_OK'},e.origin)}catch(x){}}catch(err){toast('Import failed: '+(err.message||err))}});

/* ---------- generation ---------- */
function generate(stIds){const S=new Set(stIds),m=new Map();
  for(const a of REF.asm){if(!a[2].some(x=>S.has(x)))continue;for(const [rid,q] of a[3]){const r=rItem(rid);if(!r)continue;const cur=m.get(rid);if(!cur||cur.n<q)m.set(rid,{rid,name:r[1],cat:r[2],sub:r[3],unit:r[4],n:Math.max(1,q),from:a[1]})}}
  for(const st of stIds){const o=(CH.sys||{})[st];if(!o)continue;(o.rm||[]).forEach(r=>{const c=m.get(r);if(c&&!(c.keep))m.delete(r)});
    (o.add||[]).forEach(x=>{const r=rItem(x.rid);const name=r?r[1]:x.name;if(!name)return;const cur=m.get(x.rid);const q=Math.max(1,+x.q||1);if(!cur||cur.n<q||cur.from!=='admin')m.set(x.rid,{rid:r?x.rid:'',cid:r?'':x.rid,name,cat:r?r[2]:(x.cat||'Custom'),sub:r?r[3]:'',unit:r?r[4]:(x.unit||'EA'),n:q,from:'Admin: '+stName(st),keep:1})})}
  return [...m.values()].map(x=>{delete x.keep;if(!x.rid&&x.cid)delete x.cid;return x})}
function baseFor(st){const m=new Map();for(const a of REF.asm){if(!a[2].includes(st))continue;for(const [rid,q] of a[3]){const r=rItem(rid);if(!r)continue;const c=m.get(rid);if(!c||c.n<q)m.set(rid,{rid,name:r[1],cat:r[2],unit:r[4],n:Math.max(1,q)})}}return m}
/* ---------- admin: edit system item chains ---------- */
let chSt=null,chQ='';
function chOv(st){CH.sys=CH.sys||{};return CH.sys[st]=CH.sys[st]||{add:[],rm:[]}}
async function chSave(){try{await db.doc('config/mplchain').set({sys:CH.sys||{},at:new Date().toISOString(),by:curUser||''})}catch(e){toast('Could not save: '+(e.message||e))}}
function chEdit(){chSt=chSt||(kids(8)[0]||REF.st[0])[0];chQ='';document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg" id="chDlg" style="max-width:720px"></div></div>`;chDraw()}
function chDraw(){const d=document.getElementById('chDlg');if(!d)return;const par=id=>(REF.st.find(s=>s[0]===id)||[])[1]||'';
  const groups={};REF.st.filter(s=>s[2]!=null&&REF.st.some(p=>p[0]===s[2])).forEach(s=>{(groups[par(s[2])]=groups[par(s[2])]||[]).push(s)});
  const o=(CH.sys||{})[chSt]||{add:[],rm:[]};const base=baseFor(chSt);const rm=new Set(o.rm||[]);
  const rows=[...base.values()].map(x=>({...x,src:'base',off:rm.has(x.rid)}));(o.add||[]).forEach(x=>{const r=rItem(x.rid);const i=rows.findIndex(y=>y.rid===x.rid);const row={rid:x.rid,name:r?r[1]:x.name,cat:r?r[2]:(x.cat||'Custom'),unit:r?r[4]:(x.unit||'EA'),n:+x.q||1,src:'add'};if(i>=0)rows[i]={...row,src:'chg'};else rows.push(row)});
  rows.sort((a,b)=>(a.off-b.off)||String(a.cat).localeCompare(String(b.cat))||a.name.localeCompare(b.name));
  const q=chQ.toLowerCase();const have=new Set(rows.filter(r=>!r.off).map(r=>r.rid));
  const hits=q.length>1?REF.its.filter(r=>!have.has(r[0])&&(r[1]+' '+r[2]+' '+(r[3]||'')).toLowerCase().includes(q)).slice(0,12):[];
  d.innerHTML=`<h3>Edit system item lists</h3><p class="muted" style="margin-top:0">Items that come up when this system is picked in a new MPL. Changes apply to new MPLs — MPLs already made don't change.</p>
   <label class="f wide">System / deck / scope<select id="chSel">${Object.entries(groups).map(([g,l])=>`<optgroup label="${esc(g)}">${l.map(s=>`<option value="${s[0]}" ${s[0]===chSt?'selected':''}>${esc(s[1])}</option>`).join('')}</optgroup>`).join('')}</select></label>
   <div class="chadd"><input id="chQ" class="search" placeholder="Add an item — search ${REF.its.length} Mob Prep items…" value="${esc(chQ)}" autocomplete="off">${q.length>1?`<div class="chhits">${hits.map(r=>`<button type="button" data-add="${r[0]}"><b>${esc(r[1])}</b><small>${esc(r[2])}${r[4]?' · '+esc(r[4]):''}</small><span>+ Add</span></button>`).join('')}<button type="button" data-custom="1"><b>+ “${esc(chQ)}”</b><small>New custom item (not in Mob Prep)</small><span>+ Add</span></button></div>`:''}</div>
   <div class="chlist">${rows.length?rows.map(r=>`<div class="chrow ${r.off?'off':''} ${r.src!=='base'?'adm':''}"><div><b>${esc(r.name)}</b><small>${esc(r.cat||'')}${r.src==='add'?' · added by admin':r.src==='chg'?' · qty changed':''}${r.off?' · removed':''}</small></div>
     ${r.off?`<button type="button" class="btn small" data-undo="${esc(r.rid)}">Restore</button>`:`<div class="step"><button type="button" data-q="-1" data-r="${esc(r.rid)}">−</button><input inputmode="numeric" data-qi="${esc(r.rid)}" value="${r.n}"><button type="button" data-q="1" data-r="${esc(r.rid)}">+</button></div><small class="muted">${esc(r.unit||'')}</small><button type="button" class="btn small dng" data-rm="${esc(r.rid)}" data-src="${r.src}" aria-label="Remove">×</button>`}</div>`).join(''):'<p class="muted">No items linked to this one yet — add some above.</p>'}</div>
   <div class="bar"><span class="muted" style="margin-right:auto;font-size:12px">${CH.at?'Last change '+fmtD(CH.at)+' · '+esc(CH.by||''):''}</span><button class="go" id="chX" style="width:auto">Done</button></div>`;
  const sel=d.querySelector('#chSel');sel.onchange=()=>{chSt=+sel.value||sel.value;chQ='';chDraw()};
  const qi=d.querySelector('#chQ');qi.oninput=()=>{chQ=qi.value;const p=qi.selectionStart;chDraw();const n=document.getElementById('chQ');n.focus();n.setSelectionRange(p,p)};
  d.querySelector('#chX').onclick=closeDlg;
  const setQ=(rid,n)=>{const o=chOv(chSt);n=Math.max(1,n|0);const r=rItem(rid);const ex=o.add.find(x=>x.rid==rid);const b=baseFor(chSt).get(rid);
    if(b&&b.n===n&&ex){o.add=o.add.filter(x=>x!==ex)}else if(ex)ex.q=n;else o.add.push({rid,q:n});chSave();chDraw()};
  const ridOf=v=>{const n=+v;return Number.isFinite(n)&&String(n)===v?n:v};
  d.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const rid=ridOf(b.dataset.add);const o=chOv(chSt);o.rm=(o.rm||[]).filter(x=>x!=rid);if(!o.add.some(x=>x.rid==rid))o.add.push({rid,q:1});chQ='';chSave();chDraw()});
  const cu=d.querySelector('[data-custom]');if(cu)cu.onclick=()=>{const o=chOv(chSt);o.add.push({rid:'c'+Date.now().toString(36),q:1,name:chQ.trim(),cat:'Custom',unit:'EA'});chQ='';chSave();chDraw()};
  d.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const rid=ridOf(b.dataset.rm);const o=chOv(chSt);o.add=o.add.filter(x=>x.rid!=rid);if(baseFor(chSt).has(rid)&&!o.rm.some(x=>x==rid))o.rm.push(rid);chSave();chDraw()});
  d.querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>{const rid=ridOf(b.dataset.undo);const o=chOv(chSt);o.rm=o.rm.filter(x=>x!=rid);chSave();chDraw()});
  d.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const rid=ridOf(b.dataset.r);const i=d.querySelector(`[data-qi="${b.dataset.r}"]`);setQ(rid,(+i.value||1)+ +b.dataset.q)});
  d.querySelectorAll('[data-qi]').forEach(i=>i.onchange=()=>setQ(ridOf(i.dataset.qi),+i.value||1))}

/* ---------- UI ---------- */
function render(){const box=el();if(!box)return;
  if(!REF){box.innerHTML=`<h2>Mobilization Prep List</h2><div class="panel"><p>The Mob Prep reference data (roof systems, deck types, assemblies and items) hasn't been imported yet.</p>
    <p class="muted">Kyle: open amebuilders.org signed in, then Claude runs the one-time import. ${isOwner(curUser)?'':''}</p></div>`;return}
  if(view==='list')return renderList();if(view==='wiz')return renderWiz();if(view==='view')return renderView()}
function stat(m){return m.status==='closed'?'<span class="pill p-good">Closed</span>':m.status==='out'?'<span class="pill p-needs">Out on job</span>':'<span class="pill p-ver">Draft</span>'}
async function delMpl(id){const m=MPLS.find(x=>x._id===id);if(!m)return;if(!confirm('Delete the MPL for '+jobLabel(m.job)+'?'+(m.status==='out'?'\n\nIts items are still checked out — they stay out on the job (return them with Return).':'')+'\n\nYard records stay in Activity.'))return;
  try{await db.doc('mpl/'+id).delete();toast('MPL deleted');if(openId===id){openId='';view='list'}render()}catch(e){toast('Could not delete: '+(e.message||e.code))}}
function topBtns(m,id){return `<span class="mtop">${exportBtns('t')}${m&&(isAdmin||m.prep===curUser)&&id?`<button class="btn dng" data-tdel="${esc(id)}">Delete</button>`:''}</span>`}
function renderList(){if(W&&W._dirty&&W.job&&(openId||W.lines)){W._dirty=false;saveDraft(false)}const box=el();const l=[...MPLS].sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||'')));
  box.innerHTML=`<div class="mplhead"><h2>Mobilization Prep Lists</h2>${isAdmin?'<button class="btn" id="mplChain">Edit system lists</button>':''}<button class="btn pri" id="mplNew">+ New MPL</button></div>
  ${l.length?`<div class="mplcards">${l.map(m=>`<button class="mplcard" data-m="${esc(m._id)}"><b>${esc(jobLabel(m.job))}</b>${stat(m)}<small>Prepared by ${esc(m.prep||'')} · crew ${m.crew||'-'} · ${(m.lines||[]).length} items</small><small class="muted">${esc((m.st||[]).map(stName).join(', '))}</small><small class="muted">Updated ${fmtD(m.updated)}</small>${(isAdmin||m.prep===curUser)?`<span class="mcdel" data-del="${esc(m._id)}" role="button" aria-label="Delete MPL" title="Delete">${IC2.trash}</span>`:''}</button>`).join('')}</div>`:'<div class="panel muted">No MPLs yet. Tap “+ New MPL” to prepare a job.</div>'}`;
  {const cb=document.getElementById('mplChain');if(cb)cb.onclick=chEdit}
  document.getElementById('mplNew').onclick=()=>{openId='';W={step:0,job:'',pm:'',fm:'',crew:6,st:[],lines:null,prep:curUser};openId='';view='wiz';render()};
  box.querySelectorAll('[data-del]').forEach(x=>x.onclick=e=>{e.stopPropagation();delMpl(x.dataset.del)});
  box.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const m=MPLS.find(x=>x._id===b.dataset.m);if(!m)return;openId=m._id;
    if(m.status==='draft'){W={...JSON.parse(JSON.stringify(m)),step:4,_seg:'yard'};view='wiz'}else view='view';render()})}
function crumbs(){return `<div class="mplsteps">${STEPS.map(([k,l],n)=>`<button data-st="${n}" class="${n===W.step?'on':n<W.step?'done':''}" ${n>W.step+0&&!W.lines?'disabled':''}><span>${n+1}</span>${l}</button>`).join('')}</div>`}
function chips(list,sel,attr){return `<div class="mplchips">${list.map(([id,name])=>`<button data-${attr}="${id}" aria-pressed="${sel.includes(id)}">${esc(name)}</button>`).join('')}</div>`}
let svT=null;const snap=()=>JSON.stringify([W.job,W.jobName,W.mpPm,W.mpFm,W.pm,W.fm,W.crew,W.st,W.lines]);
async function saveDraft(manual){clearTimeout(svT);if(!W||!W.job)return;try{await save(W.status==='out'||W.status==='closed'?W.status:'draft');W._saved=snap();W._dirty=false;const e=document.getElementById('mSv');if(e)e.textContent='All changes saved';const b=document.getElementById('mSave');if(b)b.classList.remove('pri');if(manual)toast('MPL saved')}catch(e){toast('Could not save: '+(e.message||e))}}
(window.ameSaveHooks=window.ameSaveHooks||[]).push(async()=>{if(view==='wiz'&&W&&W.job&&W._dirty)await saveDraft(false)});
window.addEventListener('beforeunload',e=>{if(view==='wiz'&&W&&W._dirty){e.preventDefault();e.returnValue=''}});
function renderWiz(){if(W&&W._saved===undefined)W._saved=openId?snap():'';W._dirty=!!W.job&&!!(openId||W.lines)&&snap()!==W._saved;if(W._dirty){clearTimeout(svT);svT=setTimeout(()=>{if(view==='wiz')saveDraft(false)},2500)}const box=el();const s=W.step;let body='',next='Next';
  if(s===0){body=jobStep()}
  else if(s===1){body=`<h3>Roof system</h3><p class="muted">Pick every system on this job.</p>${chips(kids(8).map(x=>[x[0],x[1]]),W.st,'s')}`}
  else if(s===2){body=`<h3>Deck type</h3>${chips(kids(1).map(x=>[x[0],x[1]]),W.st,'s')}`}
  else if(s===3){body=`<h3>Other scope</h3><p class="muted">Tap what applies. Each choice adds its tools and supplies.</p>`+SCOPE_PARENTS.map(p=>{const k=kids(p);if(!k.length)return'';return `<div class="qlabel">${esc(stName(p))}</div>${chips(k.map(x=>[x[0],x[1]]),W.st,'s')}`}).join('');next='Build the list'}
  else if(s===4){if(!W.lines)W.lines=generate(W.st);if(!W._seg)W._seg='yard';body=listHtml();next='Review check-out'}
  else if(s===5){body=goHtml();next=''}
  box.innerHTML=`<div class="mplhead"><button class="btn" id="mBack">← All MPLs</button><h2>${W.job?esc(jobLabel(W.job)):'New MPL'}</h2>${W.step>=4?topBtns(W,openId):''}</div>${crumbs()}<div class="panel mplbody">${body}</div>
   <div class="mplbar">${s>=4?exportBtns():''}${s>=4?`<button class="btn" id="mSend">${W.mp?'Sent to Mob Prep ✓ (send again)':'Send to Mob Prep'}</button>`:''}${W.job?`<span class="mplsv" id="mSv">${W._dirty?'Unsaved changes':'All changes saved'}</span><button class="btn ${W._dirty?'pri':''}" id="mSave">Save</button>`:''}${next?`<button class="go" id="mNext" style="width:auto">${next}</button>`:''}</div>`;
  wire()}
let mpJ=null,mpU=null,mpErr='',jq='',mpLive=false,mpBusy=false,SPC=null;
function jobStep(){if(!MP.tok())return `<h3>Which job?</h3><div class="panel" style="margin:0"><p>Job numbers come from <b>Spectrum through Mob Prep</b>. Connect once on this device.</p><button class="go" id="mpConn" style="width:auto">Connect Mob Prep</button></div>`;
  if(!mpLive&&!mpErr&&!mpBusy){mpBusy=true;mpJobs().then(j=>{mpJ=j;mpLive=true;return mpUsers()}).then(u=>{mpU=u;mpBusy=false;render()}).catch(e=>{mpBusy=false;if(!mpJ)mpErr=e.message;render()});if(!mpJ&&SPC&&SPC.jobs&&SPC.jobs.length)mpJ=SPC.jobs.map(j=>({...j}))}
  if(!mpJ&&!mpErr)return '<h3>Which job?</h3><p class="muted">Loading jobs from Spectrum / Mob Prep…</p>';
  if(mpErr)return `<h3>Which job?</h3><p class="bad">${esc(mpErr)}</p><button class="btn" id="mpRetry">Try again</button> <button class="btn" id="mpConn">Reconnect</button>`;
  const q=jq.toLowerCase();const l=mpJ.filter(j=>j.active!==false&&(!q||j.no.includes(q)||j.name.toLowerCase().includes(q))).slice(0,60);
  const real=(mpU||[]).filter(u=>!/example\.com$/i.test(u.email||'')).map(u=>({...u,name:String(u.name||'').trim()}));
  const crewRole=u=>{const p=u.name.split(/\s+/);const k=p[0]+' '+(p[1]||'').charAt(0)+'.';return (crew.find(c=>c.name.toLowerCase()===k.toLowerCase())||{}).role||''};
  const pms=real.filter(u=>['PM','President'].includes(crewRole(u))||String(u.role).toLowerCase()==='pm').sort((a,b)=>a.name.localeCompare(b.name));
  const fms=real.filter(u=>['FM','SFM'].includes(crewRole(u))||String(u.role).toLowerCase()==='fm').sort((a,b)=>a.name.localeCompare(b.name));
  return `<h3>Which job? <small class="muted">from Spectrum · Mob Prep</small></h3><input id="mJq" class="search" placeholder="Search job # or name…" value="${esc(jq)}">
   ${(()=>{const row=j=>`<button class="jrow" data-mj="${esc(j.no)}" aria-pressed="${W.job==='#'+j.no}"><span class="jno">#${esc(j.no)}</span><span class="jnm">${esc((jobs.find(x=>x.no==='#'+j.no)||{}).name||j.name||'')}</span><span class="jct">${esc(j.city||'')}</span>${j.mp?'<span class="jmp">Mob Prep</span>':'<span></span>'}</button>`;
     const num=l.filter(j=>/^\d+$/.test(j.no)),oth=l.filter(j=>!/^\d+$/.test(j.no));
     return l.length?`<div class="jlist">${num.map(row).join('')}</div>${oth.length?`<div class="qlabel" style="margin-top:12px">Other</div><div class="jlist">${oth.map(row).join('')}</div>`:''}`:'<div class="muted">No match.</div>'})()}
   ${W.job?`<div class="fields"><label class="f wide">Job name (as we call it)<input id="mJn" value="${esc(W.jobName||'')}" placeholder="e.g. Fullerton"></label></div>`:''}
   <div class="fields"><label class="f">Prepared by<input value="${esc(W.prep||curUser)}" disabled></label>
   <label class="f">Crew size<div class="step"><button data-cr="-1">−</button><b>${W.crew}</b><button data-cr="1">+</button></div></label>
   <label class="f">PM<select id="mPm"><option value="">—</option>${pms.map(u=>`<option value="${esc(u.id)}" ${u.id===W.mpPm?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>
   <label class="f">FM / SFM<select id="mFm"><option value="">—</option>${fms.map(u=>`<option value="${esc(u.id)}" ${u.id===W.mpFm?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label></div>
   <p class="muted" style="font-size:12.5px">Connected as ${esc((()=>{try{return localStorage.getItem('mpEmail')}catch(e){return ''}})()||'')} · <a href="#" id="mpOut">disconnect</a></p>`}
function listHtml(){const seg=W._seg||'all';const inY=l=>!!yardFor(l);const nY=W.lines.filter(inY).length,nB=W.lines.length-nY;
  const g={};W.lines.forEach((l,k)=>{if(seg==='yard'&&!inY(l))return;if(seg==='buy'&&inY(l))return;(g[l.cat||'Custom']=g[l.cat||'Custom']||[]).push([l,k])});
  const cats=Object.keys(g).sort((a,b)=>(ORDER.indexOf(a)+99)%99-(ORDER.indexOf(b)+99)%99);
  return `<div class="mplseg"><button data-seg="yard" aria-pressed="${seg==='yard'}"><b>From the yard</b><small>${nY} item${nY===1?'':'s'} to take out</small></button><button data-seg="buy" aria-pressed="${seg==='buy'}"><b>To buy / rent</b><small>${nB} item${nB===1?'':'s'} not in inventory</small></button><button data-seg="all" aria-pressed="${seg==='all'}"><b>All</b><small>${W.lines.length}</small></button></div>
   <div class="mplhead2"><h3>${seg==='yard'?'From the yard':seg==='buy'?'To buy / rent':'Item list'} · ${seg==='yard'?nY:seg==='buy'?nB:W.lines.length}</h3><button class="btn" id="mAdd">+ Add ${seg==='yard'?'yard item':seg==='buy'?'item to buy':'item'}</button></div>
   <p class="muted">${seg==='yard'?'These come out of the yard inventory when you check out. Remove what the job doesn’t need and set quantities.':seg==='buy'?'Not in the yard inventory — these need to be bought, rented or brought otherwise. Add or remove as needed.':'Remove what this job doesn\'t need and set quantities. “In yard” items will be taken out of the yard inventory when you check out.'}</p>
   ${Object.keys(g).length?'':`<div class="panel muted">Nothing here yet — tap “+ Add”.</div>`}
   ${cats.map(c=>`<div class="qlabel">${esc(c)}</div><div class="mpllines">${g[c].map(([l,k])=>{const y=yardFor(l);const av=y?Number(y.qty)||0:0;
     return `<div class="mline"><div class="mname"><b>${esc(l.name)}</b><small>${esc(l.sub||'')}${l.from?' · '+esc(l.from):''}</small>
       <button class="ylink ${y?(av>=l.n?'ok':'low'):'none'}" data-yl="${k}">${y?`In yard: ${av} ${esc(y.unit||'')} · ${esc(y.loc)}${av<l.n?' (short)':''}`:'Not in yard inventory — tap to link'}</button></div>
       <div class="step"><button data-q="${k}" data-d="-1">−</button><b>${l.n}</b><button data-q="${k}" data-d="1">+</button></div><button class="mx" data-rm="${k}" aria-label="Remove">✕</button></div>`}).join('')}</div>`).join('')}`}
function goLines(){return W.lines.map(l=>{const y=yardFor(l);return {l,y,take:y?Math.max(0,Math.min(l.n,Number(y.qty)||0)):0}})}
function goHtml(){const g=goLines();const yard=g.filter(x=>x.y),other=g.filter(x=>!x.y);
  return `<h3>Check out from the yard</h3><p class="muted">These come out of the yard inventory as <b>Take Out → ${esc(jobLabel(W.job))}</b>. You can return them anytime with Return, or close out this MPL when the job ends.</p>
   <div class="tblwrap"><table><thead><tr><th>Item</th><th>Yard item</th><th>Need</th><th>Taking</th></tr></thead><tbody>${yard.map(x=>`<tr><td>${esc(x.l.name)}</td><td>${esc(x.y.name)} <small class="muted">${esc(x.y.loc)}</small></td><td class="n">${x.l.n}</td><td class="n ${x.take<x.l.n?'bad':''}">${x.take}</td></tr>`).join('')}</tbody></table></div>
   ${other.length?`<div class="qlabel">Not from the yard (buy / rent / bring otherwise) · ${other.length}</div><div class="muted" style="font-size:13px">${other.map(x=>esc(x.l.name)+' ×'+x.l.n).join(' · ')}</div>`:''}
   <div class="mplbar"><button class="go" id="mGo" ${yard.some(x=>x.take>0)&&W.job?'':'disabled'}>Check out ${yard.filter(x=>x.take>0).length} items from the yard</button></div>`}
function wire(){const box=el();const q=(s,f)=>box.querySelectorAll(s).forEach(f);
  document.getElementById('mBack').onclick=()=>{view='list';render();scrollTo({top:0})};
  q('[data-st]',b=>b.onclick=()=>{const n=+b.dataset.st;if(n<=W.step||W.lines){if(n===5&&!W.lines)return;W.step=n;render()}});
  q('[data-mj]',b=>b.onclick=()=>{const j=mpJ.find(x=>x.no===b.dataset.mj);W.job='#'+j.no;const reg=jobs.find(x=>x.no==='#'+j.no);W.jobName=(reg&&reg.name)||j.name;W.city=j.city||'';W.mpPid=j.pid||null;render()});
  const jn=document.getElementById('mJn');if(jn)jn.onchange=()=>{W.jobName=jn.value.trim()};
  const jqi=document.getElementById('mJq');if(jqi)jqi.oninput=()=>{jq=jqi.value;const p=jqi.selectionStart;render();const n=document.getElementById('mJq');n.focus();n.setSelectionRange(p,p)};
  const cn=document.getElementById('mpConn');if(cn)cn.onclick=()=>connectDlg(()=>{mpJ=null;mpLive=false;mpErr='';render()});
  const rt=document.getElementById('mpRetry');if(rt)rt.onclick=()=>{mpErr='';mpJ=null;mpLive=false;MP.cache={};render()};
  const mo=document.getElementById('mpOut');if(mo)mo.onclick=e=>{e.preventDefault();MP.logout();mpJ=null;mpLive=false;render()};
  const mj=document.getElementById('mJob');if(mj)mj.onchange=()=>{W.job=normJob(mj.value)};
  q('[data-cr]',b=>b.onclick=()=>{W.crew=Math.max(1,W.crew+ +b.dataset.cr);render()});
  const pm=document.getElementById('mPm');if(pm)pm.onchange=()=>{W.mpPm=pm.value;W.pm=pm.selectedOptions[0]?.text||''};const fm=document.getElementById('mFm');if(fm)fm.onchange=()=>{W.mpFm=fm.value;W.fm=fm.selectedOptions[0]?.text||''};
  q('[data-s]',b=>b.onclick=()=>{const id=+b.dataset.s;W.st=W.st.includes(id)?W.st.filter(x=>x!==id):[...W.st,id];if(W.lines&&W.step<4)W.lines=null;render()});
  q('[data-q]',b=>b.onclick=()=>{const l=W.lines[+b.dataset.q];l.n=Math.max(1,l.n+ +b.dataset.d);render()});
  q('[data-rm]',b=>b.onclick=()=>{W.lines.splice(+b.dataset.rm,1);render()});
  q('[data-yl]',b=>b.onclick=()=>linkYard(+b.dataset.yl));
  const ad=document.getElementById('mAdd');if(ad)ad.onclick=addItem;q('[data-seg]',b=>b.onclick=()=>{W._seg=b.dataset.seg;render()});
  wireExport();
  const sd=document.getElementById('mSend');if(sd)sd.onclick=sendToMobPrep;
  const sv=document.getElementById('mSave');if(sv)sv.onclick=()=>saveDraft(true);
  const nx=document.getElementById('mNext');if(nx)nx.onclick=()=>{if(W.step===0){if(!W.job){toast('Pick the job first.');return}}
    if(W.step===3&&!W.st.length){toast('Pick at least one scope.');return}if(W.step===3)W.lines=generate(W.st);W.step++;render();scrollTo({top:0})};
  const go=document.getElementById('mGo');if(go)go.onclick=checkout}
async function save(status,extra){const now=new Date().toISOString();const d={job:W.job,jobName:W.jobName||'',mpPm:W.mpPm||'',mpFm:W.mpFm||'',mp:W.mp||null,pm:W.pm||'',fm:W.fm||'',crew:W.crew,prep:W.prep||curUser,st:W.st,lines:W.lines||[],status,updated:now,created:W.created||now,...(extra||{})};
  if(!openId)openId='m'+Date.now().toString(36);W.created=d.created;await db.doc('mpl/'+openId).set(d);return d}
function pickDlg(title,list,onPick){let qv='';const draw=()=>{const l=list.filter(x=>!qv||x.t.toLowerCase().includes(qv)).slice(0,120);
  document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>${title}</h3><input id="pdq" class="search" placeholder="Search…" value="${esc(qv)}"><div class="qpl" style="max-height:55vh">${l.map((x,n)=>`<button class="qpi" data-pi="${n}"><b>${esc(x.t)}</b><span>${esc(x.s||'')}</span></button>`).join('')||'<div class="muted" style="padding:10px">No match</div>'}</div><div class="bar"><button class="btn" id="pdc">Cancel</button></div></div></div>`;
  const i=document.getElementById('pdq');i.focus();i.setSelectionRange(qv.length,qv.length);i.oninput=()=>{qv=i.value.toLowerCase();draw()};document.getElementById('pdc').onclick=closeDlg;
  document.querySelectorAll('[data-pi]').forEach(b=>b.onclick=()=>{onPick(l[+b.dataset.pi]);closeDlg()})};draw()}
function linkYard(k){const l=W.lines[k];pickDlg('Link “'+esc(l.name)+'” to a yard item',[{t:'— Not a yard item —',s:'buy / rent',none:1},...items.map(i=>({t:i.name,s:[i.size,i.mfgr,i.loc].filter(Boolean).join(' · '),i}))],async x=>{
  if(x.none){l.yid='';l.nolink=true}else{l.yid=x.i.id;l.nolink=false;if(l.rid){MAP={...MAP,[l.rid]:x.i.id};try{await db.doc('config/mplmap').set(MAP)}catch(e){}}}render()})}
function addItem(){const seg=W._seg||'all';const yl=items.filter(i=>!W.lines.some(l=>l.yid===i.id)).map(i=>({t:i.name,s:'Yard · '+[i.size,i.loc,(Number(i.qty)||0)+' '+(i.unit||'')].filter(Boolean).join(' · '),i}));
  const rl=REF.its.filter(r=>!W.lines.some(l=>l.rid===r[0])).filter(r=>seg!=='buy'||!(MAP[r[0]]&&byId(MAP[r[0]]))).map(r=>({t:r[1],s:r[2]+' · '+r[3],r}));
  const list=seg==='yard'?yl:seg==='buy'?[{t:'+ Type a new item…',s:'not on any list',custom:1},...rl]:[...rl,...yl];
  pickDlg(seg==='yard'?'Add a yard item':seg==='buy'?'Add an item to buy / rent':'Add an item',list,x=>{
  if(x.custom){setTimeout(()=>{const n=prompt('Item to buy / rent:');if(n&&n.trim()){W.lines.push({name:n.trim(),cat:'Custom',sub:'To buy',unit:'EA',n:1,from:'Added',nolink:true});render()}},50);return}
  if(x.r&&seg==='buy'){W.lines.push({rid:x.r[0],name:x.r[1],cat:x.r[2],sub:x.r[3],unit:x.r[4],n:1,from:'Added',nolink:true});render();return}
  if(x.r)W.lines.push({rid:x.r[0],name:x.r[1],cat:x.r[2],sub:x.r[3],unit:x.r[4],n:1,from:'Added'});else W.lines.push({yid:x.i.id,name:x.i.name,cat:'Custom',sub:'From yard',unit:x.i.unit,n:1,from:'Added'});render()})}
async function addJobIfMissing(job,now){const ex=jobs.find(j=>j.no===job);if(ex&&W.jobName&&ex.name!==W.jobName){try{await db.doc('jobs/'+ex._id).update({name:W.jobName})}catch(e){}}if(job&&!ex){try{await db.doc('jobs/J'+job.replace(/[^A-Za-z0-9]/g,'')).set({no:job,name:W.jobName||'',pm:W.pm||'',fm:W.fm||'',address:'',status:'Active',notes:'Added from MPL by '+curUser,autoAdded:true,updatedAt:now})}catch(e){}}}
async function checkout(){const g=goLines().filter(x=>x.y&&x.take>0);if(!g.length)return;if(!confirm(`Take ${g.length} items out of the yard to ${jobLabel(W.job)}?`))return;
  const b=document.getElementById('mGo');b.disabled=true;b.textContent='Checking out…';const now=new Date().toISOString();await addJobIfMissing(W.job,now);let ok=0;
  for(const x of g){const it=byId(x.y.id);if(!it)continue;const before=Number(it.qty)||0,n=Math.min(x.take,before);if(n<=0)continue;
    try{await writeItem(it.id,{qty:before-n,out:(it.out||0)+n,lastJob:W.job,updatedAt:now,updatedBy:curUser});
      await db.collection('logs').add({ts:now,action:'OUT',itemId:it.id,name:it.name,size:it.size||'',unit:it.unit||'',loc:it.loc,n,before,after:before-n,job:W.job,by:curUser,note:'MPL check-out',cond:''});
      x.l.yid=it.id;x.l.taken=n;ok++}catch(e){toast('Could not take '+it.name+': '+(e.message||e.code))}}
  await save('out',{outAt:now,outBy:curUser});toast(ok+' items checked out to '+jobLabel(W.job));view='view';render()}
function renderView(){const box=el();const m=MPLS.find(x=>x._id===openId);if(!m){view='list';return render()}
  const taken=(m.lines||[]).filter(l=>l.taken>0);
  box.innerHTML=`<div class="mplhead"><button class="btn" id="mBack">← All MPLs</button><h2>${esc(jobLabel(m.job))}</h2>${stat(m)}${topBtns(m,m._id)}</div>
   <div class="panel"><p class="muted">Prepared by ${esc(m.prep||'')} · PM ${esc(m.pm||'—')} · FM ${esc(m.fm||'—')} · crew ${m.crew||'-'}<br>${esc((m.st||[]).map(stName).join(', '))}</p>
   ${m.status==='out'?`<h3>Close out — what came back?</h3><p class="muted">Set how many of each came back to the yard. Anything not returned is logged as lost / used on the job.</p>`:'<h3>Items</h3>'}
   <div class="mpllines">${(m.lines||[]).map((l,k)=>`<div class="mline"><div class="mname"><b>${esc(l.name)}</b><small>${l.taken?`Taken from yard: ${l.taken}`:'Not from yard'}${l.back!=null?` · Returned ${l.back}`:''}</small></div>
     ${m.status==='out'&&l.taken?`<div class="step"><button data-b="${k}" data-d="-1">−</button><b id="bk${k}">${l.taken}</b><button data-b="${k}" data-d="1">+</button></div>`:`<span class="muted">×${l.n}</span>`}</div>`).join('')}</div></div>
   <div class="mplbar">${exportBtns()}${m.status==='out'?`<button class="go" id="mClose" style="width:auto">Close out · return to yard</button>`:''}${m.status!=='out'&&isAdmin?'<button class="btn dng" id="mDel">Delete MPL</button>':''}</div>`;
  document.getElementById('mBack').onclick=()=>{view='list';render()};wireExport();
  const back={};taken.forEach(l=>back[m.lines.indexOf(l)]=l.taken);
  box.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{const k=+b.dataset.b;back[k]=Math.min(m.lines[k].taken,Math.max(0,back[k]+ +b.dataset.d));document.getElementById('bk'+k).textContent=back[k]});
  const del=document.getElementById('mDel');if(del)del.onclick=async()=>{if(!confirm('Delete this MPL? Yard records stay in Activity.'))return;await db.doc('mpl/'+m._id).delete();view='list';render()};
  const cl=document.getElementById('mClose');if(cl)cl.onclick=async()=>{if(!confirm('Close out this MPL and return the items to the yard?'))return;cl.disabled=true;cl.textContent='Closing…';const now=new Date().toISOString();const lines=JSON.parse(JSON.stringify(m.lines));
    for(const [k,l] of lines.entries()){if(!l.taken||!l.yid)continue;const it=byId(l.yid);if(!it)continue;const r=back[k]??l.taken,lost=l.taken-r,before=Number(it.qty)||0;
      try{await writeItem(it.id,{qty:before+r,out:Math.max(0,(it.out||0)-l.taken),updatedAt:now,updatedBy:curUser});
        if(r>0)await db.collection('logs').add({ts:now,action:'RETURN',itemId:it.id,name:it.name,size:it.size||'',unit:it.unit||'',loc:it.loc,n:r,before,after:before+r,job:m.job,by:curUser,note:'MPL close-out',cond:'Good'});
        if(lost>0)await db.collection('logs').add({ts:now,action:'LOST',itemId:it.id,name:it.name,size:it.size||'',unit:it.unit||'',loc:it.loc,n:lost,before:before+r,after:before+r,job:m.job,by:curUser,note:'MPL close-out — not returned',cond:''});
        l.back=r}catch(e){toast('Could not return '+it.name+': '+(e.message||e.code))}}
    await db.doc('mpl/'+m._id).update({lines,status:'closed',closedAt:now,closedBy:curUser,updated:now});toast('MPL closed');render()}}

/* ---------- export (Excel / PDF) ---------- */
function exportRows(m){const lines=m.lines||[];const ready=[],prep=[];
  for(const l of lines){const y=l.yid?byId(l.yid):(m.status==='draft'?yardFor(l):null);const have=y?Number(y.qty)||0:0;
    if(y&&(l.taken>0||have>0)){const take=l.taken||Math.min(l.n,have);ready.push([l.cat||'',l.name,l.n,l.unit||'',y.name,y.loc+(y.level?' '+y.level:''),take]);if(take<l.n)prep.push([l.cat||'',l.name,l.n-take,l.unit||'','Short in yard (have '+have+')'])}
    else prep.push([l.cat||'',l.name,l.n,l.unit||'',y?'In yard list but 0 on hand':'Not a yard item — buy / rent'])}
  return {ready,prep}}
function exportHead(m){return [['AME Builders — Mobilization Prep List'],['Job',jobLabel(m.job)+(m.jobName&&!jobLabel(m.job).includes(m.jobName)?' · '+m.jobName:'')],['Prepared by',m.prep||''],['PM',m.pm||''],['FM',m.fm||''],['Crew size',m.crew||''],['Roof system',(()=>{const R=new Set(kids(8).map(x=>x[0]));const r=(m.st||[]).filter(i=>R.has(i)).map(stName);return r.join(', ')||'—'})()],['Status',m.status||''],['Exported',new Date().toLocaleString('en-US')]]}
async function saveBlob(name,blob){const dl=await window.claude?.use?.('downloads');if(dl){await dl.save({filename:name,data:blob});return}const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove()}
function curDoc(){if(view==='wiz')return {...W,status:W.status||'draft'};return MPLS.find(x=>x._id===openId)}
async function exportXlsx(){const m=curDoc();if(!m)return;if(!window.XLSX){toast('Excel library did not load.');return}const {ready,prep}=exportRows(m);const wb=XLSX.utils.book_new();
  const s1=XLSX.utils.aoa_to_sheet([...exportHead(m),[],['FROM YARD ('+ready.length+')'],['Category','MPL item','Need','Unit','Yard item','Yard location','Pull Qty','On Truck ✓'],...ready.map(r=>[...r,''])]);s1['!cols']=[16,40,7,7,40,14,8].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,s1,'From Yard');
  const s2=XLSX.utils.aoa_to_sheet([...exportHead(m),[],['TO BUY / RENT ('+prep.length+')'],['Category','Item','Needed','Unit','Prepared ✓','Note'],...prep.map(r=>[r[0],r[1],r[2],r[3],'',/Short/.test(r[4])?r[4]:''])]);s2['!cols']=[16,44,7,7,34].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,s2,'Buy - Rent');
  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});await saveBlob(`MPL_${String(m.job).replace('#','')}_${new Date().toISOString().slice(0,10)}.xlsx`,new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))}
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
async function exportPdf(){const m=curDoc();if(!m)return;try{if(!window.jspdf){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')}}catch(e){toast('PDF library did not load.');return}
  const {jsPDF}=window.jspdf;const d=new jsPDF({unit:'pt',format:'letter'});const {ready,prep}=exportRows(m);const H=exportHead(m);
  d.setFontSize(16);d.text('AME Builders — Mobilization Prep List',40,44);d.setFontSize(10);let y=64;H.slice(1).forEach(([k,v])=>{d.text(k+': '+String(v),40,y);y+=14});
  const mono={theme:'grid',styles:{fontSize:8.5,textColor:20,lineColor:120,lineWidth:.4},headStyles:{fillColor:255,textColor:0,fontStyle:'bold',lineWidth:.6}};
  d.autoTable({...mono,startY:y+8,head:[['FROM YARD ('+ready.length+')','Category','Qty','Yard location','Pull Qty','On Truck']],body:ready.map(r=>[r[1],r[0],r[2]+' '+r[3],r[5],String(r[6]),'']),columnStyles:{0:{cellWidth:190},5:{cellWidth:44}}});
  if(prep.length){d.addPage();d.setFontSize(16);d.text('Buy / Rent List',40,44);d.setFontSize(10);d.text('Job: '+H[1][1],40,64);d.text('Not in the yard inventory — buy, rent or bring otherwise.',40,78);
  d.autoTable({...mono,startY:92,head:[['TO BUY / RENT ('+prep.length+')','Category','Needed','Prepared']],body:prep.map(r=>[r[1]+(r[4]&&/Short/.test(r[4])?'  ('+r[4]+')':''),r[0],r[2]+' '+r[3],'']),columnStyles:{0:{cellWidth:250},3:{cellWidth:64}}})}
  await saveBlob(`MPL_${String(m.job).replace('#','')}_${new Date().toISOString().slice(0,10)}.pdf`,d.output('blob'))}
function exportBtns(t=''){return `<button class="btn" data-xl="1">Excel</button><button class="btn" data-pdf="1">PDF</button>`}
function wireExport(){document.querySelectorAll('#tab-mpl [data-xl]').forEach(a=>a.onclick=exportXlsx);document.querySelectorAll('#tab-mpl [data-pdf]').forEach(b=>b.onclick=exportPdf);document.querySelectorAll('#tab-mpl [data-tdel]').forEach(b=>b.onclick=()=>delMpl(b.dataset.tdel))}

/* ---------- module registration ---------- */
document.head.insertAdjacentHTML('beforeend','<style>.chadd{position:relative;margin:8px 0}.chhits{border:1px solid var(--line,#555);border-radius:10px;margin-top:4px;max-height:260px;overflow:auto}.chhits button{display:grid;grid-template-columns:1fr auto;width:100%;text-align:left;padding:8px 10px;background:none;border:0;border-bottom:1px solid var(--line,#444);color:inherit}.chhits small{grid-column:1;opacity:.7}.chhits span{grid-row:1/3;grid-column:2;align-self:center;color:#f26a1b;font-weight:700}.chlist{max-height:48vh;overflow:auto;margin:6px 0}.chrow{display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid var(--line,#444)}.chrow>div:first-child{flex:1;min-width:0}.chrow small{display:block;opacity:.7}.chrow.off{opacity:.45}.chrow.off b{text-decoration:line-through}.chrow.adm b{color:#f5a25d}.chrow .step input{width:44px;text-align:center}</style>');
AME.nav=AME.nav||{};AME.nav.mpl={get:()=>({view,openId,step:view==='wiz'&&W?W.step:null}),set:s=>{if(s.view==='wiz'&&!W)s={view:'list'};view=s.view||'list';openId=s.openId||'';if(view==='wiz'&&W&&s.step!=null)W.step=s.step;render()}};
AME.register({id:'mpl',name:'Mobilization Prep List',desc:'Job → system → deck → scope → list → yard check-out',perm:'MPL',tabs:['mpl'],section:'tab-mpl',
  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v3h6V3"/><path d="M8.5 11l1.5 1.5 3-3M8.5 16.5l1.5 1.5 3-3"/></svg>',
  open:()=>showTab('mpl'),onShow:()=>{view=view==='wiz'&&W?view:'list';render()}});
const _ar=window.applyRole;window.applyRole=function(){_ar();const b=document.querySelector('nav.tabs [data-tab="mpl"]');if(b)b.hidden=!can('MPL')};
(function wait(){if(typeof db!=='undefined'&&db&&typeof db.collection==='function'){load()}else setTimeout(wait,300)})();
})();
