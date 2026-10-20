/* AME responsive polish — phone card-rows for wide tables, "show more" on long tables, compact phone layouts. */
(function(){
if(/[?&]plain=1/.test(location.search)){try{localStorage.setItem('amePlain','1')}catch(e){}}if(/[?&]plain=0/.test(location.search)){try{localStorage.removeItem('amePlain')}catch(e){}}let PLAIN=false;try{PLAIN=localStorage.getItem('amePlain')==='1'}catch(e){}window.amePlain=PLAIN;if(PLAIN){console.warn('polish off');return}
let __ph=innerWidth<600;addEventListener('resize',()=>{__ph=innerWidth<600});const PH=()=>__ph;
const SKIP='.tstbl,.tssum,.sfmx,.frtbl,.nocard';
/* 1. Wide tables → labeled cards on phones */
function label(t){if(t.matches(SKIP)||t.closest('.nocard'))return;const ths=[...t.querySelectorAll(':scope>thead th')];if(ths.length<4){t.classList.remove('cardrows');return}
  const names=ths.map(h=>h.textContent.trim());let ti=ths.findIndex(h=>h.dataset.ph==='t');if(ti<0)ti=ths.findIndex(h=>/^(item|name|report|what|vehicle|course)$/i.test(h.textContent.trim()));if(ti<0)ti=0;t.classList.add('cardrows');
  t.querySelectorAll(':scope>tbody>tr').forEach(tr=>{if(tr.classList.contains('cr-hid')||tr.dataset.crl)return;tr.dataset.crl=1;const tds=[...tr.children];if(tds.length<3){tr.classList.add('cr-full');return}let ci=0;tds.forEach(td=>{const span=td.colSpan||1;td.classList.toggle('cr-t',ci===ti);if(!td.dataset.l&&names[ci]!==undefined)td.dataset.l=names[ci];if(!td.textContent.trim()&&!td.querySelector('img,button,input,select,.pill,.lchk'))td.classList.add('cr-empty');else td.classList.remove('cr-empty');ci+=span})})}
/* 2. Long tables → show 80 rows + "Show more" */
const LIM=80;
function limit(t){const tb=t.querySelector(':scope>tbody');if(!tb||tb.id==='itbody')return;let m=tb.querySelector(':scope>.showmore:not(#invMore)');const rows=[...tb.children].filter(r=>!r.classList.contains('showmore'));
  const fresh=rows.some(r=>!r.__k);if(!fresh)return;
  tb.__rest=[];if(rows.length>LIM+10){tb.__rest=rows.slice(LIM);tb.__rest.forEach(r=>r.remove())}rows.slice(0,LIM+10).forEach(r=>r.__k=1);
  const draw=()=>{const left=tb.__rest.length;if(!left){m&&m.remove();return}if(!m){m=document.createElement('tr');m.className='showmore'}m.innerHTML=`<td colspan="20"><button type="button" class="btn">Show ${Math.min(left,LIM)} more · ${left} hidden</button></td>`;
    m.querySelector('button').onclick=()=>{const add=tb.__rest.splice(0,LIM);add.forEach(r=>{r.__k=1;tb.insertBefore(r,m)});try{if(PH())label(t)}catch(e){}draw()};tb.appendChild(m)};draw()}
function one(t){try{limit(t);if(PH())label(t);else t.classList.remove('cardrows')}catch(e){}}
function pass(set){(set||document.querySelectorAll('table')).forEach(one)}
let tmr=0,dirty=new Set(),all=false;const sched=()=>{clearTimeout(tmr);tmr=setTimeout(()=>{const s=all?null:[...dirty];all=false;dirty.clear();if(s&&!s.length)return;pass(s)},60)};
new MutationObserver(ms=>{for(const m of ms){const n=m.target.nodeType===1?m.target:m.target.parentElement;const t=n&&n.closest&&n.closest('table');if(t)dirty.add(t);else for(const a of m.addedNodes){if(a.nodeType!==1)continue;if(a.tagName==='TABLE')dirty.add(a);else if(a.querySelectorAll)a.querySelectorAll('table').forEach(x=>dirty.add(x))}}if(dirty.size)sched()}).observe(document.body,{childList:true,subtree:true});addEventListener('resize',()=>{all=true;sched()});all=true;sched();
/* short labels on phones */
function shortLabels(){const t=document.querySelector('#sideSeg [data-sd=tool]');if(t)t.textContent=PH()?'Tools':'Tools & Equipment'}addEventListener('resize',shortLabels);setTimeout(shortLabels,0);
/* 3. Long help paragraphs collapse on phones (tap to read) */
document.addEventListener('click',e=>{const p=e.target.closest('.panel>p.muted,.frform>p.muted,section>p.muted');if(p&&PH())p.classList.toggle('open')});
document.head.insertAdjacentHTML('beforeend',`<style>
.showmore td{text-align:center;padding:10px}
@media(max-width:600px){
 table.cardrows{display:block;border:0}table.cardrows>thead{display:none}table.cardrows>tbody{display:block}
 table.cardrows>tbody>tr{display:flex;flex-wrap:wrap;gap:2px 10px;padding:10px 12px;border-bottom:1px solid var(--line);align-items:center}
 table.cardrows>tbody>tr>td{display:inline-flex;align-items:baseline;gap:5px;border:0;padding:1px 0;text-align:left!important;white-space:normal;font-size:14px;max-width:100%}
 table.cardrows>tbody>tr>td.cr-empty{display:none}
 table.cardrows>tbody>tr>td::before{content:attr(data-l);font-size:10px;letter-spacing:.05em;text-transform:uppercase;opacity:.55;flex:none}
 table.cardrows>tbody>tr>td.cr-t{flex:1 1 100%;order:-1;font-weight:700;font-size:15px}table.cardrows>tbody>tr>td.cr-t::before{display:none}table.cardrows>tbody>tr>td.cr-t .muted{font-weight:400}table.cardrows>tbody>tr>td.cr-t .btn{margin-left:auto}
 table.cardrows>tbody>tr>td.n{justify-content:flex-start}table.cardrows>tbody>tr.cr-full>td{flex:1 1 100%}table.cardrows>tbody>tr.cr-full>td::before{display:none}
 table.cardrows>tbody>tr.showmore>td{flex:1 1 100%;justify-content:center}table.cardrows>tbody>tr.showmore>td::before{display:none}
 table.cardrows>tbody>tr>td .btn.small{padding:4px 10px}
 /* home */
 #tab-home .apps{grid-template-columns:1fr;gap:8px;margin:10px 0 70px}#tab-home .apptile{display:grid;grid-template-columns:42px minmax(0,1fr);grid-template-areas:'ic name' 'ic desc' 'ic tag';column-gap:12px;row-gap:2px;align-items:center;padding:10px 14px;min-height:0;border-radius:14px}#tab-home .apptile .appic{grid-area:ic;width:42px;height:42px;margin:0;align-self:center}#tab-home .apptile b{grid-area:name;font-size:16px;line-height:1.2}#tab-home .apptile small{grid-area:desc;font-size:12px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;min-width:0;max-width:100%}#tab-home .apptile{overflow:hidden}#tab-home .apptile .betatag{grid-area:tag;margin:2px 0 0;font-size:9px;padding:2px 6px;justify-self:start}#tab-home .appbadge{top:50%;right:12px;transform:translateY(-50%)}
 #tab-home h2{font-size:22px;margin:8px 0 2px}#tab-home>p.muted{display:none}
 /* headings & help text */
 main h2{font-size:21px}main h3{font-size:16px}
 .panel>p.muted,section>p.muted{font-size:12.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}.panel>p.muted.open,section>p.muted.open{-webkit-line-clamp:unset}
 /* inventory */
 .kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px}.kpi{padding:8px 6px}.kpi b{font-size:20px}.kpi span{font-size:9.5px;line-height:1.15;display:block;letter-spacing:.03em}
 .browse .brow{grid-template-columns:52px minmax(0,1fr);gap:6px;align-items:center}.browse .chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none}.browse .chips::-webkit-scrollbar{display:none}.browse .chips button{white-space:nowrap;flex:0 0 auto}.blab{font-size:10px}
 #tab-inv .filters select{flex:1 1 44%;min-width:0;font-size:14px}#tab-inv .filters .btn{flex:1 1 44%}
 .sideseg button{font-size:13px;padding:10px 6px;letter-spacing:0}
 .tblwrap{border-radius:10px}
 /* yard */
 #tab-yard .act{padding:10px 6px;font-size:14px}
 /* jobs & activity */
 #tab-jobs .tblwrap table.cardrows>tbody>tr>td:first-child{font-size:14px}
 /* dialogs */
 .dlg h3{font-size:18px}.dlg .fields{gap:8px}
 #dlgRoot .dlg>.bar:last-child{position:sticky;bottom:-14px;z-index:3;background:var(--panel);margin:10px -14px -14px;padding:10px 14px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);border-radius:0 0 12px 12px}
 #dlgRoot .dlg>.bar:last-child .go,#dlgRoot .dlg>.bar:last-child .btn{min-height:48px}
 body{font-size:16px}input,select,textarea,button{font-size:16px}.btn.small{font-size:14px}.muted{font-size:14px}
 .names .lname{min-height:56px;font-size:18px}
 /* generic nav tabs scroll */
 nav.tabs{overflow-x:auto;scrollbar-width:none}nav.tabs::-webkit-scrollbar{display:none}
 main .mplhead{display:flex;flex-wrap:wrap;gap:8px;align-items:center}main .mplhead>h2{flex:1 1 100%;order:1;font-size:20px;line-height:1.2;margin:0}main .mplhead>.btn:first-child{order:0}main .mplhead>.mtop{order:0;margin-left:auto}
 .pill,.btn.small,.betatag{white-space:nowrap}
 #sideSeg button{font-size:13px}
 .tspaper{flex-direction:column;align-items:stretch}.tspaper>div:first-child{min-width:0}.tspaper .frph{width:100%;margin:0}.tspaper .frphadd{width:100%;height:auto;padding:10px;white-space:nowrap;font-size:14px}
 .frtbl input{min-width:96px}.frtbl input[type=date]{min-width:132px}.frtbl td:nth-child(2) input{min-width:150px}.frtbl input[inputmode=decimal],.frtbl input[inputmode=numeric]{min-width:64px}
 #pkP{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px}#pkP button{white-space:nowrap}
 .ystart h3{font-size:24px}
 .ddr{grid-template-columns:1fr auto;grid-template-areas:'t a' 's a'}.ddr>b{grid-area:t}.ddr>span:not(.muted){grid-area:s}.ddr>.muted{grid-area:a}
 .dvline{display:flex;flex-wrap:wrap;gap:6px}.dvline input[data-lf=name]{flex:1 1 100%}.dvline input[data-lf=qty]{flex:1}.dvline input[data-lf=unit]{flex:1}
 body.ro #addItem,body.ro #exportCsv{display:none}
 .elcfg{flex-wrap:wrap;gap:6px 10px}.elcfg small{flex:1 1 100%;order:2;font-size:12px}.elcfg #elType{margin-left:auto;white-space:nowrap}
 [data-pt] b,[data-tp] b,[data-sys] b,[data-eq] b,[data-at] b,[data-dnt] b{font-family:var(--body)!important}
}
@media(min-width:600px) and (max-width:900px){#tab-home .apps{grid-template-columns:repeat(2,1fr)}.act b{font-size:17px;letter-spacing:0;white-space:normal;line-height:1.1}.act span{display:none}.act{padding:10px 8px;min-height:56px;justify-content:center}}
</style>`);
})();
/* long-task log for debugging: window.__slow */
try{window.__slow=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__slow.push([Math.round(e.startTime),Math.round(e.duration)])}).observe({entryTypes:['longtask']})}catch(e){}
/* ---- Español toggle for the crew-facing screens (text-node swap, no code changes elsewhere) ---- */
(function(){
if(window.amePlain)return;
const ES={"Who's using the app?":"¿Quién está usando la app?","Tap your name.":"Toque su nombre.","Not on the list?":"¿No está en la lista?","Continue":"Continuar","HQ":"Oficina","Field":"Campo",
"What are you doing?":"¿Qué va a hacer?","Take Out":"Sacar","Take tools & materials to a job":"Llevar herramientas y materiales a una obra","Return":"Devolver","Bring things back to the yard":"Regresar cosas al yarda","Inventory check & update":"Revisar inventario","Count, fix quantities, add photos":"Contar, corregir cantidades, agregar fotos","Just look around":"Solo mirar",
"To a job":"A una obra","Back to yard":"De regreso al yarda","Repair":"Reparar","Requests & in repair":"Pedidos y en reparación","Audit":"Inventario","Count & photos":"Contar y fotos","Removed":"Retirado","Yard Map":"Mapa","Categories":"Categorías","Scan code":"Escanear","Tap a rack or search.":"Toque un estante o busque.","Search:":"Buscar:","Out on Jobs":"En obras","Ladders":"Escaleras","Power Tools":"Herramientas eléctricas","Hand Tools":"Herramientas de mano","Equipment":"Equipo","Safety":"Seguridad",
"Review & Confirm":"Confirmar","item":"artículo","items":"artículos","All out":"Todo fuera","Take Out · 1 item":"Sacar · 1 artículo","Add photo":"Agregar foto","Done":"Listo","Close":"Cerrar","Save":"Guardar","Nothing here.":"Nada aquí.","Clear":"Borrar","Type your name (e.g. John D.)":"Escriba su nombre (ej. Juan P.)","PO #, damage, who has it...":"PO #, daño, quién lo tiene...","Tap an empty day to reserve that truck. Red outline = double-booked.":"Toque un día vacío para reservar ese camión.","Cart is empty.":"El carrito está vacío.","Which job?":"¿Para qué obra?","Other / not listed":"Otra / no está","type below":"escriba abajo","Repair shop":"Taller","Taking it to be fixed":"Se lleva a reparar","Note (optional)":"Nota (opcional)","Keep shopping":"Seguir","Confirm Take Out":"Confirmar salida","Confirm Return":"Confirmar devolución","Which one are you taking?":"¿Cuál se lleva?","Which one is coming back?":"¿Cuál regresa?","Tap the number on the ladder / tool you are taking.":"Toque el número de la escalera / herramienta que se lleva.","Cancel":"Cancelar","Select all":"Todos","Pick a number":"Elija un número","In yard":"En yarda","Out":"Fuera","Units":"Unidades","Remove":"Quitar","Show all":"Ver todo","+ Add item here":"+ Agregar artículo","Select to remove":"Seleccionar para quitar","Remove":"Quitar","Edit":"Editar","Map":"Mapa",
"Hi":"Hola","What are you working on?":"¿En qué va a trabajar?","Yard Inventory":"Inventario del yarda","Inventory":"Inventario","Take out · return · repair · audit":"Sacar · devolver · reparar · inventario","Sync":"Sincronizar","Save":"Guardar","Saved":"Guardado","Switch":"Cambiar","Signed out after 10 minutes idle":"Sesión cerrada por inactividad"};
let lang='';try{lang=localStorage.getItem('ameLang')||''}catch(e){}
const map=new Map();
function tr(root){if(lang!=='es')return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const list=[];let n;while(n=w.nextNode())list.push(n);
  for(const t of list){const p=t.parentNode;if(!p||/SCRIPT|STYLE|INPUT|TEXTAREA/.test(p.nodeName))continue;const raw=t.nodeValue;const k=raw.trim();if(!k)continue;const v=ES[k];if(v&&!map.has(t)){map.set(t,raw);t.nodeValue=raw.replace(k,v)}}
  root.querySelectorAll&&root.querySelectorAll('input[placeholder],button[title]').forEach(el=>{const k=el.placeholder||'';if(ES[k]&&!el.dataset.esp){el.dataset.esp=k;el.placeholder=ES[k]}})}
function untr(){map.forEach((raw,t)=>{if(t.isConnected)t.nodeValue=raw});map.clear();document.querySelectorAll('[data-esp]').forEach(el=>{el.placeholder=el.dataset.esp;delete el.dataset.esp})}
let tm=0;new MutationObserver(ms=>{const lb=document.querySelector('#loginRoot .loginbox');if(lb&&!lb.querySelector('#langL')){const a=document.createElement('button');a.id='langL';a.type='button';a.className='btn';a.style.cssText='margin-top:14px';a.textContent=lang==='es'?'English':'Español';a.onclick=()=>{lang=lang==='es'?'':'es';try{localStorage.setItem('ameLang',lang)}catch(e){}if(lang==='es')tr(document.body);else untr();a.textContent=lang==='es'?'English':'Español';paint()};lb.appendChild(a)}if(lang!=='es')return;clearTimeout(tm);tm=setTimeout(()=>tr(document.body),30)}).observe(document.body,{childList:true,subtree:true,characterData:true});
function btn(){let b=document.getElementById('langBtn');if(b)return b;const bell=document.getElementById('bellBtn');if(!bell)return null;b=document.createElement('button');b.id='langBtn';b.type='button';b.className='bell';b.style.cssText='font:700 13px var(--body);padding:6px 9px';bell.parentNode.insertBefore(b,bell.nextSibling);
  b.onclick=()=>{lang=lang==='es'?'':'es';try{localStorage.setItem('ameLang',lang)}catch(e){}if(lang==='es')tr(document.body);else untr();paint()};return b}
function paint(){const b=btn();if(!b)return;b.textContent=lang==='es'?'EN':'ES';b.title=lang==='es'?'Switch to English':'Cambiar a español';b.hidden=!(typeof curUser!=='undefined'&&curUser)}
setTimeout(()=>{paint();if(lang==='es')tr(document.body)},800);const _ar=window.applyRole;window.applyRole=function(){_ar&&_ar.apply(this,arguments);paint()};
})();
/* Crew (read-only) navigation: Take Out / Return / Inventory always visible in the Yard app */
(function(){
function cur(){const inv=!document.getElementById('tab-inv').hidden;if(inv)return 'INV';const a=document.querySelector('#actions .act[aria-pressed="true"]');return a?a.dataset.act:'OUT'}
function draw(){const ro=document.body.classList.contains('ro');const inYard=document.body.dataset.mod==='yard';let n=document.getElementById('crewNav');
  if(!ro||!inYard||!(typeof curUser!=='undefined'&&curUser)){if(n)n.hidden=true;return}
  if(!n){n=document.createElement('div');n.id='crewNav';n.className='crewnav';const h=document.querySelector('header .wrap')||document.querySelector('header');h.appendChild(n);
    n.addEventListener('click',e=>{const b=e.target.closest('[data-cn]');if(!b)return;const k=b.dataset.cn;
      if(k==='INV'){if(typeof can==='function'&&can('AUDIT')){showTab('yard');document.querySelector('#actions .act[data-act="AUDIT"]')?.click()}else showTab('inv')}
      else{showTab('yard');setTimeout(()=>document.querySelector('#actions .act[data-act="'+k+'"]')?.click(),0)}scrollTo({top:0});setTimeout(draw,50)})}
  n.hidden=false;const c=cur();const L=[['OUT','Take Out','#e8594a'],['RETURN','Return','#3fb950'],['INV','Inventory','#a98bff']];
  n.innerHTML=L.map(([k,l,col])=>`<button type="button" data-cn="${k}" style="--c:${col}" aria-pressed="${c===k||(k==='INV'&&c==='AUDIT')}">${l}</button>`).join('')}
setInterval(draw,800);document.addEventListener('click',()=>setTimeout(draw,60),true);
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('nav.tabs button,.crewnav button');if(b)b.blur()},true);
document.head.insertAdjacentHTML('beforeend',`<style>nav.tabs button:focus,nav.tabs button:focus-visible,.crewnav button:focus{outline:none}nav.tabs button{-webkit-transform:translateZ(0);transform:translateZ(0);-webkit-tap-highlight-color:transparent;border:0!important;box-shadow:none!important;text-decoration:none}.countsteps li{margin:8px 0;line-height:1.45}.countsteps li>.btn{display:inline-flex;margin:2px 6px 2px 0;vertical-align:middle;line-height:1.2}@media(max-width:600px){.countsteps{padding-left:0;list-style:none}.countsteps li>.btn{display:flex;width:100%;justify-content:center;margin:0 0 4px}}.crewnav{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:100%;order:11;padding:8px 0 2px}.crewnav[hidden]{display:none}.crewnav button{min-height:46px;border-radius:10px;border:2px solid var(--c);background:transparent;color:var(--c);font:800 16px var(--display,inherit);letter-spacing:.02em;text-transform:uppercase;cursor:pointer}.crewnav button[aria-pressed=true]{background:var(--c);color:#fff}
body.ro #tab-yard #actions{display:none}</style>`);
})();
