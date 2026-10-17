/* AME app shell — one app, many modules (Yard Inventory, MPL, …) */
(function(){
const SVG={
 yard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-6h4v6M13 21v-4h4v4"/><path d="M7 11h10"/></svg>',
 mpl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v3h6V3"/><path d="M8.5 11l1.5 1.5 3-3M8.5 16.5l1.5 1.5 3-3"/></svg>',
 more:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'};
const AME=window.AME={modules:[],cur:'',
  register(m){if(!this.modules.find(x=>x.id===m.id))this.modules.push(m);if(this.cur==='home')renderHome()},
  mod(id){return this.modules.find(m=>m.id===id)},
  base(m){return m.allow?m.allow():(!m.perm||can(m.perm))},
  betaOk(m){if(!m.beta)return true;if(typeof isOwner==='function'&&isOwner(curUser))return true;try{return ((perms.beta||{})[m.id]||[]).includes(curUser)}catch(e){return false}},
  allowed(m){return this.base(m)&&this.betaOk(m)},
  home(){setMod('home');showTab('home')},
  seenKey(id){return 'ameSeen:'+(typeof curUser!=='undefined'?curUser:'')+':'+id},
  seen(id){try{let v=localStorage.getItem(this.seenKey(id));if(!v){v=new Date().toISOString();localStorage.setItem(this.seenKey(id),v)}return v}catch(e){return new Date().toISOString()}},
  markSeen(id){if(!id||id==='home'||(typeof viewAs!=='undefined'&&viewAs))return;try{localStorage.setItem(this.seenKey(id),new Date().toISOString())}catch(e){}},
  count(m){try{return m.badge?Math.max(0,m.badge(this.seen(m.id))|0):0}catch(e){return 0}},
  badges(){clearTimeout(this._bt);this._bt=setTimeout(()=>{if(this.cur==='home')renderHome()},300)},
  open(id){const m=this.mod(id);if(!m||!this.allowed(m))return;setMod(id);m.open()}};
AME.register({id:'yard',name:'Yard Inventory',perm:'YARD',desc:'Take out · return · repair · audit',icon:SVG.yard,tabs:['yard','inv','jobs','log','sheet'],open:()=>{showTab('yard');yardStart()}});
function yardStart(){const opts=[['OUT','Take Out','Take tools &amp; materials to a job','#e8594a'],['RETURN','Return','Bring things back to the yard','#3fb950'],['AUDIT','Inventory check &amp; update','Count, fix quantities, add photos','#a98bff']].filter(o=>{try{return o[0]==='AUDIT'||can(o[0])}catch(e){return true}});
  if(opts.length<2)return;try{if(isAdmin||isEditor(curUser))return}catch(e){}const r=document.getElementById('dlgRoot');
  r.innerHTML=`<div class="ysfull"><div class="ystart"><div class="ysbrand">${typeof curUser!=='undefined'?'Hi '+esc(curUser):''}</div><h3>What are you doing?</h3><div class="ysopts">${opts.map(o=>`<button type="button" data-ys="${o[0]}" style="--c:${o[3]}"><b>${o[1]}</b><small>${o[2]}</small></button>`).join('')}</div><button class="btn" id="ysX" style="margin-top:10px;width:100%">Just look around</button></div></div>`;
  r.querySelectorAll('[data-ys]').forEach(b=>b.onclick=()=>{closeDlg();if(b.dataset.ys==='AUDIT'&&!can('AUDIT')){showTab('inv');scrollTo({top:0});return}const a=document.querySelector('#actions .act[data-act="'+b.dataset.ys+'"]');if(a)a.click();scrollTo({top:0})});document.getElementById('ysX').onclick=closeDlg;
  if(!document.getElementById('ysCss'))document.head.insertAdjacentHTML('beforeend','<style id="ysCss">.ysfull{position:fixed;inset:0;z-index:9000;background:var(--bg,#2b2724);display:flex;align-items:center;justify-content:center;padding:calc(20px + env(safe-area-inset-top,0px)) 20px calc(20px + env(safe-area-inset-bottom,0px));overflow:auto}.ystart{width:100%;max-width:520px}.ystart h3{font-size:30px;margin:4px 0 6px}.ysbrand{opacity:.7}.ysopts button{padding:24px 22px!important;min-height:96px}.ysopts{display:flex;flex-direction:column;gap:10px;margin-top:10px}.ysopts button{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:16px 18px;border-radius:14px;border:2px solid var(--c);background:var(--panel);color:inherit;font:inherit;text-align:left;cursor:pointer}.ysopts button b{font-family:var(--display);font-size:22px;color:var(--c);text-transform:uppercase;letter-spacing:.02em}.ysopts button small{opacity:.75}.ysopts button:active{transform:scale(.98)}</style>')}
document.querySelector('main').insertAdjacentHTML('afterbegin','<section id="tab-home" hidden></section>');
function setMod(id){if(AME.cur&&AME.cur!==id)AME.markSeen(AME.cur);AME.markSeen(id);AME.cur=id;const m=AME.mod(id);const sub=document.querySelector('#brand small');if(sub)sub.textContent=m?m.name:'Apps';
  document.querySelectorAll('nav.tabs button[data-tab]').forEach(b=>b.classList.toggle('offmod',!m||!(m.tabs||[]).includes(b.dataset.tab)));
  document.body.dataset.mod=id;try{sessionStorage.setItem('ameMod',id)}catch(e){}}
function renderHome(){const el=document.getElementById('tab-home');if(!el)return;const mods=AME.modules.filter(m=>AME.allowed(m));let soon=AME.modules.filter(m=>m.beta&&!AME.betaOk(m));if(!(typeof isAdmin!=='undefined'&&isAdmin))soon=[];if(mods.length===1&&!soon.length&&!(typeof isAdmin!=='undefined'&&isAdmin)&&!(typeof viewAs!=='undefined'&&viewAs)){setTimeout(()=>AME.open(mods[0].id),0);return}
  el.innerHTML=`<div class="homehead"><h2>Hi ${esc(curUser||'')}</h2><p class="muted">What are you working on?</p></div>
  <div class="apps">${mods.length?'':'<p class="muted">No apps are turned on for you yet. Ask Kyle to give you access.</p>'}${mods.map(m=>`<button class="apptile" data-app="${m.id}"><span class="appic">${m.icon||''}</span><b>${esc(m.name)}</b><small>${esc(m.desc||'')}</small>${m.beta?'<em class="betatag">Early access</em>':''}${(n=>n?`<span class="appbadge">${n>99?'99+':n}</span>`:'')(AME.count(m))}</button>`).join('')}${soon.map(m=>`<div class="apptile soon" aria-disabled="true"><span class="appic">${m.icon||''}</span><b>${esc(m.name)}</b><small>${esc(m.desc||'')}</small><em class="betatag">Upcoming — in preparation</em></div>`).join('')}
</div>`;
  if(!document.getElementById('betaCss'))document.head.insertAdjacentHTML('beforeend','<style id="betaCss">.apptile{position:relative}.appbadge{position:absolute;top:10px;right:10px;min-width:24px;height:24px;padding:0 7px;border-radius:12px;background:#e2513a;color:#fff;font-size:13px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--bg,#3b3633)}.apptile.soon{opacity:.5;cursor:not-allowed;filter:grayscale(.6)}.betatag{display:inline-block;align-self:flex-start;margin-top:8px;font-style:normal;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:10px;border:1px solid currentColor;opacity:.85}</style>');
  el.querySelectorAll('[data-app]').forEach(b=>b.onclick=()=>AME.open(b.dataset.app))}
const _st=window.showTab;window.showTab=function(t){
  const secs=AME.modules.filter(m=>m.section).map(m=>m.section);const hideSecs=()=>secs.forEach(x=>{const e=document.getElementById(x);if(e)e.hidden=true});
  if(t==='home'){_st('yard');document.getElementById('tab-yard').hidden=true;hideSecs();
    document.getElementById('tab-home').hidden=false;document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-selected','false'));setMod('home');renderHome();scrollTo({top:0});return}
  document.getElementById('tab-home').hidden=true;hideSecs();const owner=AME.modules.find(m=>(m.tabs||[]).includes(t));
  if(owner&&owner.section){_st('yard');document.getElementById('tab-yard').hidden=true;document.getElementById(owner.section).hidden=false;document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));setMod(owner.id);if(owner.onShow)owner.onShow();scrollTo({top:0});return}
  if(owner&&owner.id!==AME.cur)setMod(owner.id);_st(t)};
const _su=window.setUser;window.setUser=function(n){const ch=n!==curUser;_su(n);if(ch&&n)setTimeout(()=>AME.home(),30)};
let started=false;const _ar=window.applyRole;window.applyRole=function(){_ar();if(curUser&&!started){started=true;setTimeout(()=>{const al=AME.modules.filter(m=>AME.allowed(m));if(al.length===1&&!(typeof isAdmin!=='undefined'&&isAdmin)){AME.open(al[0].id);return}if(start==='home'||!AME.mod(start)||!(typeof isEditor==='function'&&isEditor(curUser)))AME.home();else AME.open(start)},0);return}if(AME.cur)setMod(AME.cur);if(AME.cur==='home')renderHome()};
document.getElementById('brand').onclick=()=>{try{closeDlg()}catch(e){}if(curUser)AME.home();else showTab('yard')};
let start='home';try{start=sessionStorage.getItem('ameMod')||'home'}catch(e){}
})();
