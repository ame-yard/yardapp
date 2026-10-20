/* AME Labels — make numbered QR / barcode tags (e.g. BP-1 Battery Pack), register them so a scan opens the item, download PNGs for the printer */
(function(){
const sec=(()=>{let s=document.getElementById('tab-labels');if(!s){s=document.createElement('section');s.id='tab-labels';s.hidden=true;(document.querySelector('main')||document.body).appendChild(s)}return s})();
const key=c=>String(c).trim().replace(/[\/\\#?%]/g,'_').slice(0,120);
let SEQ={},LOG=[],libs=null,fmt=(()=>{try{return localStorage.getItem('lblFmt')||'qr'}catch(e){return 'qr'}})(),made=[],lastPrefix='',lastDesc='';
(function w(){if(typeof db!=='undefined'&&db&&db.doc){db.doc('config/labels').onSnapshot(s=>{const d=s.data()||{};SEQ=d.seq||{};LOG=d.log||[];if(AME.cur==='labels'&&!made.length)render()},()=>{})}else setTimeout(w,400)})();
function loadLibs(){if(libs)return libs;const add=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)});
  const any=(...u)=>u.reduce((p,x)=>p.catch(()=>add(x)),Promise.reject());libs=Promise.all([window.qrcode?1:any('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js','https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'),window.JsBarcode?1:any('https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js','https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js')]).catch(e=>{libs=null;throw e});return libs}
const canMake=()=>typeof isAdmin!=='undefined'&&(isAdmin||(typeof can==='function'&&can('UNITS')));
const ICO=(p,w=20)=>`<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px">${p}</svg>`;
const I_DL='<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',I_PR='<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>';

/* draw one label to a canvas: code graphic + big code text + small description */
function drawLabel(code,desc,kind){const W=kind==='qr'?600:900,H=kind==='qr'?760:420;const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#000';
  if(kind==='qr'){const q=qrcode(0,'M');q.addData(code);q.make();const n=q.getModuleCount(),sz=Math.floor(520/(n+2)),off=(W-sz*n)/2;for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))x.fillRect(off+k*sz,30+r*sz,sz,sz);
    x.textAlign='center';x.font='bold 64px Arial';x.fillText(code,W/2,30+sz*n+80);if(desc){x.font='32px Arial';x.fillText(desc.slice(0,28),W/2,30+sz*n+125)}}
  else{const t=document.createElement('canvas');JsBarcode(t,code,{format:'CODE128',width:4,height:220,displayValue:false,margin:0});const s=Math.min(1,(W-60)/t.width);x.drawImage(t,(W-t.width*s)/2,30,t.width*s,220);
    x.textAlign='center';x.font='bold 64px Arial';x.fillText(code,W/2,330);if(desc){x.font='30px Arial';x.fillText(desc.slice(0,40),W/2,385)}}
  return c}
const dl=(c,name)=>new Promise(r=>c.toBlob(async b=>{try{const d=await window.claude.use('downloads');await d.save({filename:name,data:b})}catch(e){const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()}r()},'image/png'));

function render(){if(!sec)return;const items0=typeof items!=='undefined'?items:[];
  const prefixes=Object.keys(SEQ).sort();
  sec.innerHTML=`<div class="mplhead"><h2>Labels</h2></div>
  <div class="panel lbl-form">${canMake()?`
   <div class="fields">
    <label class="f">Code prefix<input id="lbP" placeholder="e.g. BP" value="${esc(lastPrefix)}" autocomplete="off" list="lbPl" style="text-transform:uppercase"></label><datalist id="lbPl">${prefixes.map(p=>`<option value="${esc(p)}">`).join('')}</datalist>
    <label class="f">What is it?<input id="lbD" placeholder="e.g. Battery Pack" value="${esc(lastDesc)}"></label>
    <label class="f">How many labels<input id="lbN" type="number" min="1" max="200" value="1" inputmode="numeric"></label>
    <label class="f">Link to yard item (optional)<input id="lbI" list="lbIl" placeholder="Search item…" autocomplete="off"></label><datalist id="lbIl">${items0.map(i=>`<option value="${esc(i.name+(i.size&&i.size!=='-'?' · '+i.size:'')+' · '+(i.loc||''))}">`).join('')}</datalist>
   </div>
   <div class="lbl-row"><span class="muted" id="lbNext"></span></div>
   <div class="lbl-row"><div class="viewseg"><button data-fmt="qr" aria-pressed="${fmt==='qr'}">QR code</button><button data-fmt="bar" aria-pressed="${fmt==='bar'}">Barcode</button></div>
    <label class="lbl-chk"><input type="checkbox" id="lbU" checked> Each label is its own unit (adds the numbers to the item)</label></div>
   <div class="bar" style="justify-content:flex-start"><button class="go" id="lbGo" style="width:auto">Create labels</button></div>`:'<p class="muted">Only editors can make new labels.</p>'}
  </div>
  <div id="lbOut">${made.length?outHtml():''}</div>
  ${LOG.length?`<h3 style="margin-top:22px">Made before</h3><div class="tblwrap"><table><thead><tr><th>Codes</th><th>What</th><th>Item</th><th>When</th><th></th></tr></thead><tbody>${LOG.slice(0,40).map((g,k)=>`<tr><td class="mono"><b>${esc(g.from)}${g.to!==g.from?' – '+esc(g.to):''}</b></td><td>${esc(g.desc||'')}</td><td>${esc(g.item||'—')}</td><td><small>${esc(fmtD(g.at))} · ${esc(g.by||'')}</small></td><td><button class="btn small" data-again="${k}">${ICO(I_DL,16)} Again</button></td></tr>`).join('')}</tbody></table></div>`:''}`;
  sec.querySelectorAll('[data-fmt]').forEach(b=>b.onclick=()=>{fmt=b.dataset.fmt;try{localStorage.setItem('lblFmt',fmt)}catch(e){}sec.querySelectorAll('[data-fmt]').forEach(x=>x.setAttribute('aria-pressed',x===b));if(made.length)drawOut()});
  const P=sec.querySelector('#lbP');if(P){const nx=()=>{const p=P.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');const n=Math.max(1,Math.min(200,parseInt(sec.querySelector('#lbN').value)||1));const s=(SEQ[p]||0)+1;sec.querySelector('#lbNext').innerHTML=p?`Will make <b class="mono">${p}-${s}</b>${n>1?` to <b class="mono">${p}-${s+n-1}</b>`:''}`:'Type a short prefix — the number is added for you.'};
    P.oninput=nx;sec.querySelector('#lbN').oninput=nx;nx();sec.querySelector('#lbGo').onclick=create}
  sec.querySelectorAll('[data-again]').forEach(b=>b.onclick=()=>{const g=LOG[+b.dataset.again];made=g.codes.map(c=>({code:c,desc:g.desc}));drawOut()});
  if(made.length)drawOut()}
function outHtml(){return `<div class="panel"><div class="lbl-row"><b>${made.length} label${made.length>1?'s':''} ready</b><button class="btn pri" id="lbAll">${ICO(I_DL)} Download ${made.length>1?'all (PNG)':'PNG'}</button><button class="btn" id="lbPrint">${ICO(I_PR)} Print sheet</button><button class="btn" id="lbClose">Done</button></div><p class="muted" style="margin:4px 0 10px">Send the PNG to the label printer app, or print the sheet. Scanning any of these opens the item in Yard.</p><div class="lbl-grid" id="lbGrid"></div></div>`}
async function drawOut(){const o=sec.querySelector('#lbOut');if(!o)return;o.innerHTML=outHtml();try{await loadLibs()}catch(e){toast('Could not load the barcode maker — check the connection.');return}
  const g=o.querySelector('#lbGrid');made.forEach(m=>{const c=drawLabel(m.code,m.desc,fmt);c.className='lbl-img';const w=document.createElement('div');w.className='lbl-card';w.appendChild(c);const b=document.createElement('button');b.className='btn small';b.innerHTML=ICO(I_DL,16)+' PNG';b.onclick=()=>dl(c,m.code+'.png');w.appendChild(b);g.appendChild(w)});
  o.querySelector('#lbAll').onclick=async()=>{for(const m of made){await dl(drawLabel(m.code,m.desc,fmt),m.code+'.png');await new Promise(r=>setTimeout(r,250))}};
  o.querySelector('#lbPrint').onclick=()=>{const imgs=made.map(m=>`<div style="break-inside:avoid;display:inline-block;width:${fmt==='qr'?'1.6in':'2.6in'};margin:.12in;text-align:center"><img style="width:100%" src="${drawLabel(m.code,m.desc,fmt).toDataURL()}"></div>`).join('');const w=window.open('','_blank');if(!w){toast('Allow pop-ups to print');return}w.document.write(`<html><head><title>Labels</title></head><body style="margin:.3in">${imgs}<script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);w.document.close()};
  o.querySelector('#lbClose').onclick=()=>{made=[];render()}}
async function create(){const p=sec.querySelector('#lbP').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');const desc=sec.querySelector('#lbD').value.trim();const n=Math.max(1,Math.min(200,parseInt(sec.querySelector('#lbN').value)||1));
  if(!p){toast('Type a prefix, e.g. BP');return}const iv=sec.querySelector('#lbI').value.trim();const items0=typeof items!=='undefined'?items:[];const it=iv?items0.find(i=>(i.name+(i.size&&i.size!=='-'?' · '+i.size:'')+' · '+(i.loc||''))===iv):null;
  if(iv&&!it){toast('Pick the item from the list (or leave it empty).');return}const asUnits=!!sec.querySelector('#lbU')?.checked&&!!it;
  const btn=sec.querySelector('#lbGo');btn.disabled=true;btn.textContent='Creating…';
  try{const now=new Date().toISOString();let start=(SEQ[p]||0)+1;
    const cur=(await db.doc('config/labels').get()).data()||{};const seq={...(cur.seq||{})};start=(seq[p]||0)+1;seq[p]=start+n-1;
    const codes=Array.from({length:n},(_,k)=>p+'-'+(start+k));
    const log=[{from:codes[0],to:codes[codes.length-1],codes,desc,item:it?it.name:'',itemId:it?it.id:'',by:curUser,at:now},...(cur.log||[])].slice(0,300);
    await db.doc('config/labels').set({...cur,seq,log});
    if(it){for(const c of codes)await db.doc('tags/'+key(c)).set({code:c,itemId:it.id,unit:asUnits?c:'',at:now,by:curUser,label:desc});
      if(asUnits){const ser=Array.isArray(it.serials)?it.serials:[];await writeItem(it.id,{serials:[...ser,...codes.filter(c=>!ser.includes(c))],updatedAt:now,updatedBy:curUser})}}
    lastPrefix=p;lastDesc=desc;made=codes.map(c=>({code:c,desc}));render();toast(codes.length+' label'+(codes.length>1?'s':'')+' created'+(it?' and linked to '+it.name:''))}
  catch(e){toast('Could not create: '+(e.message||e));btn.disabled=false;btn.textContent='Create labels'}}
document.head.insertAdjacentHTML('beforeend',`<style>.lbl-form .fields{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}.lbl-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:8px 0}.lbl-chk{display:flex;gap:8px;align-items:center;font-size:14px}
.lbl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}.lbl-card{background:#fff;border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px;align-items:center}.lbl-img{width:100%;height:auto;display:block}.lbl-card .btn{color:#222;border-color:#ccc;background:#f3f3f3}</style>`);
AME.register({id:'labels',name:'Labels',desc:'Make QR / barcode tags · auto numbers · download or print',allow:()=>typeof isAdmin!=='undefined'&&(isAdmin||(typeof can==='function'&&can('UNITS'))),tabs:['labels'],section:'tab-labels',
  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>',
  open:()=>{showTab('labels');render()},onShow:render});
})();
