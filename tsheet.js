/* AME Timesheet Mailer — split the weekly Timesheet Summary PDF (one employee per page) and email each person their own page. Accounting. Desktop web. */
(function(){
const own=()=>typeof isOwner==='function'&&typeof curUser!=='undefined'&&isOwner(curUser);
const mk=id=>{let s=document.getElementById('tab-'+id);if(!s){s=document.createElement('section');s.id='tab-'+id;s.hidden=true;(document.querySelector('main')||document.body).appendChild(s)}return s};
const S=mk('tsm');let STAFF=[],LOG=[],R=null,busy=false;
(function w(){if(typeof db!=='undefined'&&db&&db.collection){db.doc('config/staff').onSnapshot(s=>{STAFF=(s.data&&s.data()||{}).list||[];if(AME.cur==='tsm'&&!busy)render()},()=>{});db.collection('tslog').onSnapshot(s=>{LOG=s.docs.map(d=>({...d.data(),_id:d.id}));if(AME.cur==='tsm'&&!busy)render()},()=>{})}else setTimeout(w,400)})();
const ld=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)});
async function libs(){if(!window.pdfjsLib){await ld('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}
  if(!window.PDFLib)await ld('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');if(!window.JSZip)await ld('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')}
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z]/g,'');
const pad=e=>String(e||'').replace(/\D/g,'').padStart(4,'0');
const mailOf=p=>p?(p.email||p.wemail||''):'';
function findStaff(emp,name){const e=pad(emp);let p=STAFF.find(x=>x.emp&&pad(x.emp)===e);if(p)return {p,how:'Employee #'};
  const n=norm(name);p=STAFF.find(x=>norm(x.name)===n);if(p)return {p,how:'Name'};
  const [f,...r]=String(name).trim().split(/\s+/);const l=r[r.length-1]||'';p=STAFF.find(x=>{const xs=String(x.name||'').trim().split(/\s+/);return norm(xs[xs.length-1])===norm(l)&&norm(xs[0]).slice(0,3)===norm(f).slice(0,3)});return p?{p,how:'Close name'}:{p:null,how:''}}
const b64=u8=>{let s='';const c=0x8000;for(let i=0;i<u8.length;i+=c)s+=String.fromCharCode.apply(null,u8.subarray(i,i+c));return btoa(s)};
const fn=(r,x)=>`Timesheet_${(r.week||'week').replace(/[^\w]+/g,'-').replace(/-+$/,'')}_${x.emp}_${x.name.replace(/[^\w]+/g,'-')}.pdf`;

async function load(file){busy=true;S.querySelector('#tsBody').innerHTML='<p class="muted">Reading the PDF…</p>';
  try{await libs();const buf=new Uint8Array(await file.arrayBuffer());const pdf=await pdfjsLib.getDocument({data:buf.slice()}).promise;const src=await PDFLib.PDFDocument.load(buf);
    const rows=[];let week='';
    for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();const lines=[];let cur='';let lastY=null;tc.items.forEach(t=>{const y=Math.round(t.transform[5]);if(lastY!==null&&Math.abs(y-lastY)>2){lines.push(cur.trim());cur=''}cur+=(cur&&!cur.endsWith(' ')?' ':'')+t.str;lastY=y});lines.push(cur.trim());
      const all=lines.join('\n');if(!week){const m=all.match(/([A-Z][a-z]{2} \d{1,2}(?:st|nd|rd|th)? - [A-Z][a-z]{2} \d{1,2}(?:st|nd|rd|th)?, \d{4})/);if(m)week=m[1].replace(/(\d)(st|nd|rd|th)/g,'$1')}
      const h=lines.map(l=>l.match(/^(\d{4}) - ([A-Za-z][A-Za-z .'\-]+?)$/)).find(Boolean);
      const tot=all.match(/Totals All Hours:\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
      if(!h){rows.push({page:i,skip:true});continue}
      const emp=h[1],name=h[2].trim();const m=findStaff(emp,name);
      rows.push({page:i,emp,name,hours:tot?+tot[1]:null,reg:tot?+tot[2]:null,ot:tot?+tot[3]:null,dt:tot?+tot[4]:null,staff:m.p?m.p.name:'',how:m.how,email:mailOf(m.p),on:!!mailOf(m.p)})}
    R={file:file.name,week,src,rows,pages:pdf.numPages};render()}catch(e){S.querySelector('#tsBody').innerHTML='<p class="muted">Could not read this PDF: '+esc(e.message||e)+'</p>'}busy=false}
async function pagePdf(x){const out=await PDFLib.PDFDocument.create();const [pg]=await out.copyPages(R.src,[x.page-1]);out.addPage(pg);return await out.save()}
async function preview(x){const u=URL.createObjectURL(new Blob([await pagePdf(x)],{type:'application/pdf'}));window.open(u,'_blank')}
async function zipAll(){const z=new JSZip();for(const x of R.rows.filter(r=>!r.skip))z.file(fn(R,x),await pagePdf(x));const blob=await z.generateAsync({type:'blob'});const name=`Timesheets_${(R.week||'week').replace(/[^\w]+/g,'-')}.zip`;
  const dl=await window.claude?.use?.('downloads');if(dl){try{await dl.save({filename:name,data:blob});return}catch(e){}}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click()}
async function saveEmail(x,em){x.email=em;x.on=!!em;const nm=x.staff||x.name;let list=STAFF.slice();const i=list.findIndex(p=>p.name===nm||(p.emp&&pad(p.emp)===x.emp));
  if(i>=0)list[i]={...list[i],email:em,emp:list[i].emp||x.emp};else{list.push({name:x.name,emp:x.emp,email:em,st:'Active'});x.staff=x.name;x.how='Added'}
  try{busy=true;await db.doc('config/staff').set({list,updated:new Date().toISOString(),by:curUser});toast('Email saved to Staff')}catch(e){toast('Could not save to Staff')}busy=false}
async function send(){const L=R.rows.filter(r=>!r.skip&&r.on&&r.email);if(!L.length){toast('Nobody is checked.');return}
  const sub=S.querySelector('#tsSub').value.trim(),msg=S.querySelector('#tsMsg').value.trim();if(!confirm(`Email ${L.length} timesheet${L.length>1?'s':''}? Each person gets only their own page.`))return;
  busy=true;const btn=S.querySelector('#tsSend');let ok=0,bad=[];
  for(const[i,x] of L.entries()){btn.textContent=`Sending ${i+1} / ${L.length}…`;try{const html=`<p>Hi ${esc(x.name.split(' ')[0])},</p><p>${esc(msg).replace(/\n/g,'<br>')}</p>`;await window.ameMail([x.email],sub,html,[{name:fn(R,x),b64:b64(await pagePdf(x))}]);x.sent=new Date().toISOString();ok++}catch(e){x.err=String(e.message||e);bad.push(x.name)}}
  try{await db.collection('tslog').add({week:R.week,file:R.file,at:new Date().toISOString(),by:curUser,sent:L.filter(x=>x.sent).map(x=>({emp:x.emp,name:x.name,email:x.email})),failed:bad})}catch(e){}
  busy=false;render();toast(ok+' sent'+(bad.length?' · '+bad.length+' failed':''))}

function render(){
  const lg=[...LOG].sort((a,b)=>String(b.at).localeCompare(a.at)).slice(0,8);
  S.innerHTML=`<div class="mplhead"><h2>Timesheet Mailer</h2><label class="btn pri" for="tsFile">Upload Timesheet Summary PDF</label><input type="file" id="tsFile" accept="application/pdf" hidden></div>
  <p class="muted" style="margin-top:0">One employee per page → each person is emailed only their own page. Files are made in this browser and are not saved in the app.</p>
  <div id="tsBody">${R?body():'<div class="panel tsdrop" id="tsDrop">Drop the PDF here or use the Upload button.</div>'}</div>
  ${lg.length?`<h3 style="margin-top:22px">Sent history</h3><div class="tblwrap"><table class="tstbl"><thead><tr><th>Week</th><th>Sent</th><th>By</th><th class="n">People</th><th>Failed</th></tr></thead><tbody>${lg.map(l=>`<tr><td>${esc(l.week||l.file||'')}</td><td>${new Date(l.at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</td><td>${esc(l.by||'')}</td><td class="n">${(l.sent||[]).length}</td><td>${esc((l.failed||[]).join(', '))}</td></tr>`).join('')}</tbody></table></div>`:''}`;
  const f=S.querySelector('#tsFile');f.onchange=()=>{if(f.files[0])load(f.files[0])};
  const dz=S.querySelector('#tsDrop');if(dz){dz.ondragover=e=>{e.preventDefault();dz.classList.add('on')};dz.ondragleave=()=>dz.classList.remove('on');dz.ondrop=e=>{e.preventDefault();const x=e.dataTransfer.files[0];if(x)load(x)}}
  if(!R)return;
  S.querySelectorAll('[data-pv]').forEach(b=>b.onclick=()=>preview(R.rows[+b.dataset.pv]));
  S.querySelectorAll('[data-on]').forEach(c=>c.onchange=()=>{R.rows[+c.dataset.on].on=c.checked;cnt()});
  S.querySelectorAll('[data-em]').forEach(i=>i.onchange=()=>{const v=i.value.trim();if(v&&!/^\S+@\S+\.\S+$/.test(v)){toast('That email does not look right.');return}saveEmail(R.rows[+i.dataset.em],v).then(()=>render())});
  S.querySelector('#tsAll').onchange=e=>{R.rows.forEach(r=>{if(!r.skip&&r.email)r.on=e.target.checked});render()};
  S.querySelector('#tsZip').onclick=zipAll;S.querySelector('#tsSend').onclick=send;S.querySelector('#tsNew').onclick=()=>{R=null;render()};cnt()}
function cnt(){const n=R.rows.filter(r=>!r.skip&&r.on&&r.email).length;const b=S.querySelector('#tsSend');if(b){b.textContent=`Email ${n} timesheet${n===1?'':'s'}`;b.disabled=!n}}
function body(){const P=R.rows.filter(r=>!r.skip),skip=R.rows.filter(r=>r.skip),miss=P.filter(r=>!r.email).length;
  return `<div class="panel tsinfo"><div><b>${esc(R.week||'Week not found')}</b><br><small class="muted">${esc(R.file)} · ${R.pages} pages · ${P.length} employees${skip.length?' · skipped page '+skip.map(s=>s.page).join(', ')+' (no employee)':''}</small></div>${miss?`<span class="tsmiss">${miss} without email</span>`:'<span class="tsok">Everyone has an email</span>'}<button class="btn" id="tsNew">Start over</button></div>
  <div class="tblwrap"><table class="tstbl"><thead><tr><th><input type="checkbox" id="tsAll" checked aria-label="Select all"></th><th class="n">Page</th><th>Emp #</th><th>Name on timesheet</th><th>Staff match</th><th>Email</th><th class="n">Total</th><th class="n">Reg</th><th class="n">OT</th><th class="n">DT</th><th>Status</th><th></th></tr></thead><tbody>
  ${R.rows.map((x,i)=>x.skip?'':`<tr class="${x.email?'':'tsno'}"><td><input type="checkbox" data-on="${i}" ${x.on?'checked':''} ${x.email?'':'disabled'} aria-label="Send to ${esc(x.name)}"></td><td class="n">${x.page}</td><td>${esc(x.emp)}</td><td><b>${esc(x.name)}</b></td><td>${x.staff?esc(x.staff)+` <small class="muted">· ${esc(x.how)}</small>`:'<span class="tsmiss">Not in Staff</span>'}</td><td><input class="tsem" data-em="${i}" type="email" value="${esc(x.email)}" placeholder="Add email"></td><td class="n">${x.hours??'—'}</td><td class="n">${x.reg??''}</td><td class="n">${x.ot||''}</td><td class="n">${x.dt||''}</td><td>${x.sent?'<span class="tsok">Sent</span>':x.err?`<span class="tsmiss" title="${esc(x.err)}">Failed</span>`:''}</td><td><button class="btn small" data-pv="${i}">View</button></td></tr>`).join('')}</tbody></table></div>
  <div class="panel tsmail"><label class="f">Subject<input id="tsSub" value="Your Timesheet – ${esc(R.week||'')}"></label><label class="f">Message<textarea id="tsMsg" rows="3">Attached is your timesheet for ${esc(R.week||'this week')}. Please review it and let Accounting know right away if anything is wrong.\n\nThank you,\nAME Builders Accounting</textarea></label>
  <div class="bar" style="justify-content:flex-end"><button class="btn" id="tsZip">Download all as ZIP</button><button class="go" id="tsSend" style="width:auto">Email</button></div><small class="muted">Sent from your own Microsoft 365 mailbox; a copy stays in your Sent Items.</small></div>`}

document.head.insertAdjacentHTML('beforeend',`<style>
#tab-tsm{max-width:1300px;margin:0 auto}.tsdrop{padding:46px;text-align:center;border:2px dashed var(--line);color:var(--muted)}.tsdrop.on{border-color:var(--hi,#f47b20)}
.tsinfo{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.tsinfo>div{flex:1}
.tstbl{width:100%;border-collapse:collapse;font-size:14px}.tstbl th,.tstbl td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle;white-space:nowrap}.tstbl th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}.tstbl .n{text-align:right;font-variant-numeric:tabular-nums}
.tstbl tr.tsno td{background:rgba(232,89,74,.07)}.tsem{width:240px;padding:6px 8px;font:inherit}
.tsmiss{color:#e8594a;font-weight:700;font-size:13px}.tsok{color:#3fb950;font-weight:700;font-size:13px}
.tsmail{margin-top:14px;display:grid;gap:8px}.tsmail textarea{width:100%;font:inherit;padding:8px;box-sizing:border-box}
</style>`);
const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h5"/><path d="M15 17l2 2 3-3"/></svg>';
window.__tsLoad=f=>load(f);
AME.register({id:'tsm',name:'Timesheet Mailer',desc:'Accounting · split the weekly timesheet PDF · email each person',allow:own,tabs:['tsm'],section:'tab-tsm',icon:ICON,open:()=>{showTab('tsm');render()},onShow:render});
})();
