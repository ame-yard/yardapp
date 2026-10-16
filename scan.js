/* AME scanning — phone camera + Bluetooth scanner (keyboard mode). Tags: code -> {itemId, unit} */
(function(){
let TAGS={};let lib=null;
(function w(){if(typeof db!=='undefined'&&db&&db.collection){db.collection('tags').onSnapshot(s=>{TAGS={};s.docs.forEach(d=>TAGS[d.id]=d.data())},()=>{})}else setTimeout(w,400)})();
const key=c=>String(c).trim().replace(/[\/\\#?%]/g,'_').slice(0,120);
function resolve(code){const c=String(code).trim();const t=TAGS[key(c)];if(t&&byId(t.itemId))return {it:byId(t.itemId),unit:t.unit||'',tag:c};
  const d=byId(c);if(d)return {it:d,unit:'',tag:c};
  for(const it of items){if(Array.isArray(it.serials)&&it.serials.includes(c))return {it,unit:c,tag:c}}return null}
const canReg=()=>typeof isAdmin!=='undefined'&&isAdmin;
/* ---------- result dialog ---------- */
function onCode(code,fromCam){code=String(code||'').trim();if(!code)return;try{navigator.vibrate&&navigator.vibrate(40)}catch(e){}
  if(AME.cur!=='yard'){AME.open('yard')}if(document.getElementById('tab-yard').hidden)showTab('yard');
  const r=resolve(code);if(!r)return unknown(code,fromCam);preview(r,fromCam)}
function preview(r,fromCam){const it=r.it;const units=Array.isArray(it.serials)?it.serials:[];const unitMode=!!r.unit;let n=1;const max=act==='OUT'?Math.max(0,Number(it.qty)||0):9999;
  const draw=()=>{document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg scdlg"><div class="scmode">${esc(ACTNAME[act]||act)}</div>
   <div class="scrow"><span class="scpic">${pic(it)}</span><div><h3 style="margin:0">${esc(it.name)}</h3><div class="muted">${esc([it.size,it.mfgr].filter(Boolean).join(' · '))}</div>
   <div class="scmeta"><b>${esc(it.loc||'')} ${esc(it.level||'')}</b> · ${esc(String(it.qty??''))} ${esc(it.unit||'')} in yard${unitMode?` · <b>Unit ${esc(r.unit)}</b>`:''}</div><div class="muted" style="font-size:12px">Tag ${esc(r.tag)}</div></div></div>
   ${unitMode?'':`<div class="scqty"><span>Quantity</span><div class="step"><button data-sq="-1">−</button><input id="scN" inputmode="numeric" value="${n}"><button data-sq="1">+</button></div><span class="muted">${esc(it.unit||'')}</span></div>`}
   <div class="bar"><button class="btn" id="scX">Cancel</button>${fromCam?'<button class="btn" id="scNext">Add &amp; scan next</button>':''}<button class="go" id="scOk" style="width:auto">Add to ${esc(ACTNAME[act]||'cart')}</button></div></div></div>`;
   document.querySelectorAll('[data-sq]').forEach(b=>b.onclick=()=>{n=Math.max(1,Math.min(max||9999,n+ +b.dataset.sq));draw()});
   const ni=document.getElementById('scN');if(ni)ni.onchange=()=>{n=Math.max(1,parseInt(ni.value)||1);if(act==='OUT'&&max&&n>max){n=max;toast('Only '+max+' in the yard')}draw()};
   document.getElementById('scX').onclick=closeDlg;
   const add=()=>{if(act==='OUT'&&!unitMode&&!max){toast('None left in the yard.');return false}const c=cart.find(x=>x.id===it.id);
     if(unitMode){if(c){c.units=[...new Set([...(c.units||[]),r.unit])];c.n=c.units.length}else cart.push({id:it.id,n:1,units:[r.unit]})}
     else if(c){c.n=act==='OUT'&&max?Math.min(max,c.n+n):c.n+n}else cart.push({id:it.id,n});
     closeDlg();renderCartBar();renderYard();toast('Added: '+it.name+(unitMode?' '+r.unit:' ×'+n));return true};
   document.getElementById('scOk').onclick=add;const nx=document.getElementById('scNext');if(nx)nx.onclick=()=>{if(add())openCam()}};draw()}
function unknown(code,fromCam){if(!canReg()){document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>Unknown tag</h3><p>Tag <b>${esc(code)}</b> isn't registered to any item yet. Ask the office to register it.</p><div class="bar"><button class="go" id="scX" style="width:auto">OK</button></div></div></div>`;document.getElementById('scX').onclick=closeDlg;return}
  let q='',pickIt=null;const draw=()=>{const l=pickIt?[]:items.filter(i=>!q||[i.name,i.size,i.mfgr,i.loc,i.id].join(' ').toLowerCase().includes(q)).slice(0,80);
   document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>New tag · ${esc(code)}</h3><p class="muted" style="margin-top:0">This tag isn't registered yet. Pick the yard item it's stuck on.</p>
    ${pickIt?`<div class="scrow"><span class="scpic">${pic(pickIt)}</span><div><b>${esc(pickIt.name)}</b><div class="muted">${esc(pickIt.loc||'')} · ${esc([pickIt.size,pickIt.mfgr].filter(Boolean).join(' · '))}</div><button class="btn small" id="scChg" style="margin-top:6px">Change</button></div></div>
      ${(pickIt.serials||[]).length?`<div class="qlabel">Which unit is this tag on?</div><div class="units">${['',...pickIt.serials].map(u=>`<button type="button" data-su="${esc(u)}"><b>${u?esc(u):'Whole item'}</b></button>`).join('')}</div>`:''}`
     :`<input id="scQ" class="search" placeholder="Search items…" value="${esc(q)}"><div class="qpl" style="max-height:50vh">${l.map(i=>`<button class="qpi" data-si="${esc(i.id)}"><b>${esc(i.name)}</b><span>${esc([i.size,i.mfgr,i.loc].filter(Boolean).join(' · '))}</span></button>`).join('')||'<div class="muted" style="padding:10px">No match</div>'}</div>`}
    <div class="bar"><button class="btn" id="scX">Cancel</button>${pickIt&&!(pickIt.serials||[]).length?'<button class="go" id="scSave" style="width:auto">Register tag</button>':''}</div></div></div>`;
   const qi=document.getElementById('scQ');if(qi){qi.focus();qi.setSelectionRange(q.length,q.length);qi.oninput=()=>{q=qi.value.toLowerCase();draw()}}
   document.querySelectorAll('[data-si]').forEach(b=>b.onclick=()=>{pickIt=byId(b.dataset.si);draw()});const ch=document.getElementById('scChg');if(ch)ch.onclick=()=>{pickIt=null;draw()};
   document.getElementById('scX').onclick=closeDlg;const save=async u=>{try{await db.doc('tags/'+key(code)).set({code,itemId:pickIt.id,unit:u||'',at:new Date().toISOString(),by:curUser});TAGS[key(code)]={itemId:pickIt.id,unit:u||''};toast('Tag registered to '+pickIt.name+(u?' '+u:''));preview({it:pickIt,unit:u||'',tag:code},fromCam)}catch(e){toast('Could not save: '+(e.message||e))}};
   const sv=document.getElementById('scSave');if(sv)sv.onclick=()=>save('');document.querySelectorAll('[data-su]').forEach(b=>b.onclick=()=>save(b.dataset.su))};draw()}
/* ---------- camera ---------- */
let camMode='bar';
async function openCam(){try{if(!window.Html5Qrcode){await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)})}}catch(e){toast('Scanner did not load — check the connection.');return}
  const o=document.createElement('div');o.id='camOv';o.innerHTML=`<div class="camhd"><b>Scan barcode / QR</b><span class="camact">${esc(ACTNAME[act]||'')}</span><button class="btn" id="camX">Close</button></div>
   <div class="camseg"><button data-cm="bar">Barcode</button><button data-cm="qr">QR code</button><button id="camT" hidden>Light</button></div>
   <div id="camWrap"><div id="camBox"></div><div class="camframe"><i></i><i></i><i></i><i></i><span class="camline"></span></div><p class="camhint">Fit the code inside the box</p></div>
   <div class="camft"><input id="camType" class="search" placeholder="…or type the tag number"><button class="btn pri" id="camGo">Go</button></div>`;document.body.appendChild(o);
  let done=false,q=null,torch=false;const box=()=>{const w=o.querySelector('#camWrap').clientWidth,h=o.querySelector('#camWrap').clientHeight;const W=Math.min(w*0.86,520);return camMode==='qr'?{width:Math.min(W,h*0.6)*0.8|0,height:Math.min(W,h*0.6)*0.8|0}:{width:W|0,height:Math.min(W*0.42,h*0.4)|0}};
  const sizeFrame=()=>{const b=box();const f=o.querySelector('.camframe');f.style.width=b.width+'px';f.style.height=b.height+'px';o.querySelectorAll('[data-cm]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.cm===camMode))};
  const stopQ=async()=>{if(q){try{await q.stop()}catch(e){}try{q.clear()}catch(e){}q=null}};
  const close=async()=>{done=true;await stopQ();o.remove()};
  const start=async()=>{await stopQ();sizeFrame();q=new Html5Qrcode('camBox',{verbose:false});
    try{await q.start({facingMode:'environment'},{fps:15,qrbox:()=>box(),disableFlip:true},txt=>{if(done)return;done=true;close().then(()=>onCode(txt,true))},()=>{});
      try{const c=q.getRunningTrackCapabilities&&q.getRunningTrackCapabilities();if(c&&c.torch)o.querySelector('#camT').hidden=false}catch(e){}}
    catch(e){o.querySelector('#camBox').innerHTML='<p style="padding:20px;color:#fff">Camera not available ('+esc(e.message||e)+'). Allow camera access for this site, or type the tag number below.</p>'}};
  o.querySelectorAll('[data-cm]').forEach(x=>x.onclick=()=>{camMode=x.dataset.cm;start()});
  o.querySelector('#camT').onclick=async()=>{torch=!torch;try{await q.applyVideoConstraints({advanced:[{torch}]})}catch(e){}};
  document.getElementById('camX').onclick=close;const go=()=>{const v=document.getElementById('camType').value.trim();if(v){close().then(()=>onCode(v,true))}};document.getElementById('camGo').onclick=go;document.getElementById('camType').onkeydown=e=>{if(e.key==='Enter')go()};
  start()}
window.ameScan=openCam;window.ameScanCode=onCode;
/* ---------- Bluetooth scanner (types fast + Enter) ---------- */
let buf='',last=0;document.addEventListener('keydown',e=>{const t=e.target;const typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)&&t.id!=='ysearch';const now=Date.now();
  if(e.key==='Enter'){if(buf.length>=3&&now-last<120&&!typing){e.preventDefault();const c=buf;buf='';if(t&&t.id==='ysearch'){t.value='';try{renderYard()}catch(_){}}onCode(c,false);return}buf='';return}
  if(e.key.length===1){if(now-last>80)buf='';buf+=e.key;last=now}},true);
/* ---------- button ---------- */
const row=document.querySelector('.ysrow');if(row){const b=document.createElement('button');b.type='button';b.className='btn scanbtn';b.title='Scan a tag with the camera';b.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/></svg><span>Scan code</span>';b.onclick=openCam;row.insertBefore(b,row.children[1])}
document.head.insertAdjacentHTML('beforeend',`<style>.scanbtn{display:inline-flex;align-items:center;gap:6px;font-weight:700;flex:none}#camOv{position:fixed;inset:0;z-index:100000;background:#000;display:flex;flex-direction:column}.camhd,.camft{display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;background:#2b2724;color:#f3ede6}.camhd b{flex:0 0 auto;font-size:17px}.camhd .muted{flex:1}.camft{padding:10px 14px calc(14px + env(safe-area-inset-bottom,0px))}.camft input{flex:1}#camWrap{flex:1;position:relative;overflow:hidden}#camBox{position:absolute;inset:0}#camBox video{width:100%!important;height:100%!important;object-fit:cover}#camBox #qr-shaded-region{border-color:rgba(0,0,0,.55)!important}#camBox #qr-shaded-region>div{display:none!important}.camframe{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;border-radius:12px;box-shadow:0 0 0 2000px rgba(0,0,0,.45)}.camframe i{position:absolute;width:28px;height:28px;border:4px solid #c8742c}.camframe i:nth-child(1){left:-4px;top:-4px;border-right:0;border-bottom:0;border-radius:12px 0 0 0}.camframe i:nth-child(2){right:-4px;top:-4px;border-left:0;border-bottom:0;border-radius:0 12px 0 0}.camframe i:nth-child(3){left:-4px;bottom:-4px;border-right:0;border-top:0;border-radius:0 0 0 12px}.camframe i:nth-child(4){right:-4px;bottom:-4px;border-left:0;border-top:0;border-radius:0 0 12px 0}.camline{position:absolute;left:8%;right:8%;top:50%;height:2px;background:#ff4d3a;box-shadow:0 0 8px #ff4d3a;animation:camln 1.6s ease-in-out infinite alternate}@keyframes camln{from{top:15%}to{top:85%}}.camhint{position:absolute;left:0;right:0;bottom:18px;text-align:center;color:#fff;font-weight:600;text-shadow:0 1px 4px #000;margin:0}.camseg{display:flex;gap:8px;justify-content:center;padding:8px;background:#2b2724}.camseg button{border:1px solid #6b625a;background:#3a3430;color:#f3ede6;border-radius:18px;padding:7px 16px;font:600 14px system-ui}.camseg button[aria-pressed=true]{background:#c8742c;border-color:#c8742c}.camact{flex:1;color:#c8742c;font-weight:700}.scdlg .scmode{display:inline-block;background:var(--hi);color:var(--hi-ink);font-weight:700;border-radius:8px;padding:3px 10px;margin-bottom:10px;font-size:13px}.scrow{display:flex;gap:14px;align-items:center;margin:6px 0 12px}.scpic{width:96px;height:96px;flex:none;border-radius:10px;overflow:hidden;display:block}.scpic img,.scpic .ph{width:100%;height:100%;object-fit:cover}.scpic .ph .pbig{font-size:18px}.scmeta{margin-top:6px}.scqty{display:flex;align-items:center;gap:12px;margin:8px 0}.scqty input{width:64px;text-align:center}</style>`);
})();
