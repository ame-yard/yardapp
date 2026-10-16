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
 <div class="panel" id="admAccess" style="margin-bottom:18px"><h3 style="margin-top:0">Admin access</h3><p class="muted" style="margin-top:0">Pick who else can open this Admin section. They become editors too. Kyle K. always has access.</p><div class="units" id="admList"></div></div>`;
[permP,whoP,crewP].forEach(p=>{if(!p)return;p.classList.remove('owner-only');sec.appendChild(p)});
function renderAccess(){const el=document.getElementById('admList');const box=document.getElementById('admAccess');if(!el)return;box.hidden=!isOwner(curUser);
  const a=(perms.admins||[]);el.innerHTML=crew.filter(c=>!isOwner(c.name)).map(c=>`<button type="button" data-adm="${esc(c.name)}" aria-pressed="${a.includes(c.name)}"><b>${esc(c.name)}</b><small>${esc(c.role||'')}</small></button>`).join('')||'<span class="muted">Add people to the crew list first.</span>';
  el.querySelectorAll('[data-adm]').forEach(b=>b.onclick=async()=>{const n=b.dataset.adm;const cur=new Set(perms.admins||[]);cur.has(n)?cur.delete(n):cur.add(n);
    if(!confirm((cur.has(n)?'Give ':'Remove ')+n+(cur.has(n)?' admin access?':' from admins?')))return;await savePerms({...perms,admins:[...cur]});})}
AME.register({id:'admin',name:'Admin',desc:'Crew list · PINs · permissions · who’s using',tabs:['admin'],section:'tab-admin',allow:isAdm,
  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  open:()=>showTab('admin'),onShow:()=>{if(!isAdm()){AME.home();return}renderAccess();try{renderCrew();renderPerms();renderOnline()}catch(e){}}});
const _ar=window.applyRole;window.applyRole=function(){_ar();const ok=isAdm();document.body.classList.toggle('ameadm',ok);const b=document.querySelector('nav.tabs [data-tab="admin"]');if(b)b.hidden=!ok;if(AME.cur==='admin'&&!ok)AME.home();if(AME.cur==='admin')renderAccess()};
})();
