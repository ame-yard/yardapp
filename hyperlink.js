/* AME — Auto hyperlink for drawing sets.
   Finds each sheet's number (A5.41, S-201 …) in its title block, finds callouts that point at other
   sheets (5/A5.41, SEE A5.41 …) and writes real PDF link annotations, so the links work in any PDF
   app (Bluebeam, Adobe, phones). Nothing is uploaded anywhere — it all runs in the browser. */
(function(){
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ld=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)});
async function libs(){if(!window.pdfjsLib){await ld('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}
  if(!window.PDFLib)await ld('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js')}

/* sheet ids: A5.41 · A-501 · A501 · S2.01 · M1.1 · FP-101 · A5.41A — 1–3 letters, digits, optional dot part */
const SHEET=/\b([A-Z]{1,3})[-\s]?(\d{1,3}(?:\.\d{1,3}){0,2}[A-Z]?)\b/g;
const norm=s=>String(s||'').toUpperCase().replace(/[\s-]/g,'');
const DISC=new Set(['A','AD','AS','C','CS','D','E','ED','EL','FP','FA','G','GN','I','ID','L','LS','M','MP','P','PL','Q','R','RF','S','SD','T','TS','X','Y','DT','DW','EX','DM','IN','FS']);

/* a one-sheet PDF is usually named after its sheet: "A8.1 Wall Sections.pdf" */
function fnSheet(name){const m=String(name||'').replace(/\.pdf$/i,'').trim().match(/^([A-Za-z]{1,3})[-\s]?(\d{1,3}(?:\.\d{1,3}){0,2}[A-Za-z]?)(?=$|[\s_\-–—.,(])/);if(!m||!DISC.has(m[1].toUpperCase()))return '';return norm(m[1]+m[2])}

/* text items with page-space boxes (handles rotated text) */
function boxes(tc){return tc.items.filter(it=>it.str&&it.str.trim()).map(it=>{const [a,b,c,d,x,y]=it.transform;const h=Math.hypot(c,d)||it.height||8;const w=it.width||h*it.str.length*.5;const rot=Math.abs(b)>Math.abs(a);
  const r=rot?[x-h,y,x+h*.25,y+w]:[x,y-h*.25,x+w,y+h];return {s:it.str,x,y,w,h,rot,r:[Math.min(r[0],r[2]),Math.min(r[1],r[3]),Math.max(r[0],r[2]),Math.max(r[1],r[3])]}})}
/* part of an item's box that holds characters [i0,i1) */
function sub(b,i0,i1){const n=b.s.length||1;const f0=i0/n,f1=i1/n;const [x0,y0,x1,y1]=b.r;return b.rot?[x0,y0+(y1-y0)*f0,x1,y0+(y1-y0)*f1]:[x0+(x1-x0)*f0,y0,x0+(x1-x0)*f1,y1]}

async function analyze(pdf,onProg){const n=pdf.numPages;const pages=[];
  for(let i=1;i<=n;i++){const pg=await pdf.getPage(i);const [X0,Y0,X1,Y1]=pg.view;const W=X1-X0,H=Y1-Y0;const B=boxes(await pg.getTextContent());
    let links=[];try{links=(await pg.getAnnotations()).filter(a=>a.subtype==='Link').map(a=>Object.assign(a.rect.slice(),{ext:!!(a.url||a.unsafeUrl)}))}catch(e){}
    /* title block guess: biggest sheet-like text in the right 30% or bottom 22% of the sheet */
    const cands=[];B.forEach(b=>{const t=b.s.trim();const m=t.match(/^([A-Z]{1,3})[-\s]?(\d{1,3}(?:\.\d{1,3}){0,2}[A-Z]?)$/);if(!m||!DISC.has(m[1]))return;const cx=(b.r[0]+b.r[2])/2-X0,cy=(b.r[1]+b.r[3])/2-Y0;const inTB=cx>W*.7||cy<H*.22;const corner=cx>W*.8&&cy<H*.25;cands.push({id:norm(t),label:t,score:b.h*(inTB?2:1)*(corner?1.6:1),b})});
    cands.sort((a,b)=>b.score-a.score);
    pages.push({i,W,H,X0,Y0,B,links,sheet:cands[0]?cands[0].id:'',label:cands[0]?cands[0].label:'',alt:[...new Set(cands.slice(0,4).map(c=>c.label))]});
    onProg&&onProg(i,n)}
  return pages}

/* callouts on every page that name another sheet in the set */
function findLinks(pages,opt){const map=new Map();pages.forEach(p=>{if(p.sheet&&!map.has(p.sheet))map.set(p.sheet,p.i)});const out=[],miss=new Map();
  pages.forEach(p=>{p.B.forEach((b,bi)=>{SHEET.lastIndex=0;let m;while((m=SHEET.exec(b.s))){if(!DISC.has(m[1]))continue;const id=norm(m[0]);if(id===p.sheet)continue;
      /* skip the title-block number itself and sheet-index tables only when asked */
      const tgt=map.get(id);const r=sub(b,m.index,m.index+m[0].length);
      if(p.links.some(L=>(!(opt&&(opt.multi||opt.replace))||L.ext)&&L[0]<=r[2]&&L[2]>=r[0]&&L[1]<=r[3]&&L[3]>=r[1]))continue; // already linked in the file
      if(!tgt){miss.set(id,(miss.get(id)||0)+1);continue}
      /* detail number: "5/A5.41" in the same text, or a short number just above (bubble top half) */
      let det='';const pre=b.s.slice(0,m.index).match(/(\b[A-Z]?\d{1,2}[A-Z]?)\s*\/\s*$/);if(pre)det=pre[1];
      if(!det){const cx=(r[0]+r[2])/2;const up=p.B.find(o=>o!==b&&/^[A-Z]?\d{1,2}[A-Z]?$/.test(o.s.trim())&&Math.abs((o.r[0]+o.r[2])/2-cx)<Math.max(b.h*2,(r[2]-r[0])*.8)&&o.r[1]>=r[3]-b.h*.2&&o.r[1]-r[3]<b.h*2.2);if(up)det=up.s.trim()}
      out.push({from:p.i,to:tgt,sheet:id,label:m[0],det,r,on:true})}})});
  /* zoom target: the detail title on the target sheet (its number with the sheet id next to / under it) */
  if(opt&&opt.zoom)out.forEach(L=>{if(!L.det)return;const tp=pages[L.to-1];const hits=tp.B.filter(o=>o.s.trim()===L.det);let best=null;
    hits.forEach(o=>{const near=tp.B.some(q=>norm(q.s.trim())===L.sheet&&Math.abs((q.r[0]+q.r[2])/2-(o.r[0]+o.r[2])/2)<o.h*3&&Math.abs(q.r[1]-o.r[1])<o.h*3);if(near&&(!best||o.h>best.h))best=o});
    if(best)L.dest=[best.r[0]-best.h*6,best.r[3]+best.h*10]});
  return {links:out,miss:[...miss.entries()].sort((a,b)=>b[1]-a[1]),map}}

/* write the links into the PDF with pdf-lib */
async function write(src,links,opt){const {PDFDocument,PDFName,PDFNumber,PDFArray}=PDFLib;const arr=Array.isArray(src)?src:[src];let doc;
  const strip=sd=>sd.getPages().forEach(pg=>{const an=pg.node.Annots();if(!an)return;const keep=[];for(let i=0;i<an.size();i++){const a=an.lookup(i);let dead=false;try{if(a&&a.get&&a.get(PDFName.of('Subtype'))===PDFName.of('Link')&&(a.get(PDFName.of('Dest'))||(a.get(PDFName.of('A'))&&String(a.get(PDFName.of('A')).get(PDFName.of('S')))==='/GoTo')))dead=true}catch(e){}if(!dead)keep.push(an.get(i))}pg.node.set(PDFName.of('Annots'),sd.context.obj(keep))});
  if(arr.length===1){doc=await PDFDocument.load(arr[0],{ignoreEncryption:true});if(opt.replace)strip(doc)}
  else{doc=await PDFDocument.create();for(const b of arr){const sd=await PDFDocument.load(b,{ignoreEncryption:true});sd.getPages().forEach(pg=>{const an=pg.node.Annots();if(!an)return;/* drop old jump-links: they point at the source file's own pages */const keep=[];for(let i=0;i<an.size();i++){const a=an.lookup(i);let dead=false;try{if(a&&a.get&&a.get(PDFName.of('Subtype'))===PDFName.of('Link')&&(a.get(PDFName.of('Dest'))||(a.get(PDFName.of('A'))&&String(a.get(PDFName.of('A')).get(PDFName.of('S')))==='/GoTo')))dead=true}catch(e){}if(!dead)keep.push(an.get(i))}pg.node.set(PDFName.of('Annots'),sd.context.obj(keep))});
    const cp=await doc.copyPages(sd,sd.getPageIndices());cp.forEach(p=>doc.addPage(p))}}
  const P=doc.getPages();const ctx=doc.context;
  links.filter(l=>l.on).forEach(l=>{const pg=P[l.from-1],tp=P[l.to-1];if(!pg||!tp)return;const pad=1.5;const R=[l.r[0]-pad,l.r[1]-pad,l.r[2]+pad,l.r[3]+pad];
    const dest=l.dest?[tp.ref,PDFName.of('XYZ'),l.dest[0],l.dest[1],null]:[tp.ref,PDFName.of('Fit')];
    const a=ctx.obj({Type:'Annot',Subtype:'Link',Rect:R,Border:opt.box?[0,0,1]:[0,0,0],...(opt.box?{C:[0,.35,.9]}:{}),H:'I',Dest:dest,Contents:'Go to '+l.label+(l.det?' · detail '+l.det:'')});
    const ref=ctx.register(a);const an=pg.node.Annots();if(an)an.push(ref);else pg.node.set(PDFName.of('Annots'),ctx.obj([ref]))});
  return doc.save()}

/* ---------- UI ---------- */
async function openTool(file,opts){opts=opts||{};await libs();const R=document.getElementById('dlgRoot');let st={parts:[],pages:null,res:null,zoom:true,box:true,replace:true};
  const shell=inner=>{R.innerHTML=`<div class="scrim sheet"><div class="dlg hlk" style="max-width:860px"><h3 style="display:flex;align-items:center;gap:8px"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>Auto Hyperlink</h3>${inner}</div></div><style>${CSS}</style>`};
  const pick=()=>{shell(`<p class="muted" style="margin-top:0">Pick a drawing set PDF — or select <b>all the sheet PDFs at once</b> (e.g. A3.1, A8.1, S1 …). Detail callouts (e.g. <b>5/A8.1</b>) become clickable links to that sheet and work in any PDF app. Nothing leaves this computer.</p><label class="hlpick"><input type="file" accept="application/pdf" id="hlF" multiple hidden><b>Choose PDF(s)…</b><small class="muted">or drop them here · several files get combined into one linked set</small></label><div class="bar"><button class="btn" id="hlX" style="width:auto">Close</button></div>`);
    const go=fs=>{fs=[...(fs||[])].filter(f=>/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name));if(fs.length)run(fs)};document.getElementById('hlF').onchange=e=>go(e.target.files);const pk=R.querySelector('.hlpick');pk.ondragover=e=>{e.preventDefault()};pk.ondrop=e=>{e.preventDefault();go(e.dataTransfer.files)};document.getElementById('hlX').onclick=closeDlg};
  const flat=from=>{if(!st.pages)st.pages=[];st.parts.forEach((pt,pi)=>{if(pi<from)return;const one=pt.pages.length===1;const f=one?fnSheet(pt.name):'';pt.pages.forEach(p=>{const q={...p,src:pi,fn:pt.name};if(f){q.alt=[...new Set([f,...p.alt])];q.sheet=f;q.label=f}st.pages.push(q)})});st.pages.forEach((p,k)=>p.i=k+1)};
  const run=async(files)=>{shell(`<p id="hlP">Reading sheets…</p><div class="hlbar"><i id="hlB" style="width:0"></i></div>`);const from=st.parts.length;
    try{let k=0;for(const f of files){k++;const buf=await f.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf.slice(0))}).promise;
      const pg=await analyze(pdf,(i,n)=>{const p=document.getElementById('hlP'),b=document.getElementById('hlB');if(p)p.textContent=(files.length>1?`File ${k} of ${files.length} · `:'')+`Reading sheet ${i} of ${n}…`;if(b)b.style.width=(i/n*100)+'%'});
      st.parts.push({name:f.name||'drawings.pdf',buf,pages:pg})}
      flat(from);recalc();view()}catch(e){shell(`<p style="color:#e2513a">Could not read this PDF: ${E(e.message||e)}</p><div class="bar"><button class="btn" id="hlX" style="width:auto">Close</button></div>`);document.getElementById('hlX').onclick=closeDlg}};
  const recalc=()=>{st.res=findLinks(st.pages,{zoom:st.zoom,multi:st.parts.length>1,replace:st.replace})};
  const view=()=>{const r=st.res,P=st.pages;const multi=st.parts.length>1;st.noText=P.filter(p=>!p.B.length).length;const per={};r.links.forEach(l=>{per[l.from]=(per[l.from]||0)+1});const on=r.links.filter(l=>l.on).length;const dup=[...r.map.keys()].length<P.filter(p=>p.sheet).length;
    shell(`<div class="hlsum"><div><b>${P.length}</b><small>sheets</small></div><div><b>${P.filter(p=>p.sheet).length}</b><small>sheet numbers found</small></div><div><b>${on}</b><small>links to add</small></div><div><b>${r.links.filter(l=>l.dest).length}</b><small>go to the detail</small></div><div class="${r.miss.length?'warn':''}"><b>${r.miss.length}</b><small>refs with no sheet</small></div></div>
     ${!r.links.length&&r.miss.length&&!multi?`<p class="hlwarn"><b>No links could be made.</b> These pages point at ${r.miss.length} sheet number${r.miss.length>1?'s':''} (${r.miss.slice(0,4).map(m=>E(m[0])).join(', ')}${r.miss.length>4?'…':''}) that are not inside this PDF. A link can only go to a sheet that is in the same file — tap <b>Add more PDFs</b> and select the other sheets, and they get combined into one set with the links in it.</p>`:''}${st.noText?`<p class="hlwarn">${st.noText} sheet(s) have no readable text (scanned). Those can't be linked automatically.</p>`:''}${dup?'<p class="hlwarn">Some sheet numbers appear on more than one page — links go to the first one. Fix the numbers below if needed.</p>':''}
     <div class="hlopts"><label><input type="checkbox" id="hlZ" ${st.zoom?'checked':''}> Jump to the detail when found (not just the sheet)</label>${P.some(p=>p.links.some(l=>!l.ext))&&!multi?`<label><input type="checkbox" id="hlRp" ${st.replace?'checked':''}> Replace the links already in this PDF (${P.reduce((n,p)=>n+p.links.filter(l=>!l.ext).length,0)} — they only open the sheet) with links that jump to the detail</label>`:''}<label><input type="checkbox" id="hlBx" ${st.box?'checked':''}> Show a thin blue box around links</label></div>
     <details open><summary><b>Sheets</b> — fix a number if it was read wrong</summary><div class="hlsh">${P.map(p=>`<label><span title="${E(p.fn||'')}">p.${p.i}</span><input data-sh="${p.i}" value="${E(p.label)}" list="hlAlt${p.i}" placeholder="—"><datalist id="hlAlt${p.i}">${p.alt.map(a=>`<option value="${E(a)}">`).join('')}</datalist><em>${per[p.i]||0} links</em></label>`).join('')}</div></details>
     <details><summary><b>Links</b> (${r.links.length}) — untick any you don't want</summary><div class="hllist">${r.links.map((l,k)=>`<label><input type="checkbox" data-lk="${k}" ${l.on?'checked':''}> p.${l.from} <b>${E((l.det?l.det+'/':'')+l.label)}</b> → ${E(P[l.to-1].label)} (p.${l.to})${l.dest?' · detail':''}</label>`).join('')||'<p class="muted">No callouts found.</p>'}</div></details>
     ${r.miss.length?`<details><summary><b>Not in this set</b> (${r.miss.length})</summary><p class="muted" style="font-size:12px">These look like sheet numbers but no page has that number — usually other trades' sheets or a number read wrong above.</p><div class="hlmiss">${r.miss.map(([id,c])=>`<span>${E(id)} <small>×${c}</small></span>`).join('')}</div></details>`:''}
     <div class="bar"><button class="btn" id="hlAg" style="width:auto">Start over</button><button class="btn" id="hlMore" style="width:auto">Add more PDFs</button><input type="file" accept="application/pdf" id="hlMoreF" multiple hidden><span style="flex:1"></span><button class="btn" id="hlX" style="width:auto">Close</button>${opts.onSave&&!multi?`<button class="btn" id="hlKeep" style="width:auto">Save into this document</button>`:''}<button class="go" id="hlDl" style="width:auto" ${on?'':'disabled'}>Download linked PDF</button></div>`);
    R.querySelectorAll('[data-sh]').forEach(i=>i.onchange=()=>{const p=P[+i.dataset.sh-1];p.label=i.value.trim();p.sheet=norm(p.label);recalc();view()});
    R.querySelectorAll('[data-lk]').forEach(c=>c.onchange=()=>{r.links[+c.dataset.lk].on=c.checked});
    document.getElementById('hlZ').onchange=e=>{st.zoom=e.target.checked;recalc();view()};document.getElementById('hlBx').onchange=e=>{st.box=e.target.checked};{const rp=document.getElementById('hlRp');if(rp)rp.onchange=e=>{st.replace=e.target.checked;recalc();view()}}
    document.getElementById('hlX').onclick=closeDlg;document.getElementById('hlAg').onclick=()=>{st={parts:[],zoom:st.zoom,box:st.box,replace:st.replace};pick()};{const mf=document.getElementById('hlMoreF');document.getElementById('hlMore').onclick=()=>mf.click();mf.onchange=e=>{const fs=[...e.target.files].filter(f=>/\.pdf$/i.test(f.name)||/pdf$/i.test(f.type));if(fs.length)run(fs)}};
    const make=async()=>{const b=await write(st.parts.map(pt=>pt.buf.slice(0)),r.links,{box:st.box,replace:st.replace&&P.some(p=>p.links.some(l=>!l.ext))});return new Blob([b],{type:'application/pdf'})};
    document.getElementById('hlDl').onclick=async e=>{e.target.disabled=true;e.target.textContent='Building…';try{const blob=await make();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(multi?'Drawing set':String(st.parts[0].name||'drawings.pdf').replace(/\.pdf$/i,''))+' (linked).pdf';document.body.appendChild(a);a.click();a.remove();toast(r.links.filter(l=>l.on).length+' links added')}catch(x){toast('Could not build: '+(x.message||x))}e.target.disabled=false;e.target.textContent='Download linked PDF'};
    {const k=document.getElementById('hlKeep');if(k)k.onclick=async()=>{k.disabled=true;k.textContent='Saving…';try{await opts.onSave(await make(),r.links.filter(l=>l.on).length);closeDlg()}catch(x){toast('Could not save: '+(x.message||x));k.disabled=false;k.textContent='Save into this document'}}}};
  {const fl=[].concat(file||[]);if(fl.length)run(fl);else pick()}}
const CSS=`.hlpick{display:flex;flex-direction:column;align-items:center;gap:6px;padding:34px;border:2px dashed var(--line);border-radius:14px;cursor:pointer;text-align:center}.hlpick:hover{border-color:var(--accent,#f47b20)}.hlpick b{font-size:17px}
.hlbar{height:8px;border-radius:999px;background:var(--chip);overflow:hidden}.hlbar i{display:block;height:100%;background:var(--accent,#f47b20);transition:width .2s}
.hlsum{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:0 0 10px}.hlsum div{border:1px solid var(--line);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column}.hlsum b{font-size:22px}.hlsum small{color:var(--muted);font-size:11.5px}.hlsum .warn b{color:#e8a33c}
.hlwarn{font-size:13px;color:#e8a33c;margin:4px 0}.hlopts{display:flex;flex-direction:column;gap:4px;margin:6px 0 10px;font-size:14px}.hlk details{margin:8px 0;border-top:1px solid var(--line);padding-top:8px}.hlk summary{cursor:pointer}
.hlsh{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px;max-height:34vh;overflow:auto;margin-top:8px}.hlsh label{display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:6px;font-size:13px}.hlsh input{padding:5px 6px;font-size:13px}.hlsh em{font-style:normal;font-size:11px;color:var(--muted)}
.hllist{max-height:34vh;overflow:auto;display:flex;flex-direction:column;gap:2px;margin-top:6px;font-size:13px}.hlmiss{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.hlmiss span{padding:2px 8px;border-radius:999px;background:var(--chip);font-size:12px}
@media(max-width:700px){.hlsum{grid-template-columns:repeat(2,1fr)}}`;
window.ameHyperlink={open:openTool,analyze,findLinks,write,libs};
})();
