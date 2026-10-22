/* AME Notices — company announcements. Admins, PMs and HR post; everyone they pick reads and taps "Got it".
   Urgent notices pop up when the app opens until acknowledged. Read receipts show who has seen each one. */
(function(){
const mk=id=>{let s=document.getElementById('tab-'+id);if(!s){s=document.createElement('section');s.id='tab-'+id;s.hidden=true;(document.querySelector('main')||document.body).appendChild(s)}return s};
const sec=mk('ntc');const E=s=>esc(s==null?'':String(s));
let N=[],RD={},tab='feed',popped=new Set();
const today=()=>new Date().toISOString().slice(0,10);
const can=()=>{try{if(!curUser)return false;if(isOwner(curUser)||((perms&&perms.admins)||[]).includes(curUser))return true;const r=typeof curRole==='function'?curRole():'';return ['President','PM','HR','Office'].includes(r)}catch(e){return false}};
const role=n=>{try{return (crew.find(c=>c.name===n)||{}).role||''}catch(e){return ''}};
const grp=n=>{try{return groupOf(role(n))}catch(e){return ''}};
const lang=()=>{try{return localStorage.getItem('ameLang')==='es'?'es':'en'}catch(e){return 'en'}};
const PRI=[['normal','Normal','#2f81f7'],['important','Important','#d9822b'],['urgent','Urgent','#b3261e']];
const AUD=[['all','Everyone'],['Field','Field (FM / SFM / crew)'],['HQ','Office (HQ)'],['roles','Pick roles'],['people','Pick people']];
const forMe=x=>{if(x.by===curUser)return true;const a=x.aud||'all';if(a==='all')return true;if(a==='Field'||a==='HQ')return grp(curUser)===a;if(a==='roles')return (x.roles||[]).includes(role(curUser));if(a==='people')return (x.ppl||[]).includes(curUser);return true};
const live=x=>!x.until||x.until>=today();
const readBy=(x)=>Object.keys((RD[x._id]||{}));
const isRead=x=>!!(RD[x._id]||{})[curUser]||x.by===curUser;
const mine=()=>N.filter(x=>live(x)&&forMe(x)).sort((a,b)=>(b.pin?1:0)-(a.pin?1:0)||String(b.at).localeCompare(String(a.at)));
const unread=()=>mine().filter(x=>!isRead(x));
(function w(){if(typeof db!=='undefined'&&db&&db.collection){
  db.collection('notices').onSnapshot(s=>{N=s.docs.map(d=>({...d.data(),_id:d.id}));try{AME.badges()}catch(e){}if(AME.cur==='ntc'&&!document.querySelector('#dlgRoot .scrim'))render();urgentPop()},()=>{});
  db.collection('noticeread').onSnapshot(s=>{RD={};s.docs.forEach(d=>RD[d.id]=d.data());try{AME.badges()}catch(e){}if(AME.cur==='ntc'&&!document.querySelector('#dlgRoot .scrim'))render()},()=>{});
}else setTimeout(w,400)})();
async function markRead(x){if(!curUser||isRead(x))return;RD[x._id]={...(RD[x._id]||{}),[curUser]:new Date().toISOString()};try{await db.doc('noticeread/'+x._id).update({[curUser]:new Date().toISOString()})}catch(e){try{await db.doc('noticeread/'+x._id).set({[curUser]:new Date().toISOString()})}catch(e2){}}try{AME.badges()}catch(e){}}
const txt=(x,f)=>lang()==='es'&&x[f+'Es']?x[f+'Es']:x[f];
function card(x){const p=PRI.find(y=>y[0]===(x.pri||'normal'))||PRI[0];const rd=isRead(x);const n=readBy(x).length;
  return `<article class="ntc${rd?'':' unread'} p-${x.pri||'normal'}" data-nid="${x._id}"><div class="ntch">${x.pin?'<span class="ntcpin" title="Pinned"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M5 17h14l-2-5V5H7v7z"/></svg></span>':''}<span class="ntcp" style="--p:${p[2]}">${p[1]}</span><b>${E(txt(x,'title'))}</b><span class="muted ntcm">${E(x.by||'')} · ${E(typeof fmtD==='function'?fmtD(x.at):x.at)}</span></div>
   <div class="ntcb">${E(txt(x,'body')).replace(/\n/g,'<br>')}</div>${x.file?`<button type="button" class="btn small" data-nf="${x._id}">Open attachment</button>`:''}
   <div class="ntcf">${rd?`<span class="muted" style="font-size:12px">✓ Read</span>`:`<button type="button" class="btn small pri" data-nr="${x._id}">Got it</button>`}${can()?`<button type="button" class="btn small" data-nrs="${x._id}">Read by ${n}</button><button type="button" class="btn small" data-ne="${x._id}">Edit</button>`:''}${x.until?`<small class="muted">until ${E(typeof fmtD==='function'?fmtD(x.until):x.until)}</small>`:''}</div></article>`}
function render(){const L=mine();const old=N.filter(x=>!live(x)&&(can()||forMe(x))).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  sec.innerHTML=`<div class="mplhead"><h2>Notices</h2>${can()?'<span class="mtop"><button class="btn pri" id="nNew">+ New notice</button></span>':''}</div>
   <div class="viewseg" style="margin-bottom:12px"><button data-nt="feed" aria-pressed="${tab==='feed'}">Current${unread().length?' · '+unread().length+' new':''}</button><button data-nt="old" aria-pressed="${tab==='old'}">Past</button></div>
   <div class="ntcl">${(tab==='feed'?L:old).map(card).join('')||`<div class="panel muted">${tab==='feed'?'No notices right now.':'Nothing here.'}</div>`}</div>`;
  sec.querySelectorAll('[data-nt]').forEach(b=>b.onclick=()=>{tab=b.dataset.nt;render()});const nb=sec.querySelector('#nNew');if(nb)nb.onclick=()=>edit();
  sec.querySelectorAll('[data-nr]').forEach(b=>b.onclick=async()=>{const x=N.find(y=>y._id===b.dataset.nr);await markRead(x);render()});
  sec.querySelectorAll('[data-ne]').forEach(b=>b.onclick=()=>edit(N.find(y=>y._id===b.dataset.ne)));
  sec.querySelectorAll('[data-nrs]').forEach(b=>b.onclick=()=>receipts(N.find(y=>y._id===b.dataset.nrs)));
  sec.querySelectorAll('[data-nf]').forEach(b=>b.onclick=async()=>{const x=N.find(y=>y._id===b.dataset.nf);try{const fs=await window.claude.use('files');window.open(URL.createObjectURL(await fs.read(x.file)),'_blank')}catch(e){toast('Could not open')}});
  /* opening a normal notice counts as read after a moment on screen */setTimeout(()=>{if(AME.cur!=='ntc')return;L.filter(x=>!isRead(x)&&(x.pri||'normal')==='normal').forEach(markRead)},4000)}
function audience(x){return crew.filter(c=>{const a=x.aud||'all';if(a==='all')return true;if(a==='Field'||a==='HQ')return groupOf(c.role)===a;if(a==='roles')return (x.roles||[]).includes(c.role);if(a==='people')return (x.ppl||[]).includes(c.name);return true}).map(c=>c.name).filter(n=>n!==x.by)}
function receipts(x){const A=audience(x);const R=RD[x._id]||{};const yes=A.filter(n=>R[n]),no=A.filter(n=>!R[n]);
  $('#dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg" style="max-width:480px"><h3>${E(x.title)}</h3><p class="muted" style="margin-top:0">${yes.length} of ${A.length} have read it.</p><h4>Read</h4><p>${yes.map(n=>`<span class="pill">${E(n)} <small class="muted">${E(typeof fmtD==='function'?fmtD(R[n]):'')}</small></span>`).join(' ')||'<span class="muted">Nobody yet</span>'}</p><h4>Not yet</h4><p>${no.map(n=>`<span class="pill">${E(n)}</span>`).join(' ')||'<span class="muted">Everyone has read it</span>'}</p><div class="bar"><button class="go" id="rX" style="width:auto">Close</button></div></div></div>`;$('#rX').onclick=closeDlg}
function edit(x){const nw=!x;x=x||{pri:'normal',aud:'all',roles:[],ppl:[]};const roles=[...new Set(crew.map(c=>c.role).filter(Boolean))];
  $('#dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg" style="max-width:640px"><h3>${nw?'New notice':'Edit notice'}</h3><div class="fields">
   <label class="f wide">Title<input id="nT" value="${E(x.title||'')}" placeholder="e.g. Yard closed Friday"></label><label class="f wide">Message<textarea id="nB" rows="5">${E(x.body||'')}</textarea></label>
   <details class="f wide" ${x.titleEs?'open':''}><summary>Español (optional)</summary><label class="f wide">Título<input id="nTe" value="${E(x.titleEs||'')}"></label><label class="f wide">Mensaje<textarea id="nBe" rows="4">${E(x.bodyEs||'')}</textarea></label></details>
   <label class="f">Priority<select id="nP">${PRI.map(([k,l])=>`<option value="${k}" ${x.pri===k?'selected':''}>${l}</option>`).join('')}</select></label><label class="f">Show until<input type="date" id="nU" value="${E(x.until||'')}"></label><label class="f chk" style="align-self:end"><input type="checkbox" id="nPin" ${x.pin?'checked':''}> Pin to top</label>
   <label class="f wide">Who sees it<select id="nA">${AUD.map(([k,l])=>`<option value="${k}" ${x.aud===k?'selected':''}>${l}</option>`).join('')}</select></label>
   <div class="f wide" id="nRw" ${x.aud==='roles'?'':'hidden'}><div class="ntpick">${roles.map(r=>`<label class="chk"><input type="checkbox" data-nro="${E(r)}" ${(x.roles||[]).includes(r)?'checked':''}> ${E(r)}</label>`).join('')}</div></div>
   <div class="f wide" id="nPw" ${x.aud==='people'?'':'hidden'}><div class="ntpick">${crew.map(c=>`<label class="chk"><input type="checkbox" data-npe="${E(c.name)}" ${(x.ppl||[]).includes(c.name)?'checked':''}> ${E(c.name)}</label>`).join('')}</div></div>
   <label class="f wide">Attachment (photo or PDF, optional)<input type="file" id="nF" accept="image/*,application/pdf"></label></div>
   <p class="muted" style="font-size:12px">Urgent = pops up when people open the app until they tap “Got it”. Everyone picked also gets it in the bell.</p>
   <div class="bar">${nw?'':'<button class="btn dng" id="nD">Delete</button>'}<span style="flex:1"></span><button class="btn" id="nX">Cancel</button><button class="go" id="nS" style="width:auto">${nw?'Post':'Save'}</button></div></div></div>`;
  $('#nA').onchange=e=>{$('#nRw').hidden=e.target.value!=='roles';$('#nPw').hidden=e.target.value!=='people'};$('#nX').onclick=closeDlg;
  {const d=$('#nD');if(d)d.onclick=async()=>{if(!confirm('Delete this notice?'))return;await db.doc('notices/'+x._id).delete();closeDlg();render()}}
  $('#nS').onclick=async()=>{const t=$('#nT').value.trim(),b=$('#nB').value.trim();if(!t){toast('Add a title');return}const o={title:t,body:b,titleEs:$('#nTe').value.trim(),bodyEs:$('#nBe').value.trim(),pri:$('#nP').value,until:$('#nU').value,pin:$('#nPin').checked,aud:$('#nA').value,roles:[...$$('[data-nro]:checked')].map(c=>c.dataset.nro),ppl:[...$$('[data-npe]:checked')].map(c=>c.dataset.npe),file:x.file||'',by:x.by||curUser,at:x.at||new Date().toISOString(),edited:nw?'':new Date().toISOString()};
    const f=$('#nF').files[0];if(f){try{const fs=await window.claude.use('files');o.file='notices/'+Date.now().toString(36)+'_'+f.name.replace(/[^\w.\-]+/g,'_');await fs.save(o.file,f)}catch(e){toast('Attachment failed: '+(e.message||e))}}
    const id=x._id||'n'+Date.now().toString(36);$('#nS').disabled=true;await db.doc('notices/'+id).set(o);
    if(nw)try{db.collection('logs').add({ts:new Date().toISOString(),by:curUser,action:'NOTICE',name:t,itemId:'',notice:id})}catch(e){}
    closeDlg();toast(nw?'Posted':'Saved');render()}}
/* urgent notices pop up on open */
function urgentPop(){if(!curUser||document.querySelector('#dlgRoot .scrim'))return;const u=mine().find(x=>x.pri==='urgent'&&!isRead(x)&&!popped.has(x._id));if(!u)return;popped.add(u._id);
  $('#dlgRoot').innerHTML=`<div class="scrim"><div class="dlg ntcpop"><div class="ntcp" style="--p:#b3261e">URGENT</div><h3>${E(txt(u,'title'))}</h3><div style="margin:8px 0 14px;line-height:1.5">${E(txt(u,'body')).replace(/\n/g,'<br>')}</div><small class="muted">${E(u.by||'')}</small><div class="bar"><button class="go" id="upOk" style="width:auto">Got it</button></div></div></div>`;$('#upOk').onclick=async()=>{closeDlg();await markRead(u);setTimeout(urgentPop,400)}}
setInterval(urgentPop,15000);
document.head.insertAdjacentHTML('beforeend',`<style>.ntcl{display:flex;flex-direction:column;gap:10px;max-width:820px}.ntc{background:var(--panel);border:1px solid var(--line);border-left:4px solid #2f81f7;border-radius:10px;padding:12px 14px}.ntc.p-important{border-left-color:#d9822b}.ntc.p-urgent{border-left-color:#b3261e}.ntc.unread{box-shadow:0 0 0 1px var(--hi)}.ntch{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ntch b{font-size:16px}.ntcm{font-size:12px;margin-left:auto}.ntcp{display:inline-block;background:var(--p);color:#fff;font:800 10.5px system-ui;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:999px}.ntcpin{color:var(--hi)}.ntcb{margin:8px 0;line-height:1.5;white-space:normal}.ntcf{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ntpick{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:4px 10px;max-height:180px;overflow:auto}.ntcpop{max-width:460px;border-top:5px solid #b3261e}</style>`);
const IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
(function reg(){if(typeof AME==='undefined'||!AME.register){setTimeout(reg,300);return}AME.register({id:'ntc',beta:true,name:'Notices',desc:'Company announcements · read receipts · urgent pop-ups',tabs:['ntc'],section:'tab-ntc',icon:IC,badge:()=>unread().length,open:()=>{showTab('ntc');render()},onShow:render})})();
window.ameNotices={render};
})();
