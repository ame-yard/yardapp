/* AME Deliveries — office receiving log. Deliveries come in, get checked, then go to the yard or get picked up for a job. */
(function(){
const sec=document.getElementById('tab-deliv');let D=[],view='list',openId='',flt='open';
const ST=['Received','In yard','Picked up'];
(function w(){if(typeof db!=='undefined'&&db&&db.collection){db.collection('deliveries').onSnapshot(s=>{D=s.docs.map(d=>({...d.data(),_id:d.id}));if(AME.cur==='deliv')render()},()=>{})}else setTimeout(w,400)})();
const pill=s=>`<span class="pill ${s==='Received'?'p-needs':'p-good'}">${esc(s||'Received')}</span>`;
function render(){if(!sec)return;if(view==='view'&&D.find(x=>x._id===openId))return renderView();view='list';
  const l=[...D].filter(d=>flt==='all'||(flt==='open'?(d.status||'Received')==='Received':(d.status||'Received')!=='Received')).sort((a,b)=>String(b.date||b.at).localeCompare(String(a.date||a.at)));
  const nOpen=D.filter(d=>(d.status||'Received')==='Received').length;
  sec.innerHTML=`<div class="mplhead"><h2>Deliveries</h2><button class="btn pri" id="dvNew">+ New delivery</button></div>
   <div class="viewseg" style="margin-bottom:12px"><button data-df="open" aria-pressed="${flt==='open'}">At the office${nOpen?' · '+nOpen:''}</button><button data-df="done" aria-pressed="${flt==='done'}">Done</button><button data-df="all" aria-pressed="${flt==='all'}">All</button></div>
   ${l.length?`<div class="mplcards">${l.map(d=>`<button class="mplcard" data-dv="${esc(d._id)}"><b>${esc(d.vendor||'Delivery')}</b>${pill(d.status)}<small>${esc(fmtD(d.date||d.at))}${d.job?' · Job '+esc(jobLabel(d.job)):''}${d.po?' · PO '+esc(d.po):''}</small><small class="muted">${(d.lines||[]).length} line${(d.lines||[]).length===1?'':'s'} · received by ${esc(d.by||'')}</small></button>`).join('')}</div>`:'<div class="panel muted">Nothing here. Tap “+ New delivery” when something arrives at the office.</div>'}`;
  sec.querySelector('#dvNew').onclick=()=>openForm('');sec.querySelectorAll('[data-df]').forEach(b=>b.onclick=()=>{flt=b.dataset.df;render()});
  sec.querySelectorAll('[data-dv]').forEach(b=>b.onclick=()=>{openId=b.dataset.dv;view='view';render();scrollTo({top:0})})}
function renderView(){const d=D.find(x=>x._id===openId);const L=d.lines||[];const canYard=typeof can==='function'&&(can('RECEIVE')||isAdmin);
  sec.innerHTML=`<div class="mplhead"><button class="btn" id="dvBack">← All deliveries</button><h2>${esc(d.vendor||'Delivery')}</h2>${pill(d.status)}<span class="mtop"><button class="btn" id="dvEdit">Edit</button></span></div>
   <div class="panel"><p class="muted" style="margin-top:0">${esc(fmtD(d.date||d.at))} · received by ${esc(d.by||'')}${d.carrier?' · via '+esc(d.carrier):''}${d.job?' · Job '+esc(jobLabel(d.job)):''}${d.po?' · PO '+esc(d.po):''}</p>${d.note?`<p>${esc(d.note)}</p>`:''}
   ${d.photo?`<p><img src="${esc(d.photo)}" alt="Packing slip" style="max-width:100%;max-height:360px;border-radius:10px"></p>`:''}
   <div class="tblwrap"><table><thead><tr><th>Item</th><th class="n">Qty</th><th>Yard item</th><th>Status</th></tr></thead><tbody>${L.map((x,k)=>{const it=x.itemId&&byId(x.itemId);return `<tr><td><b>${esc(x.name)}</b></td><td class="n">${esc(String(x.qty||''))} ${esc(x.unit||'')}</td><td>${it?esc(it.name)+' <small class="muted">'+esc(it.loc||'')+'</small>':'<span class="muted">—</span>'}</td><td>${x.done?`<span class="pill p-good">${esc(x.done)}</span>`:it&&canYard?`<button class="btn small pri" data-dy="${k}">Put in yard</button>`:'<span class="muted">At office</span>'}</td></tr>`}).join('')||'<tr><td colspan="4" class="muted">No lines.</td></tr>'}</tbody></table></div>
   <div class="bar" style="margin-top:12px;flex-wrap:wrap">${(d.status||'Received')==='Received'?`<button class="btn" id="dvPick">Picked up for a job</button>${L.some(x=>x.itemId&&!x.done)&&canYard?'<button class="btn pri" id="dvAllYard">Put all in yard</button>':''}<button class="btn" id="dvDone">Mark done</button>`:`<button class="btn" id="dvReopen">Back to “At the office”</button>`}<button class="btn dng" id="dvDel">Delete</button></div></div>`;
  const up=async o=>{await db.doc('deliveries/'+openId).update({...o,updated:new Date().toISOString()})};
  sec.querySelector('#dvBack').onclick=()=>{view='list';render()};sec.querySelector('#dvEdit').onclick=()=>openForm(openId);
  const yard=async ks=>{const lines=JSON.parse(JSON.stringify(L));const now=new Date().toISOString();for(const k of ks){const x=lines[k];const it=x&&x.itemId&&byId(x.itemId);if(!it||x.done)continue;const n=Number(x.qty)||0;const before=typeof it.qty==='number'?it.qty:0;
      try{await writeItem(it.id,{qty:before+n,updatedAt:now,updatedBy:curUser});await db.collection('logs').add({ts:now,action:'RECEIVE',itemId:it.id,name:it.name,size:it.size||'',unit:it.unit||'',loc:it.loc,n,before,after:before+n,job:'',by:curUser,note:'Delivery from '+(d.vendor||'')+(d.po?' · PO '+d.po:''),cond:''});x.done='In yard'}catch(e){toast('Could not update '+it.name+': '+(e.message||e))}}
    const all=lines.every(x=>x.done||!x.itemId);await up({lines,...(all?{status:'In yard'}:{})});toast('Added to the yard inventory')};
  sec.querySelectorAll('[data-dy]').forEach(b=>b.onclick=()=>yard([+b.dataset.dy]));const ay=sec.querySelector('#dvAllYard');if(ay)ay.onclick=()=>yard(L.map((_,k)=>k));
  const pk=sec.querySelector('#dvPick');if(pk)pk.onclick=async()=>{const who=prompt('Picked up by (name)?',curUser);if(who===null)return;await up({status:'Picked up',pickedBy:who,pickedAt:new Date().toISOString()});toast('Marked picked up')};
  const dn=sec.querySelector('#dvDone');if(dn)dn.onclick=()=>up({status:'In yard'});const ro=sec.querySelector('#dvReopen');if(ro)ro.onclick=()=>up({status:'Received'});
  sec.querySelector('#dvDel').onclick=async()=>{if(!confirm('Delete this delivery record?'))return;await db.doc('deliveries/'+openId).delete();view='list';render()}}
function openForm(id){const d0=id?JSON.parse(JSON.stringify(D.find(x=>x._id===id)||{})):{date:new Date().toISOString().slice(0,10),lines:[{name:'',qty:1,unit:'EA'}],by:curUser};const d=d0;
  const vs=[...new Set(D.map(x=>x.vendor).filter(Boolean))].sort();
  const draw=()=>{document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>${id?'Edit delivery':'New delivery'}</h3>
   <datalist id="dvVen">${vs.map(v=>`<option value="${esc(v)}">`).join('')}</datalist><datalist id="dvItems">${items.map(i=>`<option value="${esc(i.name+(i.size?' · '+i.size:''))}">`).join('')}</datalist>
   <div class="fields"><label class="f">Vendor / supplier<input id="dv_vendor" list="dvVen" value="${esc(d.vendor||'')}"></label><label class="f">Date<input id="dv_date" type="date" value="${esc(d.date||'')}"></label>
   <label class="f">Job<select id="dv_job"><option value="">— none / stock —</option>${jobs.filter(j=>j.status!=='Closed').map(j=>`<option value="${esc(j.no)}" ${j.no===d.job?'selected':''}>${esc(jobLabel(j.no))}</option>`).join('')}</select></label><label class="f">PO #<input id="dv_po" value="${esc(d.po||'')}"></label>
   <label class="f">Carrier<input id="dv_carrier" value="${esc(d.carrier||'')}" placeholder="UPS, vendor truck…"></label><label class="f">Note<input id="dv_note" value="${esc(d.note||'')}"></label></div>
   <div class="qlabel">Items</div><div id="dvLines">${(d.lines||[]).map((x,k)=>`<div class="dvline"><input data-lf="name" data-k="${k}" list="dvItems" placeholder="Item (pick a yard item or type)" value="${esc(x.name||'')}"><input data-lf="qty" data-k="${k}" inputmode="decimal" value="${esc(String(x.qty??''))}" style="width:70px"><input data-lf="unit" data-k="${k}" value="${esc(x.unit||'')}" style="width:64px"><button type="button" class="btn small" data-lrm="${k}">×</button></div>`).join('')}</div>
   <button type="button" class="btn" id="dvAddL">+ Add line</button>
   <p><button type="button" class="btn" id="dvPhoto">${d.photo?'Replace':'Add'} packing slip photo</button> ${d.photo?'<span class="muted">Photo attached</span>':''}</p>
   <div class="bar"><button class="btn" id="dvC">Cancel</button><button class="go" id="dvS" style="width:auto">Save</button></div></div></div>`;
   const col=()=>{['vendor','date','job','po','carrier','note'].forEach(k=>d[k]=document.getElementById('dv_'+k).value.trim());document.querySelectorAll('[data-lf]').forEach(i=>{d.lines[+i.dataset.k][i.dataset.lf]=i.dataset.lf==='qty'?Number(i.value)||0:i.value.trim()})};
   document.getElementById('dvAddL').onclick=()=>{col();d.lines.push({name:'',qty:1,unit:'EA'});draw()};
   document.querySelectorAll('[data-lrm]').forEach(b=>b.onclick=()=>{col();d.lines.splice(+b.dataset.lrm,1);draw()});
   document.getElementById('dvC').onclick=closeDlg;
   document.getElementById('dvPhoto').onclick=()=>{col();const f=document.createElement('input');f.type='file';f.accept='image/*';f.onchange=async()=>{const x=f.files[0];if(!x)return;try{toast('Uploading…');const a=await window.claude.use('assets');const r=await a.upload(await shrink(x));d.photo=r.url;draw()}catch(e){toast('Could not upload: '+(e.message||e))}};f.click()};
   document.getElementById('dvS').onclick=async()=>{col();d.lines=(d.lines||[]).filter(x=>x.name);if(!d.vendor){toast('Enter the vendor.');return}
     d.lines.forEach(x=>{if(!x.itemId){const m=items.find(i=>(i.name+(i.size?' · '+i.size:''))===x.name);if(m){x.itemId=m.id;x.unit=x.unit||m.unit}}});
     const now=new Date().toISOString();const doc={...d,status:d.status||'Received',by:d.by||curUser,at:d.at||now,updated:now};delete doc._id;const nid=id||('d'+Date.now().toString(36));
     try{await db.doc('deliveries/'+nid).set(doc);closeDlg();openId=nid;view='view';render();toast('Delivery saved')}catch(e){toast('Could not save: '+(e.message||e))}}};draw()}
AME.register({id:'deliv',beta:true,name:'Deliveries',desc:'Office receiving · packing slips · to yard or job',perm:'RECEIVE',tabs:['deliv'],section:'tab-deliv',
  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>',
  open:()=>{view='list';showTab('deliv')},onShow:render});
const _ar=window.applyRole;window.applyRole=function(){_ar();const b=document.querySelector('nav.tabs [data-tab="deliv"]');if(b)b.hidden=!AME.allowed(AME.mod('deliv'))};
document.head.insertAdjacentHTML('beforeend','<style>.dvline{display:flex;gap:6px;margin-bottom:6px}.dvline input:first-child{flex:1;min-width:0}#actions .act[data-act=RECEIVE]{display:none!important}</style>');
})();
