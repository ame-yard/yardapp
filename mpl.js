/* AME Yard — Mobilization Prep List (MPL) module */
(function(){
let REF=null,MPLS=[],MAP={},W=null,view='list',openId='';
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
  (sj?.jobs||[]).forEach(j=>m.set(String(j.Job_Number).trim(),{no:String(j.Job_Number).trim(),name:(j.Job_Description||'').trim(),city:j.City||'',active:j.Status_Code==='A',spectrum:true}));
  (pr?.projects||[]).forEach(p=>{const k=String(p.metadata.custom_id).trim();const o=m.get(k)||{no:k,name:p.metadata.project_name,active:p.metadata.status!=='completed'};o.pid=p.metadata.id;o.mp=true;m.set(k,o)});
  return [...m.values()].sort((a,b)=>b.no.localeCompare(a.no,undefined,{numeric:true}))}
async function mpUsers(){const u=await MP.get('/users');return (u?.users||[]).filter(x=>x.is_active!==false)}
async function sendToMobPrep(){if(!MP.tok()){connectDlg(sendToMobPrep);return}const num=String(W.job||'').replace(/^#/,'');if(!num){toast('Pick the job first.');return}
  if(!confirm('Create this prep list in Mob Prep (amebuilders.org) under job '+num+'?'))return;
  try{toast('Sending to Mob Prep…');let p=await MP.call('/projects/custom/'+encodeURIComponent(num));let pid=p?.metadata?.id;
    if(!pid){const c=await MP.call('/projects',{method:'POST',body:JSON.stringify({custom_id:num,project_name:W.jobName||jobLabel(W.job).replace(/^#\S+\s·\s/,'')||num,project_location:'',integrated_with_spectrum:true})});pid=c?.metadata?.id}
    if(!pid)throw new Error('Could not create the project');
    const me=await MP.get('/users/me');const body={pm_id:W.mpPm||null,fm_id:W.mpFm||null,mob_prep_preparer_id:me?.id||null,crew_size:W.crew,notes:'From AME Yard app',surface_type_ids:W.st};
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
  db.collection('mpl').onSnapshot(s=>{MPLS=s.docs.map(d=>({...d.data(),_id:d.id}));if(isOn())render()},()=>{});
  db.doc('config/mplmap').onSnapshot(s=>{MAP=s.data()||{}},()=>{})}
const isOn=()=>el()&&!el().hidden;
window.addEventListener('message',async e=>{if(e.origin!=='https://amebuilders.org'||!e.data||e.data.type!=='MPLREF')return;
  try{await db.doc('mplref/ref').set(e.data.ref);toast('Mob Prep reference data imported: '+e.data.ref.its.length+' items, '+e.data.ref.asm.length+' assemblies');try{e.source.postMessage({type:'MPLREF_OK'},e.origin)}catch(x){}}catch(err){toast('Import failed: '+(err.message||err))}});

/* ---------- generation ---------- */
function generate(stIds){const S=new Set(stIds),m=new Map();
  for(const a of REF.asm){if(!a[2].some(x=>S.has(x)))continue;for(const [rid,q] of a[3]){const r=rItem(rid);if(!r)continue;const cur=m.get(rid);if(!cur||cur.n<q)m.set(rid,{rid,name:r[1],cat:r[2],sub:r[3],unit:r[4],n:Math.max(1,q),from:a[1]})}}
  return [...m.values()]}

/* ---------- UI ---------- */
function render(){const box=el();if(!box)return;
  if(!REF){box.innerHTML=`<h2>Mobilization Prep List</h2><div class="panel"><p>The Mob Prep reference data (roof systems, deck types, assemblies and items) hasn't been imported yet.</p>
    <p class="muted">Kyle: open amebuilders.org signed in, then Claude runs the one-time import. ${isOwner(curUser)?'':''}</p></div>`;return}
  if(view==='list')return renderList();if(view==='wiz')return renderWiz();if(view==='view')return renderView()}
function stat(m){return m.status==='closed'?'<span class="pill p-good">Closed</span>':m.status==='out'?'<span class="pill p-needs">Out on job</span>':'<span class="pill p-ver">Draft</span>'}
function renderList(){const box=el();const l=[...MPLS].sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||'')));
  box.innerHTML=`<div class="mplhead"><h2>Mobilization Prep Lists</h2><button class="btn pri" id="mplNew">+ New MPL</button></div>
  ${l.length?`<div class="mplcards">${l.map(m=>`<button class="mplcard" data-m="${esc(m._id)}"><b>${esc(jobLabel(m.job))}</b>${stat(m)}<small>Prepared by ${esc(m.prep||'')} · crew ${m.crew||'-'} · ${(m.lines||[]).length} items</small><small class="muted">${esc((m.st||[]).map(stName).join(', '))}</small><small class="muted">Updated ${fmtD(m.updated)}</small></button>`).join('')}</div>`:'<div class="panel muted">No MPLs yet. Tap “+ New MPL” to prepare a job.</div>'}`;
  document.getElementById('mplNew').onclick=()=>{W={step:0,job:'',pm:'',fm:'',crew:6,st:[],lines:null,prep:curUser};openId='';view='wiz';render()};
  box.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const m=MPLS.find(x=>x._id===b.dataset.m);if(!m)return;openId=m._id;
    if(m.status==='draft'){W={...JSON.parse(JSON.stringify(m)),step:4};view='wiz'}else view='view';render()})}
function crumbs(){return `<div class="mplsteps">${STEPS.map(([k,l],n)=>`<button data-st="${n}" class="${n===W.step?'on':n<W.step?'done':''}" ${n>W.step+0&&!W.lines?'disabled':''}><span>${n+1}</span>${l}</button>`).join('')}</div>`}
function chips(list,sel,attr){return `<div class="mplchips">${list.map(([id,name])=>`<button data-${attr}="${id}" aria-pressed="${sel.includes(id)}">${esc(name)}</button>`).join('')}</div>`}
function renderWiz(){const box=el();const s=W.step;let body='',next='Next';
  if(s===0){body=jobStep()}
  else if(s===1){body=`<h3>Roof system</h3><p class="muted">Pick every system on this job.</p>${chips(kids(8).map(x=>[x[0],x[1]]),W.st,'s')}`}
  else if(s===2){body=`<h3>Deck type</h3>${chips(kids(1).map(x=>[x[0],x[1]]),W.st,'s')}`}
  else if(s===3){body=`<h3>Other scope</h3><p class="muted">Tap what applies. Each choice adds its tools and supplies.</p>`+SCOPE_PARENTS.map(p=>{const k=kids(p);if(!k.length)return'';return `<div class="qlabel">${esc(stName(p))}</div>${chips(k.map(x=>[x[0],x[1]]),W.st,'s')}`}).join('');next='Build the list'}
  else if(s===4){if(!W.lines)W.lines=generate(W.st);body=listHtml();next='Review check-out'}
  else if(s===5){body=goHtml();next=''}
  box.innerHTML=`<div class="mplhead"><button class="btn" id="mBack">← ${s===0?'All MPLs':'Back'}</button><h2>${W.job?esc(jobLabel(W.job)):'New MPL'}</h2></div>${crumbs()}<div class="panel mplbody">${body}</div>
   <div class="mplbar">${s>=4?`<button class="btn" id="mSend">${W.mp?'Sent to Mob Prep ✓ (send again)':'Send to Mob Prep'}</button>`:''}${s>=4?'<button class="btn" id="mSave">Save draft</button>':''}${next?`<button class="go" id="mNext" style="width:auto">${next}</button>`:''}</div>`;
  wire()}
let mpJ=null,mpU=null,mpErr='',jq='';
function jobStep(){if(!MP.tok())return `<h3>Which job?</h3><div class="panel" style="margin:0"><p>Job numbers come from <b>Spectrum through Mob Prep</b>. Connect once on this device.</p><button class="go" id="mpConn" style="width:auto">Connect Mob Prep</button></div>`;
  if(!mpJ&&!mpErr){mpJobs().then(j=>{mpJ=j;return mpUsers()}).then(u=>{mpU=u;render()}).catch(e=>{mpErr=e.message;render()});return '<h3>Which job?</h3><p class="muted">Loading jobs from Spectrum / Mob Prep…</p>'}
  if(mpErr)return `<h3>Which job?</h3><p class="bad">${esc(mpErr)}</p><button class="btn" id="mpRetry">Try again</button> <button class="btn" id="mpConn">Reconnect</button>`;
  const q=jq.toLowerCase();const l=mpJ.filter(j=>j.active!==false&&(!q||j.no.includes(q)||j.name.toLowerCase().includes(q))).slice(0,60);
  const pms=(mpU||[]).filter(u=>['pm','admin','president','office'].includes(String(u.role||'').toLowerCase())||true);
  return `<h3>Which job? <small class="muted">from Spectrum · Mob Prep</small></h3><input id="mJq" class="search" placeholder="Search job # or name…" value="${esc(jq)}">
   <div class="names jobs mpjobs">${l.map(j=>`<button data-mj="${esc(j.no)}" aria-pressed="${W.job==='#'+j.no}"><span class="mono">#${esc(j.no)}</span><small>${esc(j.name)}</small><small>${j.mp?'In Mob Prep':''}${j.city?(j.mp?' · ':'')+esc(j.city):''}</small></button>`).join('')||'<div class="muted">No match.</div>'}</div>
   <div class="fields"><label class="f">Prepared by<input value="${esc(W.prep||curUser)}" disabled></label>
   <label class="f">Crew size<div class="step"><button data-cr="-1">−</button><b>${W.crew}</b><button data-cr="1">+</button></div></label>
   <label class="f">PM<select id="mPm"><option value="">—</option>${pms.map(u=>`<option value="${esc(u.id)}" ${u.id===W.mpPm?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>
   <label class="f">FM / SFM<select id="mFm"><option value="">—</option>${(mpU||[]).map(u=>`<option value="${esc(u.id)}" ${u.id===W.mpFm?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label></div>
   <p class="muted" style="font-size:12.5px">Connected as ${esc((()=>{try{return localStorage.getItem('mpEmail')}catch(e){return ''}})()||'')} · <a href="#" id="mpOut">disconnect</a></p>`}
function listHtml(){const g={};W.lines.forEach((l,k)=>{(g[l.cat||'Custom']=g[l.cat||'Custom']||[]).push([l,k])});
  const cats=Object.keys(g).sort((a,b)=>(ORDER.indexOf(a)+99)%99-(ORDER.indexOf(b)+99)%99);
  return `<div class="mplhead2"><h3>Item list · ${W.lines.length}</h3><button class="btn" id="mAdd">+ Add item</button></div>
   <p class="muted">Remove what this job doesn't need and set quantities. “In yard” items will be taken out of the yard inventory when you check out.</p>
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
  document.getElementById('mBack').onclick=()=>{if(W.step===0){view='list';render()}else{W.step--;render()}};
  q('[data-st]',b=>b.onclick=()=>{const n=+b.dataset.st;if(n<=W.step||W.lines){if(n===5&&!W.lines)return;W.step=n;render()}});
  q('[data-mj]',b=>b.onclick=()=>{const j=mpJ.find(x=>x.no===b.dataset.mj);W.job='#'+j.no;W.jobName=j.name;W.mpPid=j.pid||null;render()});
  const jqi=document.getElementById('mJq');if(jqi)jqi.oninput=()=>{jq=jqi.value;const p=jqi.selectionStart;render();const n=document.getElementById('mJq');n.focus();n.setSelectionRange(p,p)};
  const cn=document.getElementById('mpConn');if(cn)cn.onclick=()=>connectDlg(()=>{mpJ=null;mpErr='';render()});
  const rt=document.getElementById('mpRetry');if(rt)rt.onclick=()=>{mpErr='';mpJ=null;MP.cache={};render()};
  const mo=document.getElementById('mpOut');if(mo)mo.onclick=e=>{e.preventDefault();MP.logout();mpJ=null;render()};
  const mj=document.getElementById('mJob');if(mj)mj.onchange=()=>{W.job=normJob(mj.value)};
  q('[data-cr]',b=>b.onclick=()=>{W.crew=Math.max(1,W.crew+ +b.dataset.cr);render()});
  const pm=document.getElementById('mPm');if(pm)pm.onchange=()=>{W.mpPm=pm.value;W.pm=pm.selectedOptions[0]?.text||''};const fm=document.getElementById('mFm');if(fm)fm.onchange=()=>{W.mpFm=fm.value;W.fm=fm.selectedOptions[0]?.text||''};
  q('[data-s]',b=>b.onclick=()=>{const id=+b.dataset.s;W.st=W.st.includes(id)?W.st.filter(x=>x!==id):[...W.st,id];if(W.lines&&W.step<4)W.lines=null;render()});
  q('[data-q]',b=>b.onclick=()=>{const l=W.lines[+b.dataset.q];l.n=Math.max(1,l.n+ +b.dataset.d);render()});
  q('[data-rm]',b=>b.onclick=()=>{W.lines.splice(+b.dataset.rm,1);render()});
  q('[data-yl]',b=>b.onclick=()=>linkYard(+b.dataset.yl));
  const ad=document.getElementById('mAdd');if(ad)ad.onclick=addItem;
  const sd=document.getElementById('mSend');if(sd)sd.onclick=sendToMobPrep;
  const sv=document.getElementById('mSave');if(sv)sv.onclick=()=>save('draft').then(()=>toast('Draft saved'));
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
function addItem(){pickDlg('Add an item',[...REF.its.filter(r=>!W.lines.some(l=>l.rid===r[0])).map(r=>({t:r[1],s:r[2]+' · '+r[3],r})),...items.map(i=>({t:i.name,s:'Yard · '+[i.size,i.loc].filter(Boolean).join(' · '),i}))],x=>{
  if(x.r)W.lines.push({rid:x.r[0],name:x.r[1],cat:x.r[2],sub:x.r[3],unit:x.r[4],n:1,from:'Added'});else W.lines.push({yid:x.i.id,name:x.i.name,cat:'Custom',sub:'From yard',unit:x.i.unit,n:1,from:'Added'});render()})}
async function addJobIfMissing(job,now){if(job&&!jobs.some(j=>j.no===job)){try{await db.doc('jobs/J'+job.replace(/[^A-Za-z0-9]/g,'')).set({no:job,name:W.jobName||'',pm:W.pm||'',fm:W.fm||'',address:'',status:'Active',notes:'Added from MPL by '+curUser,autoAdded:true,updatedAt:now})}catch(e){}}}
async function checkout(){const g=goLines().filter(x=>x.y&&x.take>0);if(!g.length)return;if(!confirm(`Take ${g.length} items out of the yard to ${jobLabel(W.job)}?`))return;
  const b=document.getElementById('mGo');b.disabled=true;b.textContent='Checking out…';const now=new Date().toISOString();await addJobIfMissing(W.job,now);let ok=0;
  for(const x of g){const it=byId(x.y.id);if(!it)continue;const before=Number(it.qty)||0,n=Math.min(x.take,before);if(n<=0)continue;
    try{await writeItem(it.id,{qty:before-n,out:(it.out||0)+n,lastJob:W.job,updatedAt:now,updatedBy:curUser});
      await db.collection('logs').add({ts:now,action:'OUT',itemId:it.id,name:it.name,size:it.size||'',unit:it.unit||'',loc:it.loc,n,before,after:before-n,job:W.job,by:curUser,note:'MPL check-out',cond:''});
      x.l.yid=it.id;x.l.taken=n;ok++}catch(e){toast('Could not take '+it.name+': '+(e.message||e.code))}}
  await save('out',{outAt:now,outBy:curUser});toast(ok+' items checked out to '+jobLabel(W.job));view='view';render()}
function renderView(){const box=el();const m=MPLS.find(x=>x._id===openId);if(!m){view='list';return render()}
  const taken=(m.lines||[]).filter(l=>l.taken>0);
  box.innerHTML=`<div class="mplhead"><button class="btn" id="mBack">← All MPLs</button><h2>${esc(jobLabel(m.job))}</h2>${stat(m)}</div>
   <div class="panel"><p class="muted">Prepared by ${esc(m.prep||'')} · PM ${esc(m.pm||'—')} · FM ${esc(m.fm||'—')} · crew ${m.crew||'-'}<br>${esc((m.st||[]).map(stName).join(', '))}</p>
   ${m.status==='out'?`<h3>Close out — what came back?</h3><p class="muted">Set how many of each came back to the yard. Anything not returned is logged as lost / used on the job.</p>`:'<h3>Items</h3>'}
   <div class="mpllines">${(m.lines||[]).map((l,k)=>`<div class="mline"><div class="mname"><b>${esc(l.name)}</b><small>${l.taken?`Taken from yard: ${l.taken}`:'Not from yard'}${l.back!=null?` · Returned ${l.back}`:''}</small></div>
     ${m.status==='out'&&l.taken?`<div class="step"><button data-b="${k}" data-d="-1">−</button><b id="bk${k}">${l.taken}</b><button data-b="${k}" data-d="1">+</button></div>`:`<span class="muted">×${l.n}</span>`}</div>`).join('')}</div></div>
   <div class="mplbar">${m.status==='out'?`<button class="go" id="mClose" style="width:auto">Close out · return to yard</button>`:''}${m.status!=='out'&&isAdmin?'<button class="btn dng" id="mDel">Delete MPL</button>':''}</div>`;
  document.getElementById('mBack').onclick=()=>{view='list';render()};
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

/* ---------- mode chooser + wiring ---------- */
function chooser(){if(!can('MPL'))return;const r=document.getElementById('dlgRoot');
  r.innerHTML=`<div class="scrim"><div class="dlg modepick"><h3>Hi ${esc(curUser)} — what are you doing?</h3>
   <button class="modebtn" data-mode="yard"><b>Yard Inventory</b><span>Take out, return, receive, repair, audit</span></button>
   <button class="modebtn" data-mode="mpl"><b>Mobilization Prep List</b><span>Prepare a job: system → deck → scope → list → check out</span></button></div></div>`;
  r.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{closeDlg();showTab(b.dataset.mode==='mpl'?'mpl':'yard')})}
const _su=window.setUser;window.setUser=function(n){const ch=n!==curUser;_su(n);if(ch&&n)setTimeout(chooser,50)};
const _st=window.showTab;window.showTab=function(t){if(t==='mpl'){_st('yard');document.getElementById('tab-yard').hidden=true;el().hidden=false;$$('nav.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab==='mpl'));view=view==='wiz'&&W?view:'list';render();return}
  el().hidden=true;_st(t)};
const _ar=window.applyRole;window.applyRole=function(){_ar();const b=document.querySelector('nav.tabs [data-tab="mpl"]');if(b)b.hidden=!can('MPL');document.body.classList.toggle('mplok',can('MPL'))};
(function wait(){if(typeof db!=='undefined'&&db&&typeof db.collection==='function'){load()}else setTimeout(wait,300)})();
})();
