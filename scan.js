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
  const r=resolve(code);if(!r)return unknown(code,fromCam);if(document.querySelector('#dlgRoot .dlg'))return preview(r,fromCam);if(quick(r))return;preview(r,fromCam)}
/* scanner fast lane: each scan goes straight into the list; Take Out vs Return is picked per item */
function quick(r){if(!['OUT','RETURN'].includes(act))return false;const it=r.it;const sn=r.unit;const units=sers(it);
  const want=sn?(ust(it,sn).st==='out'?'RETURN':'OUT'):((Number(it.qty)||0)<=0&&(it.out||0)>0?'RETURN':'OUT');
  if(sn&&ust(it,sn).st==='repair'){toast('Unit '+sn+' is in repair — use Repair.');return true}
  if(act!==want){if(cart.length){toast(`${it.name}${sn?' '+sn:''} is ${want==='RETURN'?'out on a job → Return':'in the yard → Take Out'}. Finish the ${ACTNAME[act]} list first (${cart.length} item${cart.length>1?'s':''}).`);try{navigator.vibrate&&navigator.vibrate([60,60,60])}catch(e){}return true}
    const b=document.querySelector(`#actions .act[data-act="${want}"]`);if(b)b.click();else act=want}
  if(!sn&&units.length&&(act==='OUT'||Object.values(it.units||{}).some(u=>u&&u.st==='out'))){openUnitPicker(it.id);return true}
  if(act==='OUT'&&!sn&&(Number(it.qty)||0)<=0){toast('None of '+it.name+' left in the yard.');return true}
  let c=cart.find(x=>x.id===it.id);
  if(sn){if(c&&(c.units||[]).includes(sn)){toast(it.name+' '+sn+' is already in the list');return true}if(c){c.units=[...(c.units||[]),sn];c.n=c.units.length}else cart.push({id:it.id,n:1,units:[sn]})}
  else{const cap=act==='OUT'?(Number(it.qty)||0):act==='RETURN'?Math.max(1,Number(it.out)||0):9999;if(c){if(c.n>=cap){toast(act==='OUT'?'Only '+cap+' '+(it.unit||'')+' in the yard — already in the list.':'Only '+cap+' '+(it.unit||'')+' out on jobs — already in the list.');try{navigator.vibrate&&navigator.vibrate([60,60,60])}catch(e){}return true}c.n++}else cart.push({id:it.id,n:1})}
  c=cart.find(x=>x.id===it.id);renderCartBar();renderYard();
  toast(`${ACTNAME[act]} · ${it.name}${sn?' '+sn:''}${!sn&&c.n>1?' ×'+c.n:''} — ${cart.length} item${cart.length>1?'s':''} in list. Scan the next one, or tap Review.`);return true}
function preview(r,fromCam){const it=r.it;const units=Array.isArray(it.serials)?it.serials:[];const unitMode=!!r.unit;let n=1;const max=act==='OUT'?Math.max(0,Number(it.qty)||0):act==='RETURN'?Math.max(1,Number(it.out)||0):9999;
  const draw=()=>{document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg scdlg"><div class="scmode">${esc(ACTNAME[act]||act)}</div>
   <div class="scrow"><span class="scpic">${pic(it)}</span><div><h3 style="margin:0">${esc(it.name)}</h3><div class="muted">${esc([it.size,it.mfgr].filter(Boolean).join(' · '))}</div>
   <div class="scmeta"><b>${esc(it.loc||'')} ${esc(it.level||'')}</b> · ${esc(String(it.qty??''))} ${esc(it.unit||'')} in yard${unitMode?` · <b>Unit ${esc(r.unit)}</b>`:''}</div><div class="muted" style="font-size:12px">Tag ${esc(r.tag)}</div></div></div>
   ${unitMode?'':`<div class="scqty"><span>Quantity</span><div class="step"><button data-sq="-1">−</button><input id="scN" inputmode="numeric" value="${n}"><button data-sq="1">+</button></div><span class="muted">${esc(it.unit||'')}</span></div>`}
   <div class="bar"><button class="btn" id="scInfo">Details</button><button class="btn" id="scX">Cancel</button>${fromCam?'<button class="btn" id="scNext">Add &amp; scan next</button>':''}<button class="go" id="scOk" style="width:auto">Add to ${esc(ACTNAME[act]||'cart')}</button></div></div></div>`;
   document.querySelectorAll('[data-sq]').forEach(b=>b.onclick=()=>{n=Math.max(1,Math.min(max||9999,n+ +b.dataset.sq));draw()});
   const ni=document.getElementById('scN');if(ni)ni.onchange=()=>{n=Math.max(1,parseInt(ni.value)||1);if(act==='OUT'&&max&&n>max){n=max;toast('Only '+max+' in the yard')}draw()};
   document.getElementById('scX').onclick=closeDlg;document.getElementById('scInfo').onclick=()=>openItem(it.id);
   const add=()=>{if(act==='OUT'&&!unitMode&&!max){toast('None left in the yard.');return false}const c=cart.find(x=>x.id===it.id);
     if(unitMode){if(c){c.units=[...new Set([...(c.units||[]),r.unit])];c.n=c.units.length}else cart.push({id:it.id,n:1,units:[r.unit]})}
     else if(c){c.n=max?Math.min(max,c.n+n):c.n+n}else cart.push({id:it.id,n:Math.min(n,max||n)});
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

let BDC=null;
async function getBD(){if(BDC)return BDC;
  if('BarcodeDetector' in window){try{const f=await window.BarcodeDetector.getSupportedFormats();if(f&&f.length>3){BDC=window.BarcodeDetector;return BDC}}catch(e){}}
  const m=await import('https://cdn.jsdelivr.net/npm/barcode-detector@3.1.3/dist/es/ponyfill.min.js');BDC=m.BarcodeDetector;return BDC}
let OCR=null;
function getOCR(){if(OCR)return OCR;OCR=(async()=>{if(!window.Tesseract){await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=ok;s.onerror=()=>no(new Error('text reader did not load'));document.head.appendChild(s)})}
  toast('Getting the text reader ready (first time only)…');const w=await Tesseract.createWorker('eng');await w.setParameters({tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/:.# ',tessedit_pageseg_mode:'6'});return w})().catch(e=>{OCR=null;throw e});return OCR}
function serialsFrom(text){const T=String(text).toUpperCase().replace(/[|]/g,'I');const out=[];const add=v=>{v=v.replace(/^[-:.#\/]+|[-:.#\/]+$/g,'');if(v.length>=5&&v.length<=24&&/\d/.test(v)&&!out.includes(v))out.push(v)};
  const lab=/(?:S\s*\/\s*N|\bSN|SER(?:IAL)?\.?\s*(?:NO|NUM(?:BER)?|#)?)\s*[.:#]?\s*([A-Z0-9][A-Z0-9\-\/ ]{3,32})/g;let m;while((m=lab.exec(T)))add(m[1].trim().split(/\s{2,}/)[0].replace(/ /g,''));
  if(!out.length){const bad=/^(\d{1,3}(V|W|A|HZ|MAH|AH|LB|LBS|IN|MM|PSI|RPM)|MADEIN.*|\d{1,2}\/\d{1,2}\/\d{2,4})$/;(T.match(/[A-Z0-9][A-Z0-9\-]{4,23}/g)||[]).forEach(t=>{if(bad.test(t))return;if(/[A-Z]/.test(t)&&/\d/.test(t)||/^\d{6,}$/.test(t))add(t)})}
  return out.slice(0,3)}
window.__serialsFrom=serialsFrom;
async function openCam(cb){cb=typeof cb==='function'?cb:null;let BD;
  try{BD=await getBD()}catch(e){return openCamOld(cb)}
  const o=document.createElement('div');o.id='camOv';o.innerHTML=`<div class="camhd"><b>Scan barcode / QR</b><span class="camact" id="camAct">${cb?'Assign to item':esc(ACTNAME[act]||'')}</span><button class="btn" id="camT" hidden>Light</button><button class="btn${cb?'':' pri'}" id="camX">${cb?'Close':'Done'}</button></div><div class="camseg2"><button type="button" data-cm2="bar" aria-pressed="true">Barcode / QR</button><button type="button" data-cm2="txt" aria-pressed="false">Serial # (text)</button></div>${cb?'':'<div class="camlist" id="camList"></div>'}
   <div id="camWrap" class="cv2"><div class="camtbox" hidden><span>Line up only the serial number here</span></div><button type="button" class="camread" id="camRead" hidden>Read serial</button><div class="campick" id="camPick" hidden></div><video id="camV" playsinline muted autoplay></video><canvas id="camC"></canvas><div class="camfr"><i></i><i></i><i></i><i></i><div class="camln"></div></div><p class="camhint" id="camH">Point at a barcode or QR — anywhere in view</p></div>
   <div class="camft"><input id="camType" class="search" placeholder="…or type the tag number"><button class="btn pri" id="camGo">Go</button></div>`;document.body.appendChild(o);
  const V=o.querySelector('#camV'),C=o.querySelector('#camC'),X=C.getContext('2d'),W=o.querySelector('#camWrap'),H=o.querySelector('#camH');
  let done=false,stream=null,torch=false,last='',hits=0,raf=0,busy=false,lost=0;
  const close=()=>{done=true;cancelAnimationFrame(raf);try{stream&&stream.getTracks().forEach(t=>t.stop())}catch(e){}o.remove()};
  let paused=false,lastCode='',lastAt=0,tmode=false;
  const setMode=m=>{tmode=m==='txt';o.querySelectorAll('[data-cm2]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.cm2===m));W.classList.toggle('txt',tmode);o.querySelector('.camtbox').hidden=!tmode;o.querySelector('#camRead').hidden=!tmode;o.querySelector('#camPick').hidden=true;
    paused=tmode;try{draw(null)}catch(e){}H.textContent=tmode?'Fit just the serial number in the box, hold still, tap Read':'Point at a barcode or QR — anywhere in view';if(!tmode){hits=0;last=''}};
  o.querySelectorAll('[data-cm2]').forEach(b=>b.onclick=()=>setMode(b.dataset.cm2));
  o.querySelector('#camRead').onclick=async()=>{const rb=o.querySelector('#camRead');rb.disabled=true;rb.textContent='Reading…';
    try{const T=await getOCR();const box=o.querySelector('.camtbox').getBoundingClientRect(),wr=W.getBoundingClientRect();const m=map();
      const sx=(box.left-wr.left-m.ox)/m.k,sy=(box.top-wr.top-m.oy)/m.k,sw=box.width/m.k,sh=box.height/m.k;const cv=document.createElement('canvas');const up=Math.max(1,Math.min(3,1200/sw));cv.width=Math.round(sw*up);cv.height=Math.round(sh*up);
      const cx=cv.getContext('2d');cx.filter='grayscale(1) contrast(1.6)';cx.drawImage(V,sx,sy,sw,sh,0,0,cv.width,cv.height);
      const r=await T.recognize(cv);showPick(serialsFrom(r.data.text||''),r.data.text||'')}catch(e){toast('Could not read text — '+(e.message||'check the connection'))}finally{rb.disabled=false;rb.textContent='Read serial'}};
  const showPick=(cands,raw)=>{const P=o.querySelector('#camPick');P.hidden=false;try{navigator.vibrate&&navigator.vibrate(40)}catch(e){}
    P.innerHTML=`<b>${cands.length?'Serial number found':'No serial found'}</b>${cands.length>1?'<small>Tap the right one</small>':''}<div class="cpk">${cands.map((c,i)=>`<button type="button" data-sv="${esc(c)}" aria-pressed="${i===0}">${esc(c)}</button>`).join('')}</div>
     <input id="camSv" value="${esc(cands[0]||'')}" placeholder="Type or fix the serial" autocapitalize="characters"><div class="cpb"><button type="button" class="btn" id="camRe">Retake</button><button type="button" class="btn pri" id="camUse">Use this</button></div>${raw&&!cands.length?`<small class="muted">Read: ${esc(raw.replace(/\s+/g,' ').slice(0,80))}</small>`:''}`;
    P.querySelectorAll('[data-sv]').forEach(b=>b.onclick=()=>{P.querySelector('#camSv').value=b.dataset.sv;P.querySelectorAll('[data-sv]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
    P.querySelector('#camRe').onclick=()=>{P.hidden=true};
    P.querySelector('#camUse').onclick=()=>{const v=P.querySelector('#camSv').value.trim().toUpperCase();if(!v){toast('Type the serial');return}P.hidden=true;
      if(cb){close();cb(v);return}onCode(v,true);const dlg=()=>!!document.querySelector('#dlgRoot .dlg');if(dlg()){o.style.display='none';const iv=setInterval(()=>{if(!dlg()){clearInterval(iv);if(done)return;o.style.display='';showList()}},300)}else showList()}};
  const showList=()=>{const L=o.querySelector('#camList');if(!L)return;const a=o.querySelector('#camAct');if(a)a.textContent=ACTNAME[act]||'';
    L.innerHTML=cart.length?`<b>${cart.length} item${cart.length>1?'s':''} · ${esc(ACTNAME[act]||'')}</b>`+cart.slice(-3).reverse().map(c=>{const i=byId(c.id)||{};return `<span>${esc(i.name||c.id)}${c.units&&c.units.length?' '+esc(c.units.join(', ')):c.n>1?' ×'+c.n:''}</span>`}).join(''):'<span>Scan items one after another — they go into the list.</span>'};
  const finish=t=>{if(done||paused)return;if(cb){done=true;W.classList.add('ok');try{navigator.vibrate&&navigator.vibrate(60)}catch(e){}setTimeout(()=>{close();cb(t)},260);return}
    if(t===lastCode&&Date.now()-lastAt<2500)return;lastCode=t;lastAt=Date.now();W.classList.add('ok');try{navigator.vibrate&&navigator.vibrate(60)}catch(e){}
    paused=true;setTimeout(()=>{W.classList.remove('ok','lock');hits=0;last='';draw(null);onCode(t,true);
      const dlg=()=>!!document.querySelector('#dlgRoot .dlg');if(dlg()){o.style.display='none';const iv=setInterval(()=>{if(!dlg()){clearInterval(iv);if(done)return;o.style.display='';paused=false;showList()}},300)}else{paused=false;showList()}},350)};
  setTimeout(showList,0);
  o.querySelector('#camX').onclick=()=>{close();if(!cb&&cart.length){try{renderCartBar();renderYard()}catch(e){}}};
  const go=()=>{const v=o.querySelector('#camType').value.trim();if(v){close();cb?cb(v):onCode(v,true)}};o.querySelector('#camGo').onclick=go;o.querySelector('#camType').onkeydown=e=>{if(e.key==='Enter')go()};
  let det;try{det=new BD({formats:['code_128','code_39','code_93','ean_13','ean_8','upc_a','upc_e','itf','codabar','qr_code','data_matrix']})}catch(e){det=new BD()}
  try{stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});if(done){close();return}V.srcObject=stream;await V.play()}
  catch(e){W.innerHTML='<p style="padding:20px;color:#fff">Camera not available ('+esc(e.message||e)+'). Allow camera access for this site, or type the tag number below.</p>';return}
  const tr=stream.getVideoTracks()[0];try{const c=tr.getCapabilities&&tr.getCapabilities();if(c&&c.torch)o.querySelector('#camT').hidden=false;if(c&&c.focusMode&&c.focusMode.includes('continuous'))tr.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(()=>{})}catch(e){}
  o.querySelector('#camT').onclick=async()=>{torch=!torch;try{await tr.applyConstraints({advanced:[{torch}]})}catch(e){}};
  // map video pixel coords -> overlay (video uses object-fit:cover)
  const map=()=>{const vw=V.videoWidth,vh=V.videoHeight,ew=W.clientWidth,eh=W.clientHeight;const k=Math.max(ew/vw,eh/vh);return {k,ox:(ew-vw*k)/2,oy:(eh-vh*k)/2,ew,eh}};
  const draw=(pts,good)=>{const m=map();if(C.width!==m.ew||C.height!==m.eh){C.width=m.ew;C.height=m.eh}X.clearRect(0,0,C.width,C.height);if(!pts)return;
    const P=pts.map(p=>[p.x*m.k+m.ox,p.y*m.k+m.oy]);X.lineWidth=4;X.strokeStyle=good?'#3ddc84':'#ffb000';X.fillStyle=good?'rgba(61,220,132,.18)':'rgba(255,176,0,.15)';X.lineJoin='round';
    X.beginPath();P.forEach((p,i)=>i?X.lineTo(p[0],p[1]):X.moveTo(p[0],p[1]));X.closePath();X.fill();X.stroke()};
  const loop=async()=>{if(done)return;raf=requestAnimationFrame(loop);if(paused||busy||V.readyState<2)return;busy=true;
    try{const r=await det.detect(V);if(done)return;
      if(r&&r.length){const m=map();const cx=m.ew/2,cy=m.eh/2;
        // pick code closest to center when several are visible
        r.sort((a,b)=>{const d=x=>{const p=x.cornerPoints&&x.cornerPoints.length?x.cornerPoints:[{x:x.boundingBox.x,y:x.boundingBox.y}];const ax=p.reduce((s,q)=>s+q.x,0)/p.length*m.k+m.ox,ay=p.reduce((s,q)=>s+q.y,0)/p.length*m.k+m.oy;return (ax-cx)**2+(ay-cy)**2};return d(a)-d(b)});
        const b=r[0];const pts=b.cornerPoints&&b.cornerPoints.length?b.cornerPoints:[{x:b.boundingBox.x,y:b.boundingBox.y},{x:b.boundingBox.x+b.boundingBox.width,y:b.boundingBox.y},{x:b.boundingBox.x+b.boundingBox.width,y:b.boundingBox.y+b.boundingBox.height},{x:b.boundingBox.x,y:b.boundingBox.y+b.boundingBox.height}];
        lost=0;if(b.rawValue===last)hits++;else{last=b.rawValue;hits=1}W.classList.add('lock');H.textContent=hits>=2?b.rawValue:'Reading…';draw(pts,hits>=2);if(hits>=2)finish(b.rawValue)}
      else{if(++lost>6){W.classList.remove('lock');H.textContent='Point at a barcode or QR — anywhere in view';draw(null);hits=0;last=''}}}
    catch(e){}finally{busy=false}};
  loop()}
let camMode='bar';
async function openCamOld(cb){cb=typeof cb==='function'?cb:null;try{if(!window.Html5Qrcode){await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)})}}catch(e){toast('Scanner did not load — check the connection.');return}
  const o=document.createElement('div');o.id='camOv';o.innerHTML=`<div class="camhd"><b>Scan barcode / QR</b><span class="camact">${cb?'Assign to item':esc(ACTNAME[act]||'')}</span><button class="btn" id="camX">Close</button></div>
   <div class="camseg"><button data-cm="bar">Barcode</button><button data-cm="qr">QR code</button><button id="camT" hidden>Light</button></div>
   <div id="camWrap"><div id="camBox"></div><p class="camhint">Hold steady — fit the code inside the box</p></div>
   <div class="camft"><input id="camType" class="search" placeholder="…or type the tag number"><button class="btn pri" id="camGo">Go</button></div>`;document.body.appendChild(o);
  let done=false,q=null,torch=false;const box=(vw,vh)=>{const m=Math.min(vw,vh);return camMode==='qr'?{width:m*0.7|0,height:m*0.7|0}:{width:Math.min(vw*0.9,vh*1.6)|0,height:Math.max(80,Math.min(vh*0.35,vw*0.4))|0}};
  const sizeFrame=()=>{o.querySelectorAll('[data-cm]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.cm===camMode))};
  const stopQ=async()=>{if(q){try{await q.stop()}catch(e){}try{q.clear()}catch(e){}q=null}};
  const close=async()=>{done=true;await stopQ();o.remove()};
  const start=async()=>{await stopQ();sizeFrame();const F=Html5QrcodeSupportedFormats;const fm=camMode==='qr'?[F.QR_CODE,F.DATA_MATRIX]:[F.CODE_128,F.CODE_39,F.CODE_93,F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E,F.ITF,F.CODABAR,F.QR_CODE];q=new Html5Qrcode('camBox',{verbose:false,formatsToSupport:fm,experimentalFeatures:{useBarCodeDetectorIfSupported:true}});
    try{await q.start({facingMode:'environment'},{fps:15,qrbox:box,disableFlip:true,videoConstraints:{facingMode:'environment',width:{ideal:1920},height:{ideal:1080},focusMode:'continuous'}},txt=>{if(done)return;done=true;close().then(()=>cb?cb(txt):onCode(txt,true))},()=>{});
      try{const c=q.getRunningTrackCapabilities&&q.getRunningTrackCapabilities();if(c&&c.torch)o.querySelector('#camT').hidden=false}catch(e){}}
    catch(e){o.querySelector('#camBox').innerHTML='<p style="padding:20px;color:#fff">Camera not available ('+esc(e.message||e)+'). Allow camera access for this site, or type the tag number below.</p>'}};
  o.querySelectorAll('[data-cm]').forEach(x=>x.onclick=()=>{camMode=x.dataset.cm;start()});
  o.querySelector('#camT').onclick=async()=>{torch=!torch;try{await q.applyVideoConstraints({advanced:[{torch}]})}catch(e){}};
  document.getElementById('camX').onclick=close;const go=()=>{const v=document.getElementById('camType').value.trim();if(v){close().then(()=>cb?cb(v):onCode(v,true))}};document.getElementById('camGo').onclick=go;document.getElementById('camType').onkeydown=e=>{if(e.key==='Enter')go()};
  start()}
window.ameScan=openCam;
/* ---------- assign codes from the item dialog ---------- */
function tagsOf(id){return Object.entries(TAGS).filter(([k,t])=>t.itemId===id).map(([k,t])=>({k,code:t.code||k,unit:t.unit||''}))}
async function assign(code,it,unit){code=String(code||'').trim();if(!code)return;const k=key(code);const ex=TAGS[k];
  if(ex&&ex.itemId&&ex.itemId!==it.id){const o=byId(ex.itemId);if(!confirm('Code '+code+' is already on “'+(o?o.name:ex.itemId)+'”. Move it to “'+it.name+'”?'))return}
  await db.doc('tags/'+k).set({code,itemId:it.id,unit:unit||'',at:new Date().toISOString(),by:curUser});TAGS[k]={code,itemId:it.id,unit:unit||''};toast('Code '+code+' → '+it.name+(unit?' '+unit:''))}
function tagBox(dlg){const id=dlg.dataset.item;const it=id&&byId(id);if(!it||dlg.querySelector('.tagbox'))return;const bar=dlg.querySelector('.bar');const ed=canReg();
  const box=document.createElement('div');box.className='tagbox';const units=Array.isArray(it.serials)?it.serials:[];
  const draw=()=>{const l=tagsOf(id);box.innerHTML=`<div class="qlabel">Barcode / QR codes</div>${l.length?`<div class="tagl">${l.map(t=>`<span class="tagc"><b>${esc(t.code)}</b>${t.unit?`<small>${esc(t.unit)}</small>`:''}${ed?`<button type="button" data-tdel="${esc(t.k)}" title="Remove">×</button>`:''}</span>`).join('')}</div>`:'<p class="muted" style="margin:4px 0">No code assigned yet.</p>'}
   ${ed?`<div class="tagadd">${units.length?`<select id="tgU"><option value="">Whole item</option>${units.map(u=>`<option>${esc(u)}</option>`).join('')}</select>`:''}<input id="tgIn" placeholder="Type or scan a code"><button type="button" class="btn" id="tgAdd">Add</button><button type="button" class="btn pri" id="tgScan">Scan</button></div>`:''}`;
   box.querySelectorAll('[data-tdel]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this code from the item?'))return;await db.doc('tags/'+b.dataset.tdel).delete();delete TAGS[b.dataset.tdel];draw()});
   const u=()=>box.querySelector('#tgU')?.value||'';const inp=box.querySelector('#tgIn');
   if(inp){const add=async()=>{await assign(inp.value,it,u());inp.value='';draw()};box.querySelector('#tgAdd').onclick=add;inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();add()}};
     box.querySelector('#tgScan').onclick=()=>{const uu=u();openCam(async c=>{await assign(c,it,uu);draw()})}}};
  draw();if(bar)bar.parentNode.insertBefore(box,bar);else dlg.appendChild(box)}
new MutationObserver(()=>{const d=document.querySelector('#dlgRoot .dlg[data-item]');if(d&&d.dataset.item)tagBox(d)}).observe(document.getElementById('dlgRoot'),{childList:true,subtree:true});window.ameScanCode=onCode;
/* ---------- Bluetooth scanner (types fast + Enter) ---------- */
let buf='',last=0;document.addEventListener('keydown',e=>{const t=e.target;const typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)&&t.id!=='ysearch';const now=Date.now();
  if(e.key==='Enter'){if(buf.length>=3&&now-last<120&&!typing){e.preventDefault();const c=buf;buf='';if(t&&t.id==='ysearch'){t.value='';try{renderYard()}catch(_){}}onCode(c,false);return}buf='';return}
  if(e.key.length===1){if(now-last>80)buf='';buf+=e.key;last=now}},true);
/* ---------- button ---------- */
const row=document.querySelector('.ysrow');if(row){const b=document.createElement('button');b.type='button';b.className='btn scanbtn';b.title='Scan a tag with the camera';b.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/></svg><span>Scan code</span>';b.onclick=openCam;row.insertBefore(b,row.children[1])}
document.head.insertAdjacentHTML('beforeend',`<style>.camseg2{display:flex;gap:6px;padding:6px 14px;background:#2b2724}.camseg2 button{flex:1;height:38px;border-radius:10px;border:1px solid #5a514a;background:none;color:#f3ede6;font-weight:700}.camseg2 button[aria-pressed=true]{background:#f26a1b;color:#111;border-color:transparent}.cv2.txt .camfr,.cv2.txt canvas{display:none}.camtbox{position:absolute;left:6%;right:6%;top:40%;height:16%;border:3px solid #3ddc84;border-radius:10px;box-shadow:0 0 0 9999px rgba(0,0,0,.45);z-index:2;pointer-events:none}.camtbox span{position:absolute;top:-30px;left:0;right:0;text-align:center;color:#fff;font-weight:700;font-size:13px;text-shadow:0 1px 3px #000}.camread{position:absolute;left:50%;bottom:56px;transform:translateX(-50%);z-index:3;height:52px;padding:0 28px;border-radius:26px;border:0;background:#3ddc84;color:#082;font-weight:800;font-size:17px}.campick{position:absolute;left:10px;right:10px;bottom:10px;z-index:4;background:#2b2724;color:#f3ede6;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.5)}.campick[hidden]{display:none}.campick .cpk{display:flex;flex-wrap:wrap;gap:6px}.campick .cpk button{font:700 16px var(--mono,monospace);padding:8px 10px;border-radius:8px;border:1px solid #5a514a;background:none;color:inherit}.campick .cpk button[aria-pressed=true]{border-color:#3ddc84;box-shadow:0 0 0 2px #3ddc84}.campick input{font:700 18px var(--mono,monospace);padding:10px;border-radius:8px;border:1px solid #5a514a;background:#1e1b19;color:#fff;text-transform:uppercase}.campick .cpb{display:flex;gap:8px}.campick .cpb .btn{flex:1}.camlist{background:#2b2724;color:#f3ede6;padding:6px 14px 8px;display:flex;flex-direction:column;gap:2px;font-size:13px}.camlist b{color:#f6a04d}.camlist span{opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cv2{position:relative;flex:1;overflow:hidden;background:#000}.cv2 video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.cv2 canvas{position:absolute;inset:0;pointer-events:none}.camfr{position:absolute;left:8%;right:8%;top:28%;bottom:28%;pointer-events:none}.camfr i{position:absolute;width:34px;height:34px;border:4px solid #fff;transition:border-color .15s,transform .15s}.camfr i:nth-child(1){left:0;top:0;border-right:0;border-bottom:0;border-radius:10px 0 0 0}.camfr i:nth-child(2){right:0;top:0;border-left:0;border-bottom:0;border-radius:0 10px 0 0}.camfr i:nth-child(3){left:0;bottom:0;border-right:0;border-top:0;border-radius:0 0 0 10px}.camfr i:nth-child(4){right:0;bottom:0;border-left:0;border-top:0;border-radius:0 0 10px 0}.camln{position:absolute;left:4%;right:4%;height:2px;background:#f26a1b;box-shadow:0 0 12px 2px #f26a1b;animation:camln 1.6s ease-in-out infinite alternate;top:0}@keyframes camln{to{top:100%}}.cv2.lock .camfr i{border-color:#ffb000}.cv2.lock .camln{background:#ffb000;box-shadow:0 0 12px 2px #ffb000}.cv2.ok .camfr i{border-color:#3ddc84;transform:scale(1.06)}.cv2.ok .camln{display:none}.cv2 .camhint{position:absolute;left:0;right:0;bottom:14px;text-align:center;color:#fff;text-shadow:0 1px 3px #000;font-weight:600;margin:0}.scanbtn{display:inline-flex;align-items:center;gap:6px;font-weight:700;flex:none}#camOv{position:fixed;inset:0;z-index:100000;background:#000;display:flex;flex-direction:column}.camhd,.camft{display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;background:#2b2724;color:#f3ede6}.camhd b{flex:0 0 auto;font-size:17px}.camhd .muted{flex:1}.camft{padding:10px 14px calc(14px + env(safe-area-inset-bottom,0px))}.camft input{flex:1}#camWrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;background:#000}#camBox{width:100%;max-width:640px}#camBox video{width:100%!important;height:auto!important;display:block}#camBox #qr-shaded-region{border-color:rgba(0,0,0,.5)!important}#camBox #qr-shaded-region>div{background:#c8742c!important}.camhint{color:#fff;font-weight:600;text-align:center;margin:12px 0 0}.camseg{display:flex;gap:8px;justify-content:center;padding:8px;background:#2b2724}.camseg button{border:1px solid #6b625a;background:#3a3430;color:#f3ede6;border-radius:18px;padding:7px 16px;font:600 14px system-ui}.camseg button[aria-pressed=true]{background:#c8742c;border-color:#c8742c}.camact{flex:1;color:#c8742c;font-weight:700}.scdlg .scmode{display:inline-block;background:var(--hi);color:var(--hi-ink);font-weight:700;border-radius:8px;padding:3px 10px;margin-bottom:10px;font-size:13px}.scrow{display:flex;gap:14px;align-items:center;margin:6px 0 12px}.scpic{width:96px;height:96px;flex:none;border-radius:10px;overflow:hidden;display:block}.scpic img,.scpic .ph{width:100%;height:100%;object-fit:cover}.scpic .ph .pbig{font-size:18px}.scmeta{margin-top:6px}.scqty{display:flex;align-items:center;gap:12px;margin:8px 0}.scqty input{width:64px;text-align:center}.tagbox{margin:14px 0 4px;padding-top:10px;border-top:1px solid var(--line)}.tagl{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.tagc{display:inline-flex;align-items:center;gap:6px;padding:5px 6px 5px 10px;border:1px solid var(--line);border-radius:8px;background:var(--chip);font-family:var(--mono)}.tagc small{opacity:.7}.tagc button{background:none;border:0;color:inherit;font-size:18px;cursor:pointer;padding:0 4px}.tagadd{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.tagadd input{flex:1;min-width:140px}</style>`);
})();
