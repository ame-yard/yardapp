/* AME Field Reports — per job: Timesheet, T&M, Daily, Safety Observation, Leak, Accident. Saved to SharePoint, exported to PDF. */
(function(){
const sec=document.getElementById('tab-field');
let R=[],FJ={},view='jobs',job='',type='',rid='',W=null,dirty=false;
const DEF_PHASES=['Mobilization','Underlayment','Tile_Batten','Tile_Field','Tile_Eave','Tile_Rake','Tile_Ridge and Hip','Tile_Pan','Tile_Valley','Coating_Power Wash','Coating_Prep','Coating_Emulsion w/Poly','Coating_Elastomeric','Coating_Wall','Coating_Penetration','Coating_Drain','Coating_Walkway','Single Ply_Field','Single Ply_Wall/Curb','Single Ply_Coverstrip','Single Ply_Penetration','Single Ply_Walkpad','Single Ply_Drain/Scupper','Counterflashing','Skirt Metal','Edge Metal','Gutter','Downspout','Saddle Flashing','COR or T&M'];
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat'];
const T={
 ts:{n:'Timesheet',d:'Weekly crew hours by phase & section',c:'#4c9aff'},
 tm:{n:'T&M Report',d:'Time & material for extra work / COR',c:'#e8a33d'},
 daily:{n:'Daily Report',d:'Work done, weather, deliveries, photos',c:'#3fb950'},
 obs:{n:'Safety Observation',d:'Record unsafe acts & corrective action',c:'#e8594a'},
 leak:{n:'Leak Report',d:'Rain / water leak findings with photos',c:'#3aa7c9'},
 acc:{n:'Accident Report',d:'Injury / incident — Cal/OSHA info',c:'#c43c3c'}};
const ICON={ts:'<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>',tm:'<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',daily:'<path d="M5 3h14v18H5z"/><path d="M9 8h6M9 12h6M9 16h4"/>',obs:'<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h0"/>',leak:'<path d="M12 3c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z"/>',acc:'<path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="3"/>'};
const svg=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;
const today=()=>new Date().toISOString().slice(0,10);
const monday=d=>{const x=new Date((d||today())+'T12:00');const k=(x.getDay()+6)%7;x.setDate(x.getDate()-k);return x.toISOString().slice(0,10)};
const addD=(d,n)=>{const x=new Date(d+'T12:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
const md=d=>{if(!d)return'';const x=new Date(d+'T12:00');return (x.getMonth()+1)+'/'+x.getDate()+'/'+String(x.getFullYear()).slice(2)};
const crewNames=r=>crew.filter(c=>!r||r.includes(c.role)).map(c=>c.name);
(function w(){if(typeof db!=='undefined'&&db&&db.collection){db.collection('freports').onSnapshot(s=>{R=s.docs.map(d=>({...d.data(),_id:d.id}));if(AME.cur==='field'&&!dirty)render()},()=>{});db.collection('fjobs').onSnapshot(s=>{FJ={};s.docs.forEach(d=>FJ[d.id]=d.data());if(AME.cur==='field'&&!dirty)render()},()=>{})}else setTimeout(w,400)})();
const jkey=j=>String(j).replace(/[^A-Za-z0-9]/g,'');
const jcfg=j=>FJ[jkey(j)]||{};
const phases=j=>jcfg(j).phases||DEF_PHASES;const sections=j=>jcfg(j).sections||[];
/* ---------------- views ---------------- */
function render(){if(!sec)return;if(view==='edit'&&W)return renderEdit();if(view==='job'&&job)return renderJob();view='jobs';
  const act=jobs.filter(j=>j.status!=='Closed').sort((a,b)=>String(b.no).localeCompare(String(a.no),undefined,{numeric:true}));
  sec.innerHTML=`<div class="mplhead"><h2>Field Reports</h2></div><p class="muted" style="margin-top:0">Pick the job. Timesheets, T&amp;M, daily, safety, leak and accident reports are kept per job and can be downloaded as PDF.</p>
   <input id="frQ" class="search" placeholder="Search job # or name…"><div class="jlist" id="frJobs"></div>`;
  const draw=q=>{q=(q||'').toLowerCase();const l=act.filter(j=>!q||(j.no+' '+(j.name||'')).toLowerCase().includes(q));
    document.getElementById('frJobs').innerHTML=l.map(j=>{const n=R.filter(r=>r.job===j.no).length;return `<button class="jrow" data-fj="${esc(j.no)}"><span class="jno">${esc(j.no)}</span><span class="jnm">${esc(j.name||'')}</span><span class="jct">${n?n+' report'+(n>1?'s':''):''}</span><span></span></button>`}).join('')||'<div class="muted" style="padding:12px">No active jobs. Add jobs in Yard Inventory → Jobs.</div>';
    sec.querySelectorAll('[data-fj]').forEach(b=>b.onclick=()=>{job=b.dataset.fj;view='job';render();scrollTo({top:0})})};
  draw('');document.getElementById('frQ').oninput=e=>draw(e.target.value)}
function renderJob(){const L=R.filter(r=>r.job===job).sort((a,b)=>String(b.date||b.at).localeCompare(String(a.date||a.at)));
  sec.innerHTML=`<div class="mplhead"><button class="btn" id="frBack">← All jobs</button><h2>${esc(jobLabel(job))}</h2><span class="mtop"><button class="btn" id="frSetup">Job setup</button></span></div>
   <div class="frtypes">${Object.entries(T).map(([k,t])=>{const n=L.filter(r=>r.type===k).length;return `<button class="frtype" data-nt="${k}" style="--c:${t.c}"><span class="fric">${svg(k)}</span><b>${t.n}</b><small>${t.d}</small><span class="frn">+ New${n?' · '+n+' saved':''}</span></button>`}).join('')}</div>
   <h3 style="margin-top:22px">Reports for this job</h3>
   <div class="viewseg" id="frFlt" style="margin-bottom:10px"><button data-ff="" aria-pressed="true">All</button>${Object.entries(T).map(([k,t])=>`<button data-ff="${k}">${t.n}</button>`).join('')}</div>
   <div id="frList"></div>`;
  let ff='';const dl=()=>{const l=L.filter(r=>!ff||r.type===ff);document.getElementById('frList').innerHTML=l.length?`<div class="tblwrap"><table><thead><tr><th>Date</th><th>Report</th><th>Summary</th><th>By</th><th>Status</th><th></th></tr></thead><tbody>${l.map(r=>`<tr class="eqrow" data-or="${esc(r._id)}"><td>${esc(md(r.date))}</td><td><b style="color:${T[r.type]?.c}">${esc(T[r.type]?.n||r.type)}</b></td><td>${esc(sumOf(r))}</td><td>${esc(r.by||'')}</td><td>${r.status==='final'?'<span class="pill p-good">Final</span>':'<span class="pill p-needs">Draft</span>'}</td><td><button class="btn small" data-pdf="${esc(r._id)}">PDF</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="panel muted">No reports yet for this job.</div>';
    sec.querySelectorAll('[data-or]').forEach(x=>x.onclick=e=>{if(e.target.closest('[data-pdf]'))return;openR(x.dataset.or)});sec.querySelectorAll('[data-pdf]').forEach(b=>b.onclick=e=>{e.stopPropagation();pdf(R.find(r=>r._id===b.dataset.pdf))})};
  dl();sec.querySelectorAll('[data-ff]').forEach(b=>b.onclick=()=>{ff=b.dataset.ff;sec.querySelectorAll('[data-ff]').forEach(x=>x.setAttribute('aria-pressed',x===b));dl()});
  document.getElementById('frBack').onclick=()=>{view='jobs';job='';render()};document.getElementById('frSetup').onclick=setup;
  sec.querySelectorAll('[data-nt]').forEach(b=>b.onclick=()=>newR(b.dataset.nt))}
function sumOf(r){const d=r.data||{};switch(r.type){case'ts':{const h=(d.rows||[]).reduce((a,x)=>a+DAYS.reduce((s,_,i)=>s+(Number(x.d?.[i]?.h)||0)+(Number(x.d?.[i]?.h2)||0),0),0);return 'Week of '+md(r.date)+' · '+(d.rows||[]).filter(x=>x.name).length+' crew · '+h+' hrs'}
  case'tm':return (d.labor||[]).filter(x=>x.name).length+' labor · '+(d.mat||[]).filter(x=>x.item).length+' material'+(d.labor?.[0]?.desc?' · '+d.labor[0].desc:'');
  case'daily':return (d.work||'').slice(0,60);case'obs':return [d.worker,d.cat].filter(Boolean).join(' · ');case'leak':return (d.items||[]).length+' location(s)';case'acc':return [d.injured,d.nature].filter(Boolean).join(' · ')}return''}
function setup(){const c=jcfg(job);const ph=phases(job).join('\n'),se=sections(job).join('\n');
  document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>Job setup · ${esc(jobLabel(job))}</h3><p class="muted">These lists show up as choices on the timesheet. One per line.</p>
   <div class="fields"><label class="f">Sections (LN letters A, B, C…)<textarea id="suS" rows="8" placeholder="Bldg I - Tile&#10;Bldg I - PVC">${esc(se)}</textarea></label><label class="f">Phases (LN 1, 2, 3…)<textarea id="suP" rows="8">${esc(ph)}</textarea></label>
   <label class="f">Contract No.<input id="suC" value="${esc(c.contract||'')}"></label><label class="f">Foreman<input id="suF" list="frFm" value="${esc(c.foreman||'')}"><datalist id="frFm">${crewNames(['FM','SFM']).map(n=>`<option value="${esc(n)}">`).join('')}</datalist></label></div>
   <div class="bar"><button class="btn" id="suX">Cancel</button><button class="go" id="suOk" style="width:auto">Save</button></div></div></div>`;
  document.getElementById('suX').onclick=closeDlg;document.getElementById('suOk').onclick=async()=>{const lines=id=>document.getElementById(id).value.split('\n').map(x=>x.trim()).filter(Boolean);
    await db.doc('fjobs/'+jkey(job)).set({...c,job,sections:lines('suS'),phases:lines('suP'),contract:document.getElementById('suC').value.trim(),foreman:document.getElementById('suF').value.trim()});closeDlg();toast('Job setup saved')}}
/* ---------------- new / open ---------------- */
function blank(t){const c=jcfg(job);switch(t){
  case'ts':{const fm=c.foreman||(crew.find(x=>x.name===curUser&&['FM','SFM'].includes(x.role))?curUser:'');const last=R.filter(r=>r.job===job&&r.type==='ts').sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
    const names=last?(last.data.rows||[]).map(x=>x.name).filter(Boolean):(fm?[fm]:[]);
    return {date:monday(),data:{foreman:fm,days:DAYS.slice(0,5).map(()=>({start:'7:00',ms:'11:00',mf:'12:00',end:'4:00',note:''})),rows:[...names.map(n=>({name:n,d:[]})),{name:'',d:[]}]}}}
  case'tm':return {date:today(),data:{contract:c.contract||'',labor:[{date:today(),name:'',hrs:8,desc:''}],mat:[{date:today(),item:'',qty:'',price:''}],eq:[{date:today(),item:'',hrs:'',rate:''}],cname:(typeof msAcct!=='undefined'&&msAcct)||curUser,ctitle:'Project Manager'}};
  case'daily':return {date:today(),data:{weather:'',temp:'',crew:'',hours:'',work:'',deliv:'',equip:'',issues:'',visitors:'',photos:[]}};
  case'obs':return {date:today(),data:{time:'',worker:'',observer:curUser,cat:'Fall protection',desc:'',action:'Verbal warning',followup:'',photos:[]}};
  case'leak':return {date:today(),data:{items:[{date:today(),issue:'',loc:'',reason:'',note:'',photos:[]}]}};
  case'acc':return {date:today(),data:{time:'',addr:jobs.find(j=>j.no===job)?.address||'',reporter:curUser,rtitle:'',injured:'',iaddr:'',ititle:'',nature:'',treated:'',contact:'',agencies:'',desc:'',altered:'No',serious:false,calosha:'',witness:'',photos:[]}}}}
function newR(t){type=t;rid='';W={type:t,job,status:'draft',...blank(t)};view='edit';dirty=false;render();scrollTo({top:0})}
function openR(id){const r=R.find(x=>x._id===id);if(!r)return;rid=id;type=r.type;W=JSON.parse(JSON.stringify(r));delete W._id;view='edit';dirty=false;render();scrollTo({top:0})}
/* ---------------- editor ---------------- */
const inp=(k,v,o={})=>`<input data-k="${k}" value="${esc(v??'')}" ${o.type?`type="${o.type}"`:''} ${o.ph?`placeholder="${esc(o.ph)}"`:''} ${o.list?`list="${o.list}"`:''} ${o.im?`inputmode="${o.im}"`:''} style="${o.w?'width:'+o.w:''}">`;
const fld=(l,k,v,o={})=>`<label class="f ${o.wide?'wide':''}">${l}${o.ta?`<textarea data-k="${k}" rows="${o.rows||3}" placeholder="${esc(o.ph||'')}">${esc(v||'')}</textarea>`:o.sel?`<select data-k="${k}">${o.sel.map(x=>`<option ${x===v?'selected':''}>${esc(x)}</option>`).join('')}</select>`:inp(k,v,o)}</label>`;
function photoBlock(path,list){return `<div class="frph">${(list||[]).map((p,i)=>`<figure><img src="${esc(p.url)}" alt=""><input data-k="${path}.${i}.cap" placeholder="Caption" value="${esc(p.cap||'')}"><button type="button" class="btn small" data-phx="${path}|${i}">×</button></figure>`).join('')}<button type="button" class="frphadd" data-pha="${path}">+ Photo</button></div>`}
function renderEdit(){const t=T[W.type];const d=W.data;let body='';
  if(W.type==='ts'){const ph=phases(job),se=sections(job);const nd=d.days.length;
    body=`<div class="fields">${fld('Week starting (Mon)','date',W.date,{type:'date'})}${fld('Foreman','data.foreman',d.foreman,{list:'frCrew'})}</div>
     <datalist id="frCrew">${crewNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
     <div class="frlegend"><div><b>Sections</b>${se.length?se.map((s,i)=>`<span>${String.fromCharCode(65+i)} · ${esc(s)}</span>`).join(''):'<span class="muted">none — set in Job setup</span>'}</div><div><b>Phases</b>${ph.map((p,i)=>`<span>${i+1} · ${esc(p)}</span>`).join('')}</div></div>
     <div class="tblwrap"><table class="tstbl"><thead><tr><th>Date</th>${d.days.map((_,i)=>`<th colspan="3">${DAYS[i]} ${md(addD(W.date,i))}</th>`).join('')}</tr>
     ${[['start','Job start'],['ms','Meal start'],['mf','Meal finish'],['end','Job finish']].map(([k,l])=>`<tr><th>${l}</th>${d.days.map((x,i)=>`<td colspan="3">${inp(`data.days.${i}.${k}`,x[k],{w:'100%'})}</td>`).join('')}</tr>`).join('')}
     <tr><th>Name</th>${d.days.map(()=>'<th>Hrs</th><th>Phase</th><th>Sec</th>').join('')}</tr></thead><tbody>
     ${d.rows.map((r,ri)=>`<tr><td class="tsn">${inp(`data.rows.${ri}.name`,r.name,{list:'frCrew',ph:'Name'})}${r.name?`<button type="button" class="tsx" data-rx="${ri}" title="Remove">×</button>`:''}</td>${d.days.map((_,i)=>{const c=(r.d||[])[i]||{};return `<td>${inp(`data.rows.${ri}.d.${i}.h`,c.h,{im:'decimal',w:'44px'})}${c.h2!==undefined||c.p2?inp(`data.rows.${ri}.d.${i}.h2`,c.h2,{im:'decimal',w:'44px'}):''}</td><td>${inp(`data.rows.${ri}.d.${i}.p`,c.p,{im:'numeric',w:'44px'})}${c.h2!==undefined||c.p2?inp(`data.rows.${ri}.d.${i}.p2`,c.p2,{im:'numeric',w:'44px'}):''}</td><td>${inp(`data.rows.${ri}.d.${i}.s`,c.s,{w:'40px'})}${c.h2!==undefined||c.p2?inp(`data.rows.${ri}.d.${i}.s2`,c.s2,{w:'40px'}):`<button type="button" class="tssplit" data-sp="${ri}|${i}" title="Split the day into 2 phases">+</button>`}</td>`}).join('')}</tr>`).join('')}
     <tr><th>Delivery / note</th>${d.days.map((x,i)=>`<td colspan="3">${inp(`data.days.${i}.note`,x.note,{w:'100%'})}</td>`).join('')}</tr>
     <tr><th>Total hrs</th>${d.days.map((_,i)=>`<td colspan="3" class="n"><b>${d.rows.reduce((a,r)=>a+(Number(r.d?.[i]?.h)||0)+(Number(r.d?.[i]?.h2)||0),0)||''}</b></td>`).join('')}</tr></tbody></table></div>
     <div class="bar" style="justify-content:flex-start"><button type="button" class="btn" id="tsAddRow">+ Add crew</button>${nd<6?'<button type="button" class="btn" id="tsSat">+ Saturday</button>':''}<span class="muted">Phase = LN number, Section = letter. Use “+” in a cell to log two phases that day.</span></div>`}
  else if(W.type==='tm'){const row=(arr,k,cols)=>`<table class="frtbl"><thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>${d[k].map((r,i)=>`<tr>${cols.map(([ck,_,o])=>`<td>${inp(`data.${k}.${i}.${ck}`,r[ck],o||{})}</td>`).join('')}<td><button type="button" class="btn small" data-tx="${k}|${i}">×</button></td></tr>`).join('')}</tbody></table><button type="button" class="btn small" data-ta="${k}">+ Add line</button>`;
    body=`<div class="fields">${fld('Report date','date',W.date,{type:'date'})}${fld('Contract No.','data.contract',d.contract)}</div>
     <h4>Labor</h4>${row(d.labor,'labor',[['date','Date',{type:'date'}],['name','Employee',{list:'frCrew'}],['hrs','Hours',{im:'decimal',w:'70px'}],['desc','Work description']])}
     <h4>Material</h4>${row(d.mat,'mat',[['date','Date',{type:'date'}],['item','Material used'],['qty','Qty',{w:'70px'}],['price','Unit price',{im:'decimal',w:'90px'}]])}
     <h4>Equipment</h4>${row(d.eq,'eq',[['date','Date',{type:'date'}],['item','Equipment used'],['hrs','Operation hrs',{im:'decimal',w:'80px'}],['rate','Rate',{im:'decimal',w:'80px'}]])}
     <datalist id="frCrew">${crewNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
     <h4>Certification</h4><div class="fields">${fld('Name','data.cname',d.cname)}${fld('Title','data.ctitle',d.ctitle)}</div>`}
  else if(W.type==='daily'){body=`<div class="fields">${fld('Date','date',W.date,{type:'date'})}${fld('Weather','data.weather',d.weather,{sel:['','Sunny','Cloudy','Windy','Rain','Hot','Cold']})}${fld('Temp (°F)','data.temp',d.temp,{im:'numeric'})}${fld('Crew count','data.crew',d.crew,{im:'numeric'})}${fld('Total hours','data.hours',d.hours,{im:'decimal'})}
     ${fld('Work performed','data.work',d.work,{ta:1,wide:1,rows:4})}${fld('Deliveries','data.deliv',d.deliv,{ta:1,wide:1,rows:2})}${fld('Equipment on site','data.equip',d.equip,{ta:1,wide:1,rows:2})}${fld('Issues / delays','data.issues',d.issues,{ta:1,wide:1,rows:2})}${fld('Visitors / inspections','data.visitors',d.visitors,{ta:1,wide:1,rows:2})}</div><h4>Photos</h4>${photoBlock('data.photos',d.photos)}`}
  else if(W.type==='obs'){body=`<div class="fields">${fld('Date','date',W.date,{type:'date'})}${fld('Time','data.time',d.time,{type:'time'})}${fld('Worker','data.worker',d.worker,{list:'frCrew'})}${fld('Observed by','data.observer',d.observer,{list:'frCrew'})}
     ${fld('Category','data.cat',d.cat,{sel:['Fall protection','PPE (hard hat, glasses, gloves, vest)','Ladder use','Housekeeping','Hot work / torch','Hand & power tools','Material handling','Roof edge / openings','Other']})}${fld('Action taken','data.action',d.action,{sel:['Verbal warning','Written warning','Retrained on site','Sent home','Other']})}
     ${fld('What was observed','data.desc',d.desc,{ta:1,wide:1,rows:4})}${fld('Follow-up / correction','data.followup',d.followup,{ta:1,wide:1,rows:2})}</div><datalist id="frCrew">${crewNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist><h4>Photos</h4>${photoBlock('data.photos',d.photos)}`}
  else if(W.type==='leak'){body=`<div class="fields">${fld('Report date','date',W.date,{type:'date'})}</div>${d.items.map((x,i)=>`<div class="panel frleak"><div style="display:flex;align-items:center"><h4 style="margin:0;flex:1">(${i+1}) Location</h4>${d.items.length>1?`<button type="button" class="btn small dng" data-lx="${i}">Remove</button>`:''}</div>
     <div class="fields">${fld('Date reported','data.items.'+i+'.date',x.date,{type:'date'})}${fld('Location','data.items.'+i+'.loc',x.loc,{ph:'Bldg G - Lower Roof, Section B (center drain)'})}${fld('Issue reported','data.items.'+i+'.issue',x.issue,{ta:1,wide:1,rows:2})}${fld('Findings / reason','data.items.'+i+'.reason',x.reason,{ta:1,wide:1,rows:3})}${fld('Note / next step','data.items.'+i+'.note',x.note,{ta:1,wide:1,rows:2})}</div>${photoBlock('data.items.'+i+'.photos',x.photos)}</div>`).join('')}<button type="button" class="btn" id="lkAdd">+ Add another location</button>`}
  else if(W.type==='acc'){body=`${d.serious?`<div class="banner frwarn"><b>Serious injury — call Cal/OSHA immediately (no later than 8 hours).</b><br>Santa Ana Regional Office (714) 558-4300 · Monrovia Regional Office (626) 471-9122 · or online at dir.ca.gov/dosh/report-accident-or-injury.html. File Form 5020 as well.</div>`:''}
     <div class="fields">${fld('Date of accident','date',W.date,{type:'date'})}${fld('Time','data.time',d.time,{type:'time'})}${fld('Address of accident','data.addr',d.addr,{wide:1})}
     <label class="f wide frchk"><input type="checkbox" data-k="data.serious" ${d.serious?'checked':''}> Serious injury (hospitalized &gt;24 hrs, amputation, loss of an eye, permanent disfigurement, or death)</label>
     ${fld('Injured employee','data.injured',d.injured,{list:'frCrew'})}${fld('Job title','data.ititle',d.ititle)}${fld('Employee address','data.iaddr',d.iaddr,{wide:1})}${fld('Nature of injuries','data.nature',d.nature,{ta:1,wide:1,rows:2})}
     ${fld('Taken for treatment to','data.treated',d.treated,{wide:1})}${fld('Contact person at site','data.contact',d.contact)}${fld('Witnesses','data.witness',d.witness)}${fld('Other agencies present','data.agencies',d.agencies,{wide:1})}
     ${fld('What happened','data.desc',d.desc,{ta:1,wide:1,rows:5})}${fld('Scene / equipment altered?','data.altered',d.altered,{sel:['No','Yes']})}${fld('Cal/OSHA report (date, office, ref #)','data.calosha',d.calosha)}
     ${fld('Reported by','data.reporter',d.reporter)}${fld('Reporter title','data.rtitle',d.rtitle)}</div><datalist id="frCrew">${crewNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist><h4>Photos</h4>${photoBlock('data.photos',d.photos)}`}
  sec.innerHTML=`<div class="mplhead"><button class="btn" id="frEB">← ${esc(jobLabel(job))}</button><h2 style="color:${t.c}">${t.n}</h2><span class="mtop"><button class="btn" id="frPdf">PDF</button>${rid?'<button class="btn dng" id="frDel">Delete</button>':''}</span></div>
   <div class="panel frform">${body}</div>
   <div class="mplbar"><span class="mplsv" id="frSv">${dirty?'Unsaved changes':rid?'Saved':''}</span><button class="btn" id="frSave">Save draft</button><button class="go" id="frFinal" style="width:auto">${W.status==='final'?'Save':'Finish &amp; save'}</button></div>`;
  wire()}
function setPath(o,p,v){const k=p.split('.');let x=o;for(let i=0;i<k.length-1;i++){const n=/^\d+$/.test(k[i+1]);if(x[k[i]]==null)x[k[i]]=n?[]:{};x=x[k[i]]}x[k[k.length-1]]=v}
function getPath(o,p){return p.split('.').reduce((x,k)=>x==null?x:x[k],o)}
function wire(){sec.querySelectorAll('[data-k]').forEach(i=>{const ev=i.type==='checkbox'||i.tagName==='SELECT'?'change':'input';i.addEventListener(ev,()=>{setPath(W,i.dataset.k,i.type==='checkbox'?i.checked:i.value);dirty=true;const s=document.getElementById('frSv');if(s)s.textContent='Unsaved changes';if(i.type==='checkbox')rerender()});if(W.type==='ts'&&/\.h2?$/.test(i.dataset.k))i.addEventListener('change',()=>rerender())});
  const rerender=()=>{const y=scrollY;renderEdit();scrollTo(0,y)};
  document.getElementById('frEB').onclick=()=>{if(dirty&&!confirm('Leave without saving?'))return;dirty=false;view='job';W=null;render()};
  document.getElementById('frSave').onclick=()=>save(W.status==='final'?'final':'draft');document.getElementById('frFinal').onclick=()=>save('final',true);
  document.getElementById('frPdf').onclick=()=>pdf({...W,_id:rid});
  const del=document.getElementById('frDel');if(del)del.onclick=async()=>{if(!confirm('Delete this report?'))return;await db.doc('freports/'+rid).delete();dirty=false;view='job';W=null;render()};
  const d=W.data;
  const ar=document.getElementById('tsAddRow');if(ar)ar.onclick=()=>{d.rows.push({name:'',d:[]});dirty=true;rerender()};
  const sat=document.getElementById('tsSat');if(sat)sat.onclick=()=>{d.days.push({...d.days[d.days.length-1],note:''});dirty=true;rerender()};
  sec.querySelectorAll('[data-rx]').forEach(b=>b.onclick=()=>{d.rows.splice(+b.dataset.rx,1);dirty=true;rerender()});
  sec.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{const [r,i]=b.dataset.sp.split('|').map(Number);const row=d.rows[r];row.d=row.d||[];row.d[i]={...(row.d[i]||{}),h2:''};dirty=true;rerender()});
  sec.querySelectorAll('[data-ta]').forEach(b=>b.onclick=()=>{d[b.dataset.ta].push({date:W.date});dirty=true;rerender()});
  sec.querySelectorAll('[data-tx]').forEach(b=>b.onclick=()=>{const [k,i]=b.dataset.tx.split('|');d[k].splice(+i,1);dirty=true;rerender()});
  const la=document.getElementById('lkAdd');if(la)la.onclick=()=>{d.items.push({date:today(),issue:'',loc:'',reason:'',note:'',photos:[]});dirty=true;rerender()};
  sec.querySelectorAll('[data-lx]').forEach(b=>b.onclick=()=>{if(!confirm('Remove this location?'))return;d.items.splice(+b.dataset.lx,1);dirty=true;rerender()});
  sec.querySelectorAll('[data-phx]').forEach(b=>b.onclick=()=>{const [p,i]=b.dataset.phx.split('|');getPath(W,p).splice(+i,1);dirty=true;rerender()});
  sec.querySelectorAll('[data-pha]').forEach(b=>b.onclick=()=>{const p=b.dataset.pha;const f=document.createElement('input');f.type='file';f.accept='image/*';f.multiple=true;f.onchange=async()=>{const as=await window.claude.use('assets');for(const x of f.files){try{toast('Uploading photo…');const r=await as.upload(await shrink(x));let arr=getPath(W,p);if(!arr){setPath(W,p,[]);arr=getPath(W,p)}arr.push({url:r.url,cap:''})}catch(e){toast('Could not upload: '+(e.message||e))}}dirty=true;rerender()};f.click()})}
async function save(status,leave){const now=new Date().toISOString();const doc={...W,job,status,by:W.by||curUser,at:W.at||now,updated:now,updatedBy:curUser};const id=rid||('r'+Date.now().toString(36)+Math.random().toString(36).slice(2,5));
  try{await db.doc('freports/'+id).set(doc);rid=id;W=doc;dirty=false;toast(status==='final'?'Report saved':'Draft saved');if(leave){view='job';W=null}render()}catch(e){toast('Could not save: '+(e.message||e))}}
(window.ameSaveHooks=window.ameSaveHooks||[]).push(async()=>{if(AME.cur==='field'&&view==='edit'&&W&&dirty)await save(W.status||'draft')});
window.addEventListener('beforeunload',e=>{if(AME.cur==='field'&&dirty){e.preventDefault();e.returnValue=''}});
/* ---------------- PDF ---------------- */
function lib(src){return new Promise((ok,no)=>{if(document.querySelector(`script[src="${src}"]`))return ok();const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
async function imgData(url){try{let b;if(String(url).startsWith('sp:')){const f=await window.claude.use('files');b=await f.get(url.slice(3))}else b=await (await fetch(url)).blob();
  return await new Promise(r=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>r({d:fr.result,w:im.width,h:im.height});im.onerror=()=>r(null);im.src=fr.result};fr.readAsDataURL(b)})}catch(e){return null}}
async function pdf(r){if(!r)return;try{await lib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');await lib('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')}catch(e){toast('PDF library did not load.');return}
  toast('Building PDF…');const {jsPDF}=window.jspdf;const land=r.type==='ts'||r.type==='leak';const D=new jsPDF({unit:'pt',format:'letter',orientation:land?'landscape':'portrait'});const W2=D.internal.pageSize.getWidth();const d=r.data||{};
  const mono={theme:'grid',styles:{fontSize:8.5,textColor:20,lineColor:110,lineWidth:.4,cellPadding:3},headStyles:{fillColor:235,textColor:0,fontStyle:'bold',lineWidth:.6}};
  const head=(title)=>{D.setFont('helvetica','bold');D.setFontSize(15);D.text(title,40,40);D.setFontSize(9);D.setFont('helvetica','normal');D.text('AME Builders, Inc.',W2-40,40,{align:'right'});D.text('Project: '+jobLabel(r.job),40,58);return 72};
  let y;const kv=(rows,startY)=>{D.autoTable({...mono,startY,body:rows.filter(x=>x[1]!==undefined),columnStyles:{0:{fontStyle:'bold',cellWidth:150,fillColor:245}},theme:'grid'});return D.lastAutoTable.finalY+12};
  const photos=async(list,startY,label)=>{const L=(list||[]).filter(p=>p&&p.url);if(!L.length)return startY;let x=40,yy=startY;const cw=land?170:160,ch=120;if(label){D.setFont('helvetica','bold');D.text(label,40,yy);D.setFont('helvetica','normal');yy+=10}
    for(const p of L){const im=await imgData(p.url);if(yy+ch+24>D.internal.pageSize.getHeight()-30){D.addPage();yy=40;x=40}if(im){const sc=Math.min(cw/im.w,ch/im.h);D.addImage(im.d,'JPEG',x,yy,im.w*sc,im.h*sc)}D.setFontSize(7.5);D.text(D.splitTextToSize(p.cap||'',cw),x,yy+ch+10);D.setFontSize(9);x+=cw+12;if(x+cw>W2-30){x=40;yy+=ch+28}}return yy+ch+30};
  if(r.type==='ts'){y=head("Foreman's Time Sheet");D.text('Foreman: '+(d.foreman||''),40,y);D.text('Week of '+md(r.date),W2-40,y,{align:'right'});y+=8;const nd=d.days.length;
    const hd=[[{content:'Date',styles:{halign:'left'}},...d.days.map((_,i)=>({content:DAYS[i]+' '+md(addD(r.date,i)),colSpan:3,styles:{halign:'center'}}))]];
    const tm=[['start','Job Start'],['ms','Meal Start'],['mf','Meal Finish'],['end','Job Finish']].map(([k,l])=>[{content:l,styles:{fontStyle:'bold'}},...d.days.map(x=>({content:x[k]||'',colSpan:3,styles:{halign:'center'}}))]);
    const nh=[{content:'Name',styles:{fontStyle:'bold'}},...d.days.flatMap(()=>[{content:'Hrs',styles:{fontStyle:'bold'}},{content:'Ph',styles:{fontStyle:'bold'}},{content:'Sec',styles:{fontStyle:'bold'}}])];
    const rows=(d.rows||[]).filter(x=>x.name).map(x=>[x.name,...d.days.flatMap((_,i)=>{const c=(x.d||[])[i]||{};const two=(a,b)=>[a,b].filter(v=>v!==undefined&&v!=='').join('\n');return [two(c.h,c.h2),two(c.p,c.p2),two(c.s,c.s2)]})]);
    const tot=[{content:'Total hrs',styles:{fontStyle:'bold'}},...d.days.map((_,i)=>({content:String((d.rows||[]).reduce((a,x)=>a+(Number(x.d?.[i]?.h)||0)+(Number(x.d?.[i]?.h2)||0),0)||''),colSpan:3,styles:{halign:'center',fontStyle:'bold'}}))];
    const nt=[{content:'Delivery / Note',styles:{fontStyle:'bold'}},...d.days.map(x=>({content:x.note||'',colSpan:3}))];
    D.autoTable({...mono,startY:y,head:hd,body:[...tm,nh,...rows,nt,tot],styles:{...mono.styles,halign:'center',fontSize:8},columnStyles:{0:{halign:'left',cellWidth:100}}});
    y=D.lastAutoTable.finalY+14;const ph=phases(r.job),se=sections(r.job);D.setFontSize(7.5);D.text('Sections: '+(se.map((s,i)=>String.fromCharCode(65+i)+' '+s).join('   ')||'—'),40,y);y+=11;D.text(D.splitTextToSize('Phases: '+ph.map((p,i)=>(i+1)+' '+p).join('   '),W2-80),40,y)}
  else if(r.type==='tm'){y=head('TIME & MATERIAL REPORT');y=kv([['Project name',jobLabel(r.job)],['Project no.',String(r.job).replace('#','')],['Contract no.',d.contract||''],['Report date',md(r.date)]],y);
    const money=v=>v===''||v==null||isNaN(+v)?'':'$'+(+v).toFixed(2);
    D.autoTable({...mono,startY:y,head:[['Date','Name of employee','Hours worked','Work description']],body:(d.labor||[]).filter(x=>x.name).map(x=>[md(x.date),x.name,x.hrs,x.desc])});y=D.lastAutoTable.finalY+10;
    D.autoTable({...mono,startY:y,head:[['Date','Material used','Quantity','Unit price','Total']],body:(d.mat||[]).filter(x=>x.item).map(x=>[md(x.date),x.item,x.qty,money(x.price),money(+x.qty*+x.price)])});y=D.lastAutoTable.finalY+10;
    D.autoTable({...mono,startY:y,head:[['Date','Equipment used','Operation hrs','Rate','Total']],body:(d.eq||[]).filter(x=>x.item).map(x=>[md(x.date),x.item,x.hrs,money(x.rate),money(+x.hrs*+x.rate)])});y=D.lastAutoTable.finalY+20;
    D.setFont('helvetica','bold');D.text('I CERTIFY THAT THE ABOVE WORK WAS PERFORMED AND THE QUANTITIES ARE CORRECT AS LISTED',40,y);D.setFont('helvetica','normal');y+=20;
    [['NAME:',d.cname],['TITLE:',d.ctitle],['SIGNATURE:',''],['APPROVED**:','']].forEach(([k,v])=>{D.text(k,40,y);D.text(String(v||''),130,y);D.line(125,y+3,400,y+3);y+=22});D.setFontSize(8);D.text('** If no response is received in 48 hrs, this T&M will be deemed to be accepted and billed accordingly.',40,y+4)}
  else if(r.type==='daily'){y=head('DAILY REPORT');y=kv([['Date',md(r.date)],['Weather',[d.weather,d.temp?d.temp+'°F':''].filter(Boolean).join(' · ')],['Crew / hours',[d.crew?d.crew+' crew':'',d.hours?d.hours+' hrs':''].filter(Boolean).join(' · ')],['Work performed',d.work],['Deliveries',d.deliv],['Equipment on site',d.equip],['Issues / delays',d.issues],['Visitors / inspections',d.visitors],['Prepared by',r.by]],y);y=await photos(d.photos,y,'Photos')}
  else if(r.type==='obs'){y=head('SAFETY OBSERVATION REPORT');y=kv([['Date / time',md(r.date)+(d.time?' '+d.time:'')],['Worker',d.worker],['Observed by',d.observer],['Category',d.cat],['What was observed',d.desc],['Action taken',d.action],['Follow-up / correction',d.followup]],y);y=await photos(d.photos,y,'Photos');
    if(y>D.internal.pageSize.getHeight()-90){D.addPage();y=60}y+=20;[['Worker signature'],['Supervisor signature']].forEach(([l],i)=>{D.line(40+i*270,y,280+i*270,y);D.setFontSize(8);D.text(l,40+i*270,y+11)})}
  else if(r.type==='leak'){y=head('ROOF LEAK REPORT');D.text('Report date: '+md(r.date),W2-40,58,{align:'right'});
    for(const [i,x] of (d.items||[]).entries()){if(y>D.internal.pageSize.getHeight()-120){D.addPage();y=40}
      D.autoTable({...mono,startY:y,head:[['#','Date','Issue','Location','Findings / reason']],body:[[`(${i+1})`,md(x.date),x.issue,x.loc,x.reason+(x.note?'\n\nNote: '+x.note:'')]],columnStyles:{0:{cellWidth:28},1:{cellWidth:56},2:{cellWidth:170},3:{cellWidth:140}}});y=D.lastAutoTable.finalY+8;
      y=await photos((x.photos||[]).map((p,k)=>({...p,cap:`${i+1}-(${k+1}) `+(p.cap||'')})),y)}}
  else if(r.type==='acc'){y=head('ACCIDENT / INCIDENT REPORT');if(d.serious){D.setTextColor(180,0,0);D.setFont('helvetica','bold');D.text('SERIOUS INJURY — report to Cal/OSHA within 8 hours; file Form 5020.',40,y);D.setTextColor(0);D.setFont('helvetica','normal');y+=14}
    y=kv([['Date / time',md(r.date)+(d.time?' '+d.time:'')],['Address of accident',d.addr],['Reported by',[d.reporter,d.rtitle].filter(Boolean).join(', ')],['Contact at site',d.contact],['Injured employee',[d.injured,d.ititle].filter(Boolean).join(', ')],['Employee address',d.iaddr],['Nature of injuries',d.nature],['Taken for treatment to',d.treated],['Other agencies present',d.agencies],['Witnesses',d.witness],['What happened',d.desc],['Scene / equipment altered',d.altered],['Cal/OSHA report',d.calosha],['Serious injury',d.serious?'YES':'No']],y);y=await photos(d.photos,y,'Photos')}
  const n=D.internal.getNumberOfPages();for(let i=1;i<=n;i++){D.setPage(i);D.setFontSize(7.5);D.setTextColor(120);D.text(`${T[r.type].n} · ${jobLabel(r.job)} · ${md(r.date)} · page ${i} of ${n}`,40,D.internal.pageSize.getHeight()-16);D.setTextColor(0)}
  const jn=String(r.job).replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'');const name=`${T[r.type].n.replace(/[^A-Za-z]+/g,'_')}_${jn}_${r.date}.pdf`;const blob=D.output('blob');
  try{const dl=await window.claude.use('downloads');await dl.save({filename:name,data:blob})}catch(e){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click()}
  try{const f=await window.claude.use('files');f.save('reports/field/'+jn+'/'+name,blob).catch(()=>{})}catch(e){}}
AME.register({id:'field',beta:true,name:'Field Reports',desc:'Timesheets · T&M · daily · safety · leak · accident',tabs:['field'],section:'tab-field',
  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v3H9z"/><path d="M7 5H5v16h14V5h-2"/><path d="M8 11h8M8 15h8M8 19h5"/></svg>',
  open:()=>{if(!(view==='edit'&&dirty)){view=job?'job':'jobs'}showTab('field')},onShow:render});
const _ar=window.applyRole;window.applyRole=function(){_ar();const b=document.querySelector('nav.tabs [data-tab="field"]');if(b)b.hidden=!AME.allowed(AME.mod('field'))};
document.head.insertAdjacentHTML('beforeend',`<style>
.frtypes{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}.frtype{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:16px;border-radius:14px;border:1px solid var(--line);border-top:4px solid var(--c);background:var(--panel);color:inherit;font:inherit;text-align:left;cursor:pointer}.frtype b{font-size:17px}.frtype small{opacity:.7}.fric{width:30px;height:30px;color:var(--c)}.fric svg{width:100%;height:100%}.frn{margin-top:6px;font-size:12px;font-weight:700;color:var(--c)}
.frform h4{margin:16px 0 6px}.frtbl{width:100%;border-collapse:collapse}.frtbl td,.frtbl th{padding:3px;text-align:left}.frtbl input{width:100%}
.tstbl{border-collapse:collapse;font-size:13px}.tstbl th,.tstbl td{border:1px solid var(--line);padding:2px;text-align:center;white-space:nowrap}.tstbl th:first-child,.tstbl td:first-child{text-align:left;position:sticky;left:0;background:var(--panel);z-index:1}.tstbl input{padding:5px 4px;font-size:14px;text-align:center;min-width:0;display:block;margin:1px 0}.tsn{display:flex;align-items:center;gap:2px}.tsn input{width:130px;text-align:left}.tsx,.tssplit{border:0;background:none;color:var(--muted);cursor:pointer;font-size:15px;padding:0 3px}
.frlegend{display:grid;grid-template-columns:1fr 2fr;gap:10px;margin:8px 0 12px;font-size:12px}.frlegend div{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}.frlegend b{width:100%}.frlegend span{opacity:.8}
.frph{display:flex;flex-wrap:wrap;gap:10px;margin:6px 0}.frph figure{margin:0;width:150px;display:flex;flex-direction:column;gap:4px;position:relative}.frph img{width:150px;height:110px;object-fit:cover;border-radius:8px}.frph figure .btn{position:absolute;top:4px;right:4px}.frphadd{width:150px;height:110px;border:2px dashed var(--line);border-radius:8px;background:none;color:inherit;font:inherit;cursor:pointer}
.frleak{margin:10px 0}.frchk{flex-direction:row!important;align-items:center;gap:8px}.frwarn{background:rgba(196,60,60,.18);border:1px solid #c43c3c;padding:10px 12px;border-radius:10px;margin-bottom:12px}
@media(max-width:600px){.frlegend{grid-template-columns:1fr}}
</style>`);
})();
