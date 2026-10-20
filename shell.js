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
  appState(m){try{if((perms.hidden||[]).includes(m.id))return 'hidden';if((perms.released||[]).includes(m.id))return 'released';if((perms.early||[]).includes(m.id))return 'beta'}catch(e){}return m.beta?'beta':'released'},
  betaOk(m){if(typeof isOwner==='function'&&isOwner(curUser))return true;const st=this.appState(m);if(st==='hidden')return false;if(st==='released')return true;if(typeof isOwner==='function'&&isOwner(curUser))return true;try{return ((perms.beta||{})[m.id]||[]).includes(curUser)}catch(e){return false}},
  allowed(m){return this.base(m)&&this.betaOk(m)},
  home(){setMod('home');showTab('home');document.documentElement.classList.remove('boot')},
  seenKey(id){return 'ameSeen:'+(typeof curUser!=='undefined'?curUser:'')+':'+id},
  seen(id){try{let v=localStorage.getItem(this.seenKey(id));if(!v){v=new Date().toISOString();localStorage.setItem(this.seenKey(id),v)}return v}catch(e){return new Date().toISOString()}},
  markSeen(id){if(!id||id==='home'||(typeof viewAs!=='undefined'&&viewAs))return;try{localStorage.setItem(this.seenKey(id),new Date().toISOString())}catch(e){}},
  count(m){try{return m.badge?Math.max(0,m.badge(this.seen(m.id))|0):0}catch(e){return 0}},
  badges(){clearTimeout(this._bt);this._bt=setTimeout(()=>{if(this.cur==='home')renderHome()},300)},
  open(id){setTimeout(()=>document.documentElement.classList.remove('boot'),0);const m=this.mod(id);if(!m||!this.allowed(m))return;setMod(id);m.open()}};
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
function renderHome(){if(window.__ameDragging)return;const el=document.getElementById('tab-home');if(!el)return;const mods=AME.modules.filter(m=>AME.allowed(m));let soon=AME.modules.filter(m=>AME.appState(m)==='beta'&&!AME.betaOk(m));
  el.innerHTML=`<div class="homehead"><div><h2>Hi ${esc(curUser||'')}</h2><p class="muted">What are you working on?</p></div>${(matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>1)&&mods.some(m=>m.id==='yard')&&window.ameScan?`<button type="button" class="homescan" id="homeScan" title="Scan a barcode / QR" aria-label="Scan a barcode or QR code"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg><span>Scan</span></button>`:''}</div>
  <div class="apps">${mods.length?'':'<p class="muted">No apps are turned on for you yet. Ask Kyle to give you access.</p>'}${mods.map(m=>`<button class="apptile" data-app="${m.id}"><span class="appic">${m.icon||''}</span><b>${esc(m.name)}</b><small>${esc(m.desc||'')}</small>${AME.appState(m)==='beta'?'<em class="betatag">Early access</em>':AME.appState(m)==='hidden'?'<em class="betatag" style="background:#555">Hidden</em>':''}${(n=>n?`<span class="appbadge">${n>99?'99+':n}</span>`:'')(AME.count(m))}</button>`).join('')}${soon.map(m=>`<div class="apptile soon" aria-disabled="true"><span class="appic">${m.icon||''}</span><b>${esc(m.name)}</b><small>${esc(m.desc||'')}</small><em class="betatag">Upcoming — in preparation</em></div>`).join('')}
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
let started=false;const _ar=window.applyRole;window.applyRole=function(){_ar();if(curUser&&!started){started=true;setTimeout(()=>{if(start==='home'||!AME.mod(start)||!(typeof isEditor==='function'&&isEditor(curUser)))AME.home();else AME.open(start)},0);return}if(AME.cur)setMod(AME.cur);if(AME.cur==='home')renderHome()};
document.getElementById('brand').onclick=()=>{try{closeDlg()}catch(e){}if(curUser)AME.home();else showTab('yard')};
let start='home';try{start=sessionStorage.getItem('ameMod')||'home'}catch(e){}
})();

/* ---- Back support: every screen change (app, tab, rack, view) and every dialog is a history entry ---- */
(function(){const H=window.history;let dlgOn=false,restoring=false,silent=0,depth=0;
  const tabNow=()=>{const b=[...document.querySelectorAll('nav.tabs button[data-tab]')].find(b=>b.getAttribute('aria-selected')==='true');return b?b.dataset.tab:''};
  const snap=()=>{const m=AME.cur||'home';let s=null;try{if(m==='yard')s={act:typeof act!=='undefined'?act:'',yLoc:typeof yLoc!=='undefined'?yLoc:'',yView:typeof yView!=='undefined'?yView:'',mZone:typeof mZone!=='undefined'?mZone:'',yGroup:typeof yGroup!=='undefined'?yGroup:'',elev:typeof elevOpen!=='undefined'?elevOpen:false};else if(AME.nav&&AME.nav[m])s=AME.nav[m].get()}catch(e){}
    return {mod:m,tab:m==='yard'?tabNow():'',s}};
  const key=o=>JSON.stringify([o.mod,o.tab,o.s]);
  try{H.replaceState({nav:snap(),k:key(snap()),d:0},'')}catch(e){}
  const btn=()=>{const b=document.getElementById('appBack');if(b)b.hidden=!(depth>0||dlgOn)};
  const check=()=>{if(restoring||dlgOn)return;const n=snap();const k=key(n);if(H.state&&H.state.k===k)return;depth++;try{H.pushState({nav:n,k,d:depth},'')}catch(e){}btn()};
  let ct=null;const soon=()=>{clearTimeout(ct);ct=setTimeout(check,80)};
  ['click','change','keyup'].forEach(ev=>document.addEventListener(ev,soon,true));
  const _home=AME.home.bind(AME),_open=AME.open.bind(AME);AME.home=function(){_home();soon()};AME.open=function(id){_open(id);soon()};
  const root=document.getElementById('dlgRoot');
  if(root)new MutationObserver(()=>{const open=!!root.querySelector('.dlg,.scrim');
    if(open&&!dlgOn){dlgOn=true;try{H.pushState({...(H.state||{}),dlg:1},'')}catch(e){}btn()}
    else if(!open&&dlgOn){dlgOn=false;if(H.state&&H.state.dlg){silent++;H.back()}btn()}}).observe(root,{childList:true});
  const restore=n=>{restoring=true;try{const m=n.mod||'home';if(m==='home'||!AME.mod(m))_home();else if(AME.cur!==m)_open(m);
      if(m==='yard'&&n.s){const s=n.s;if(n.tab&&n.tab!==tabNow()&&typeof showTab==='function')showTab(n.tab);act=s.act||act;yLoc=s.yLoc||'';if(s.yView)yView=s.yView;mZone=s.mZone||'';if(s.yGroup)yGroup=s.yGroup;elevOpen=!!s.elev;
        document.querySelectorAll('#actions .act').forEach(x=>x.setAttribute('aria-pressed',x.dataset.act===act));try{render()}catch(e){}}
      else if(n.s&&AME.nav&&AME.nav[m])AME.nav[m].set(n.s)}catch(e){console.warn('nav',e)}setTimeout(()=>{restoring=false},120)};
  window.addEventListener('popstate',e=>{if(silent){silent--;return}const st=e.state||{};
    if(dlgOn){dlgOn=false;try{closeDlg()}catch(x){root.innerHTML=''}btn();return}
    depth=st.d||0;if(st.nav)restore(st.nav);else restore({mod:'home'});btn()});
  /* mouse side buttons in installed-app windows that don't navigate on their own */
  let lastPop=0;window.addEventListener('popstate',()=>{lastPop=Date.now()},true);
  window.addEventListener('mouseup',e=>{if(e.button!==3&&e.button!==4)return;const t=Date.now();setTimeout(()=>{if(lastPop<t-5)e.button===3?H.back():H.forward()},120)});
  /* on-screen Back button (phones especially) */
  if(!document.getElementById('appBack')){const b=document.createElement('button');b.id='appBack';b.type='button';b.className='appback';b.hidden=true;b.setAttribute('aria-label','Back');b.title='Back';b.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';b.onclick=()=>H.back();document.body.appendChild(b)}
  document.head.insertAdjacentHTML('beforeend','<style>.appback{position:fixed;left:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 20px);z-index:9990;width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(43,39,36,.92);color:#fff;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 4px 14px rgba(0,0,0,.45);cursor:pointer}.appback[hidden]{display:none}body.hascart .appback{bottom:calc(env(safe-area-inset-bottom,0px) + 96px)}@media (min-width:900px){.appback{display:none}}</style>');
})();

document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#homeScan');if(!b)return;AME.open('yard');setTimeout(()=>{try{window.ameScan()}catch(x){}},150)});
document.head.insertAdjacentHTML('beforeend','<style>.homehead{display:flex;align-items:center;gap:12px}.homehead>div{flex:1;min-width:0}.homescan{flex:none;display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 14px;border-radius:22px;border:1px solid var(--line,#5a514a);background:var(--chip,#3a3532);color:inherit;font-weight:700;cursor:pointer}.homescan svg{color:#f26a1b}</style>');

/* ---- App notifications (truck reservations, delivery notices) on this phone/computer ---- */
(function(){
  const reg=()=>navigator.serviceWorker&&navigator.serviceWorker.getRegistration?navigator.serviceWorker.getRegistration():Promise.resolve(null);
  window.ameNotify=async(title,body,tag,data)=>{try{if(!('Notification' in window)||Notification.permission!=='granted')return;if(!document.hidden&&document.hasFocus())return;
    const r=await reg();const o={body,tag,icon:'ame-192.png',badge:'ame-192.png',data:data||{}};if(r&&r.showNotification)await r.showNotification(title,o);else new Notification(title,o)}catch(e){}};
  window.ameNotifyAsk=async()=>{try{if(!('Notification' in window)){toast('This device can’t show app notifications. On iPhone, add AME to the Home Screen first.');return}const p=await Notification.requestPermission();toast(p==='granted'?'Notifications on for this device':'Notifications are blocked — turn them on in the phone settings');try{updBell()}catch(e){}}catch(e){}};
  let since=new Date().toISOString();
  setInterval(()=>{try{if(typeof logs==='undefined'||!logs.length||!curUser)return;const nw=logs.filter(g=>g.ts>since&&g.by!==curUser&&g.action==='DELIV');if(!nw.length){since=logs[0].ts>since?logs[0].ts:since;return}
    since=nw.reduce((a,g)=>g.ts>a?g.ts:a,since);nw.slice(0,3).forEach(g=>window.ameNotify(g.note&&/^Claimed/.test(g.note)?'Delivery claimed':'Delivery at the yard',(g.name||'Delivery')+(g.job?' · Job '+g.job:'')+(g.note&&/^Claimed/.test(g.note)?' · '+g.by:''),'deliv-'+(g.dv||g.ts),{mod:'deliv',dv:g.dv||''}))}catch(e){}},5000);
  if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',e=>{const d=e.data||{};if(d.type==='open'&&d.mod){try{if(d.dv&&window.ameDelivClaim){window.ameDelivClaim(d.dv)}else AME.open(d.mod)}catch(x){}}});
})();

/* ---- long-press to reorder (home app tiles, Admin panels); order is remembered per person on this device ---- */
(function(){
const okey=n=>'ameOrder:'+n+':'+(typeof curUser!=='undefined'?curUser:'');
const get=n=>{try{return JSON.parse(localStorage.getItem(okey(n))||'[]')}catch(e){return[]}};
const put=(n,a)=>{try{localStorage.setItem(okey(n),JSON.stringify(a))}catch(e){}};
const SP=[{name:'home',root:'#tab-home',box:'.apps',item:'.apptile[data-app]',key:e=>e.dataset.app},{name:'admin',root:'#tab-admin',box:null,item:'.panel[id]',key:e=>e.id}];
function boxOf(sp){const r=document.querySelector(sp.root);return r?(sp.box?r.querySelector(sp.box):r):null}
function apply(sp){const box=boxOf(sp);if(!box||box.__ordAp)return;box.__ordAp=1;const ord=get(sp.name);if(!ord.length)return;const els=[...box.querySelectorAll(':scope>'+sp.item)];if(!els.length)return;const tail=els[els.length-1].nextSibling;
  els.sort((a,b)=>{const ia=ord.indexOf(sp.key(a)),ib=ord.indexOf(sp.key(b));return (ia<0?999:ia)-(ib<0?999:ib)}).forEach(e=>box.insertBefore(e,tail))}
let d=null,dsp=null,tm=null,sx=0,sy=0,sup=false;
const findItem=t=>{for(const sp of SP){const el=t&&t.closest&&t.closest(sp.root+' '+(sp.box?sp.box+'>':'')+sp.item);if(el&&el.parentElement===boxOf(sp))return [el,sp]}return [null,null]};
const start=(t,x,y)=>{if(t.closest('input,select,textarea,a'))return;let [el,sp]=findItem(t);if(!el)return;if(sp.name==='admin'&&t.closest('button')&&!t.closest('h3'))return;sx=x;sy=y;clearTimeout(tm);
  const k=sp.key(el);tm=setTimeout(()=>{const b=boxOf(sp);el=(b?[...b.querySelectorAll(':scope>'+sp.item)]:[]).find(e=>sp.key(e)===k)||el;d=el;dsp=sp;window.__ameDragging=true;el.classList.add('srt-drag');el.parentElement.classList.add('srt-on');try{navigator.vibrate&&navigator.vibrate(30)}catch(e){}},450)};
const move=(x,y,ev)=>{if(!d){if(tm&&Math.abs(x-sx)+Math.abs(y-sy)>10){clearTimeout(tm);tm=null}return}if(ev.cancelable)ev.preventDefault();const box=d.parentElement;
  const o=document.elementFromPoint(x,y)?.closest(dsp.item);if(o&&o!==d&&o.parentElement===box){const r=o.getBoundingClientRect();const wide=r.width>innerWidth*.6;const after=wide?y>r.top+r.height/2:(x>r.left+r.width/2||y>r.bottom-8);box.insertBefore(d,after?o.nextSibling:o)}
  if(y<80)scrollBy(0,-12);else if(y>innerHeight-80)scrollBy(0,12)};
const end=()=>{clearTimeout(tm);tm=null;if(!d)return;const box=d.parentElement;d.classList.remove('srt-drag');box&&box.classList.remove('srt-on');put(dsp.name,[...box.querySelectorAll(':scope>'+dsp.item)].map(dsp.key));d=null;window.__ameDragging=false;sup=true;setTimeout(()=>sup=false,400);try{toast('Order saved')}catch(e){}};
document.addEventListener('touchstart',e=>start(e.target,e.touches[0].clientX,e.touches[0].clientY),{passive:true,capture:true});
document.addEventListener('touchmove',e=>{if(d||tm)move(e.touches[0].clientX,e.touches[0].clientY,e)},{passive:false});document.addEventListener('touchend',end);document.addEventListener('touchcancel',end);
document.addEventListener('mousedown',e=>{if(!e.button)start(e.target,e.clientX,e.clientY)},true);document.addEventListener('mousemove',e=>{if(d||tm)move(e.clientX,e.clientY,e)});document.addEventListener('mouseup',end);
document.addEventListener('click',e=>{if(sup){e.stopPropagation();e.preventDefault();sup=false}},true);
document.addEventListener('contextmenu',e=>{if(findItem(e.target)[0])e.preventDefault()});
const hook=()=>{const a=document.getElementById('tab-admin');if(a)[...a.children].forEach((c,i)=>{if(c.classList.contains('panel')&&!c.id)c.id='admP'+(c.querySelector('h3')?.textContent||i).trim().replace(/\W+/g,'').slice(0,20)});SP.forEach(apply)};
new MutationObserver(hook).observe(document.body,{childList:true,subtree:true});hook();
document.head.insertAdjacentHTML('beforeend','<style>.srt-drag{opacity:.85;transform:scale(1.03);box-shadow:0 10px 28px rgba(0,0,0,.5)!important;outline:2px dashed var(--hi,#f26a1b);z-index:5;position:relative}.srt-on{user-select:none;-webkit-user-select:none}.srt-on *{cursor:grabbing!important}#tab-home .apptile,#tab-admin>.panel{-webkit-touch-callout:none}</style>');
})();

/* ---- swipe left on a row to remove (phones) ---- */
window.ameSwipe=function(el,label,onGo){let x0=null,y0=0,dx=0,lock=null;el.style.touchAction='pan-y';
  el.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY;dx=0;lock=null;el.style.transition='none'},{passive:true});
  el.addEventListener('touchmove',e=>{if(x0===null)return;const mx=e.touches[0].clientX-x0,my=e.touches[0].clientY-y0;if(lock===null&&Math.abs(mx)+Math.abs(my)>10)lock=Math.abs(mx)>Math.abs(my)?'x':'y';if(lock!=='x')return;if(e.cancelable)e.preventDefault();dx=Math.min(0,mx);el.style.transform=`translateX(${dx}px)`;el.classList.toggle('swipe-on',dx<-15);el.classList.toggle('swipe-go',dx<-90);el.dataset.swl=label||'Delete'},{passive:false});
  el.addEventListener('touchend',async()=>{if(x0===null)return;x0=null;el.style.transition='transform .2s';if(lock==='x'){el.__swiped=1;setTimeout(()=>el.__swiped=0,400)}const go=dx<-90;el.style.transform='';el.classList.remove('swipe-go','swipe-on');if(go)await onGo()});
  el.addEventListener('click',e=>{if(el.__swiped){e.stopImmediatePropagation();e.preventDefault()}},true)};
{const TR="url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6'/%3E%3C/svg%3E\")";
document.head.insertAdjacentHTML('beforeend',`<style>.swipe-on{position:relative;overflow:visible!important}.swipe-on::after{content:attr(data-swl);position:absolute;top:50%;left:calc(100% + 10px);transform:translateY(-50%);display:flex;align-items:center;gap:6px;padding:8px 12px 8px 36px;border-radius:999px;background:#5a514a ${TR} no-repeat 10px center/20px 20px;color:#fff;font:700 14px system-ui,sans-serif;white-space:nowrap;pointer-events:none;transition:background-color .15s}.swipe-go::after{background-color:#e5534b}.swipe-go{box-shadow:inset -4px 0 0 #e5534b}</style>`)}

/* ---- full-screen photo viewer: two-finger pinch to zoom, drag to move, double-tap to zoom in/out, Close or Back to close ---- */
window.ameZoom=function(src){if(!src)return;let o=document.getElementById('zoomOv');if(o)o.remove();o=document.createElement('div');o.id='zoomOv';
  o.innerHTML=`<div class="zhd"><span class="zhint">Pinch with two fingers to zoom</span><button type="button" class="zx" aria-label="Close"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg> Close</button></div><div class="zsc"><img alt="" src="${src}" draggable="false"></div>`;document.body.appendChild(o);
  const img=o.querySelector('img'),sc=o.querySelector('.zsc');let s=1,tx=0,ty=0,st=null,lastTap=0;
  const clamp=()=>{s=Math.min(6,Math.max(1,s));if(s===1){tx=0;ty=0}const r=sc.getBoundingClientRect(),w=img.offsetWidth*s,h=img.offsetHeight*s;const mx=Math.max(0,(w-r.width)/2),my=Math.max(0,(h-r.height)/2);tx=Math.min(mx,Math.max(-mx,tx));ty=Math.min(my,Math.max(-my,ty))};
  const apply=()=>{clamp();img.style.transform=`translate(${tx}px,${ty}px) scale(${s})`};
  const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY),mid=t=>({x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2});
  sc.addEventListener('touchstart',e=>{const t=e.touches;if(t.length===2)st={d:dist(t),s,m:mid(t),tx,ty};else if(t.length===1){st={x:t[0].clientX,y:t[0].clientY,tx,ty,one:1};const now=Date.now();if(now-lastTap<300){const r=sc.getBoundingClientRect();if(s>1){s=1}else{s=2.5;tx=(r.width/2-(t[0].clientX-r.left))*1.5;ty=(r.height/2-(t[0].clientY-r.top))*1.5}img.style.transition='transform .2s';apply();setTimeout(()=>img.style.transition='',220)}lastTap=now}},{passive:true});
  sc.addEventListener('touchmove',e=>{if(!st)return;const t=e.touches;e.preventDefault();if(t.length===2&&st.d){const m=mid(t);s=st.s*dist(t)/st.d;tx=st.tx+(m.x-st.m.x);ty=st.ty+(m.y-st.m.y);apply()}else if(t.length===1&&st.one&&s>1){tx=st.tx+(t[0].clientX-st.x);ty=st.ty+(t[0].clientY-st.y);apply()}},{passive:false});
  sc.addEventListener('touchend',e=>{if(e.touches.length===0)st=null;else if(e.touches.length===1)st={x:e.touches[0].clientX,y:e.touches[0].clientY,tx,ty,one:1}});
  sc.addEventListener('wheel',e=>{e.preventDefault();s*=e.deltaY<0?1.15:1/1.15;apply()},{passive:false});
  img.addEventListener('dblclick',()=>{s=s>1?1:2.5;apply()});
  const close=()=>{o.remove();if(history.state&&history.state.zoom)history.back()};o.querySelector('.zx').onclick=close;
  try{history.pushState({...(history.state||{}),zoom:1},'')}catch(e){}const pop=()=>{o.remove();removeEventListener('popstate',pop)};addEventListener('popstate',pop)};
document.head.insertAdjacentHTML('beforeend','<style>#zoomOv{position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.95);display:flex;flex-direction:column}#zoomOv .zhd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 10px}#zoomOv .zhint{color:#bbb;font-size:13px}#zoomOv button{height:44px;padding:0 16px;border-radius:22px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff;font-weight:700;display:flex;align-items:center;gap:6px}#zoomOv .zsc{flex:1;overflow:hidden;display:flex;align-items:center;justify-content:center;touch-action:none}#zoomOv img{max-width:100%;max-height:100%;display:block;transform-origin:center center;will-change:transform;user-select:none;-webkit-user-select:none}</style>');

/* Job # inputs start with "#" already typed */
(function(){const SEL='#clJ,#dj,#rv_job,#l_job,#job,#fsN,#j_no,input[data-jobno]';
  const D=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  const prep=el=>{if(el._hj)return;el._hj=1;Object.defineProperty(el,'value',{configurable:true,get(){const v=D.get.call(this);return v.trim()==='#'?'':v},set(x){D.set.call(this,typeof x==='string'&&/^\d/.test(x)?'#'+x:x)}});
    {const v0=D.get.call(el);if(!el.readOnly&&!el.disabled){if(!v0)D.set.call(el,'#');else if(/^\d/.test(v0))D.set.call(el,'#'+v0)}}
    el.addEventListener('input',()=>{const v=D.get.call(el);if(v&&!v.startsWith('#')&&/^\d/.test(v)){D.set.call(el,'#'+v)}else if(!v){D.set.call(el,'#')}});
    el.addEventListener('focus',()=>{if(!D.get.call(el))D.set.call(el,'#');setTimeout(()=>{try{const n=D.get.call(el).length;el.setSelectionRange(n,n)}catch(e){}},0)})};
  const scan=r=>{(r.querySelectorAll?r:document).querySelectorAll(SEL).forEach(prep);if(r.matches&&r.matches(SEL))prep(r)};
  new MutationObserver(ms=>{for(const m of ms)m.addedNodes.forEach(n=>n.nodeType===1&&scan(n))}).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',()=>scan(document));scan(document)})();
