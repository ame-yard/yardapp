/* AME app shell — one app, many modules (Yard Inventory, MPL, …) */
(function(){
const SVG={
 yard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-6h4v6M13 21v-4h4v4"/><path d="M7 11h10"/></svg>',
 mpl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v3h6V3"/><path d="M8.5 11l1.5 1.5 3-3M8.5 16.5l1.5 1.5 3-3"/></svg>',
 more:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'};
const AME=window.AME={modules:[],cur:'',
  register(m){if(!this.modules.find(x=>x.id===m.id))this.modules.push(m);if(this.cur==='home')renderHome()},
  mod(id){return this.modules.find(m=>m.id===id)},
  allowed(m){return m.allow?m.allow():(!m.perm||can(m.perm))},
  home(){const ok=this.modules.filter(m=>this.allowed(m));if(ok.length===1){this.open(ok[0].id);return}setMod('home');showTab('home')},
  open(id){const m=this.mod(id);if(!m||!this.allowed(m))return;setMod(id);m.open()}};
AME.register({id:'yard',name:'Yard Inventory',desc:'Take out · return · receive · repair · audit',icon:SVG.yard,tabs:['yard','inv','jobs','log','sheet'],open:()=>showTab('yard')});
document.querySelector('main').insertAdjacentHTML('afterbegin','<section id="tab-home" hidden></section>');
function setMod(id){AME.cur=id;const m=AME.mod(id);const sub=document.querySelector('#brand small');if(sub)sub.textContent=m?m.name:'Apps';
  document.querySelectorAll('nav.tabs button[data-tab]').forEach(b=>b.classList.toggle('offmod',!m||!(m.tabs||[]).includes(b.dataset.tab)));
  document.body.dataset.mod=id;try{sessionStorage.setItem('ameMod',id)}catch(e){}}
function renderHome(){const el=document.getElementById('tab-home');if(!el)return;const mods=AME.modules.filter(m=>AME.allowed(m));
  el.innerHTML=`<div class="homehead"><h2>Hi ${esc(curUser||'')}</h2><p class="muted">What are you working on?</p></div>
  <div class="apps">${mods.map(m=>`<button class="apptile" data-app="${m.id}"><span class="appic">${m.icon||''}</span><b>${esc(m.name)}</b><small>${esc(m.desc||'')}</small></button>`).join('')}
</div>`;
  el.querySelectorAll('[data-app]').forEach(b=>b.onclick=()=>AME.open(b.dataset.app))}
const _st=window.showTab;window.showTab=function(t){
  const secs=AME.modules.filter(m=>m.section).map(m=>m.section);const hideSecs=()=>secs.forEach(x=>{const e=document.getElementById(x);if(e)e.hidden=true});
  if(t==='home'){_st('yard');document.getElementById('tab-yard').hidden=true;hideSecs();
    document.getElementById('tab-home').hidden=false;document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-selected','false'));setMod('home');renderHome();scrollTo({top:0});return}
  document.getElementById('tab-home').hidden=true;hideSecs();const owner=AME.modules.find(m=>(m.tabs||[]).includes(t));
  if(owner&&owner.section){_st('yard');document.getElementById('tab-yard').hidden=true;document.getElementById(owner.section).hidden=false;document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));setMod(owner.id);if(owner.onShow)owner.onShow();scrollTo({top:0});return}
  if(owner&&owner.id!==AME.cur)setMod(owner.id);_st(t)};
const _su=window.setUser;window.setUser=function(n){const ch=n!==curUser;_su(n);if(ch&&n)setTimeout(()=>AME.home(),30)};
let started=false;const _ar=window.applyRole;window.applyRole=function(){_ar();if(curUser&&!started){started=true;setTimeout(()=>{if(start==='home'||!AME.mod(start))AME.home();else AME.open(start)},0);return}if(AME.cur)setMod(AME.cur);if(AME.cur==='home')renderHome()};
document.getElementById('brand').onclick=()=>{try{closeDlg()}catch(e){}if(curUser)AME.home();else showTab('yard')};
let start='home';try{start=sessionStorage.getItem('ameMod')||'home'}catch(e){}
})();
