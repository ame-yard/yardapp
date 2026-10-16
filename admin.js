/* AME Admin — crew, PINs, permissions, who's using, admin access. Owner (Kyle) + people the owner grants. */
(function(){
const isAdm=()=>!!curUser&&(isOwner(curUser)||((perms&&perms.admins)||[]).includes(curUser));
const sec=document.getElementById('tab-admin');
// move the existing admin panels out of the Jobs tab
const jobs=document.getElementById('tab-jobs');
const crewP=document.getElementById('crewList')?.closest('.panel');
const whoP=document.getElementById('onlineN')?.closest('.panel');
const permP=document.querySelector('#tab-jobs .permpanel');
sec.innerHTML=`<div class="mplhead"><h2>Admin</h2><span class="muted">Only you${isOwner(curUser)?'':' and the admins you pick'} can see this.</span></div>
 <div class="panel" id="admDev" style="margin-bottom:18px"><h3 style="margin-top:0">Devices &amp; sign-ins</h3><p class="muted" style="margin-top:0">Each name works only on the devices it was first used on. Someone picking another person's name on a different device is blocked and shows up here in red. Kyle K. can use any name.</p><div id="admBind"></div><div style="display:flex;align-items:center;gap:10px;margin:16px 0 6px"><h4 style="margin:0;flex:1">Recent sign-ins</h4><button class="btn small dng" id="admClr">Clear all</button></div><div class="tblwrap"><table><thead><tr><th>When</th><th>Name</th><th>Microsoft account</th><th>Device</th><th>IP</th><th></th></tr></thead><tbody id="admLog"></tbody></table></div></div>
 <div class="panel" id="admAccess" style="margin-bottom:18px"><h3 style="margin-top:0">Admin access</h3><p class="muted" style="margin-top:0">Pick who else can open this Admin section. They become editors too. Kyle K. always has access.</p><div class="units" id="admList"></div></div>`;
[permP,whoP,crewP].forEach(p=>{if(!p)return;p.classList.remove('owner-only');sec.appendChild(p)});
let LOG=[];
function renderDev(){const B=document.getElementById('admBind'),L=document.getElementById('admLog');if(!B)return;
  const names=Object.keys(DEVB).filter(k=>!k.startsWith('__')&&(DEVB[k]||[]).length).sort();
  B.innerHTML=names.length?names.map(n=>`<div class="cntsum"><span><b>${esc(n)}</b> · ${(DEVB[n]||[]).map((d,i)=>`<span class="pill">${esc(d.dev)} · ${esc(d.acct||d.key.split('|')[0])} <button class="ibx" data-unb="${esc(n)}|${i}" title="Remove this device" style="background:none;border:0;color:inherit;cursor:pointer">×</button></span>`).join(' ')}</span></div>`).join(''):'<p class="muted">No devices registered yet — they are added as people sign in.</p>';
  const rows=[...LOG].sort((a,b)=>String(b.ts).localeCompare(String(a.ts))).slice(0,80);
  L.innerHTML=rows.map(r=>`<tr${r.blocked?' style="color:#ff8a7a"':''}><td>${esc(fmtD(r.ts))}</td><td><b>${esc(r.name)}</b>${r.blocked?' · BLOCKED':''}</td><td>${esc(r.acct||'')}<br><small class="muted">${esc(r.email||'')}</small></td><td>${esc(r.dev||'')}</td><td>${esc(r.ip||'')}</td><td style="white-space:nowrap">${r.blocked&&isOwner(curUser)?`<button class="btn small" data-allow="${esc(r._id)}">Allow this device</button> `:''}<button class="btn small" data-ldel="${esc(r._id)}" title="Delete this record">×</button></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No sign-ins yet.</td></tr>';
  B.querySelectorAll('[data-unb]').forEach(x=>x.onclick=async()=>{const [n,i]=x.dataset.unb.split('|');if(!confirm('Remove this device for '+n+'? The next device '+n+' signs in on will be registered.'))return;const b=[...(DEVB[n]||[])];b.splice(+i,1);await db.doc('config/devbind').update({[n]:b});toast('Device removed')});
  L.querySelectorAll('[data-ldel]').forEach(x=>x.onclick=()=>db.doc('logins/'+x.dataset.ldel).delete().catch(e=>toast(e.message)));
  const ca=document.getElementById('admClr');if(ca)ca.onclick=async()=>{if(!LOG.length||!confirm('Delete all '+LOG.length+' sign-in records? Registered devices stay.'))return;await db.deleteMany('logins',LOG.map(r=>r._id));toast('Sign-in log cleared')};
  L.querySelectorAll('[data-allow]').forEach(x=>x.onclick=async()=>{const r=LOG.find(y=>y._id===x.dataset.allow);if(!r)return;const b=[...(DEVB[r.name]||[])];if(!b.some(d=>d.key===r.key))b.push({key:r.key,acct:r.acct,dev:r.dev,first:new Date().toISOString(),last:new Date().toISOString()});await db.doc('config/devbind').update({[r.name]:b});toast(r.name+' can now sign in on that device')})}
(function w(){if(typeof db!=='undefined'&&db&&db.collection){db.collection('logins').onSnapshot(x=>{LOG=x.docs.map(d=>({...d.data(),_id:d.id}));if(AME.cur==='admin')renderDev()},()=>{});db.doc('config/devbind').onSnapshot(()=>{if(AME.cur==='admin')setTimeout(renderDev,50)},()=>{})}else setTimeout(w,400)})();
function renderAccess(){renderDev();const el=document.getElementById('admList');const box=document.getElementById('admAccess');if(!el)return;box.hidden=!isOwner(curUser);
  const a=(perms.admins||[]);el.innerHTML=crew.filter(c=>!isOwner(c.name)).map(c=>`<button type="button" data-adm="${esc(c.name)}" aria-pressed="${a.includes(c.name)}"><b>${esc(c.name)}</b><small>${esc(c.role||'')}</small></button>`).join('')||'<span class="muted">Add people to the crew list first.</span>';
  el.querySelectorAll('[data-adm]').forEach(b=>b.onclick=async()=>{const n=b.dataset.adm;const cur=new Set(perms.admins||[]);cur.has(n)?cur.delete(n):cur.add(n);
    if(!confirm((cur.has(n)?'Give ':'Remove ')+n+(cur.has(n)?' admin access?':' from admins?')))return;await savePerms({...perms,admins:[...cur]});})}
AME.register({id:'admin',name:'Admin',desc:'Crew list · PINs · permissions · who’s using',tabs:['admin'],section:'tab-admin',allow:isAdm,
  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  open:()=>showTab('admin'),onShow:()=>{if(!isAdm()){AME.home();return}renderAccess();try{renderCrew();renderPerms();renderOnline()}catch(e){}}});
const _ar=window.applyRole;window.applyRole=function(){_ar();const ok=isAdm();document.body.classList.toggle('ameadm',ok);const b=document.querySelector('nav.tabs [data-tab="admin"]');if(b)b.hidden=!ok;if(AME.cur==='admin'&&!ok)AME.home();if(AME.cur==='admin')renderAccess()};
})();
