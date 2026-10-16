/* AME — Equipment Price Tracker (rental quotes by vendor) */
(function(){
let Q=[],VEN={},view='cmp',cat='',days=7,qf='',editId='';
const el=()=>document.getElementById('tab-eqp');
const money=v=>v==null||v===''?'—':(typeof v==='number'?'$'+v.toLocaleString(undefined,{maximumFractionDigits:2}):esc(String(v)));
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const fixType=s=>clean(s).replace(/^Telehander$/i,'Telehandler').replace(/Deisel/gi,'Diesel');
const num=v=>{if(v==null||v==='')return null;const n=Number(String(v).replace(/[$,]/g,''));return isFinite(n)?n:null};
const canEdit=()=>isAdmin||can('EQP');
function spec(q){return [q.lbs?q.lbs+'K lbs':'',q.size?q.size+"'":'',q.kw?q.kw+' kW':'',q.option||''].filter(Boolean).join(' · ')}
function key(q){return [q.cat,q.lbs||'',q.size||'',q.kw||'',(q.option||'').toLowerCase()].join('|')}
function load(){db.collection('eqp').onSnapshot(s=>{Q=s.docs.map(d=>({...d.data(),_id:d.id}));if(isOn())render()},()=>{});
  db.doc('config/eqvendors').onSnapshot(s=>{VEN=s.data()||{};if(isOn())render()},()=>{})}
const isOn=()=>el()&&!el().hidden;

/* best cost for N days from day / week / 4-week rates */
function bestCost(q,D){const d=num(q.day),w=num(q.week),m=num(q.m4),mo=num(q.month);if(mo!=null&&d==null&&w==null&&m==null)return {cost:Math.ceil(D/30)*mo,how:Math.ceil(D/30)+' mo'};
  let best=null,how='';for(let k=0;k<=Math.ceil(D/28);k++){if(k&&m==null)break;const r1=D-28*k;for(let j=0;j<=Math.max(0,Math.ceil(r1/7));j++){if(j&&w==null)break;const r2=Math.max(0,r1-7*j);if(r2&&d==null)continue;
    const c=(k?k*m:0)+(j?j*w:0)+(r2?r2*d:0);if(best==null||c<best){best=c;how=[k?k+'×4wk':'',j?j+'×wk':'',r2?r2+'×day':''].filter(Boolean).join(' + ')}}}
  return best==null?null:{cost:best,how}}
function delivFor(q){const v=VEN[q.vendor]||{};const dl=num(q.deliv)??num(v.deliv)??0,pk=num(q.pick)??num(v.pick)??0;return dl+pk}

/* ---------- views ---------- */
function render(){const box=el();if(!box)return;
  box.innerHTML=`<div class="mplhead"><h2>Equipment Prices</h2>${canEdit()?'<button class="btn pri" id="eqAdd">+ Add quote</button>':''}</div>
   <div class="viewseg eqseg"><button data-ev="cmp" aria-pressed="${view==='cmp'}">Compare</button><button data-ev="list" aria-pressed="${view==='list'}">All quotes</button><button data-ev="ven" aria-pressed="${view==='ven'}">Vendors</button></div>
   <div id="eqBody"></div>`;
  box.querySelectorAll('[data-ev]').forEach(b=>b.onclick=()=>{view=b.dataset.ev;render()});
  const a=document.getElementById('eqAdd');if(a)a.onclick=()=>openQuote('');
  if(!Q.length){document.getElementById('eqBody').innerHTML=`<div class="panel"><p>No prices yet.</p>${canEdit()?'<p><button class="btn pri" id="eqImp">Import from Excel</button> <span class="muted">— pick your “Equipment Price Tracking” workbook</span></p>':''}</div>`;wireImp();return}
  if(view==='cmp')renderCmp();else if(view==='list')renderList();else renderVen()}
function cats(){const m={};Q.forEach(q=>m[q.cat]=(m[q.cat]||0)+1);return Object.keys(m).sort((a,b)=>a.localeCompare(b)).map(c=>[c,m[c]])}
function renderCmp(){const cs=cats();if(!cat||!cs.some(c=>c[0]===cat))cat=cs[0][0];
  const qs=Q.filter(q=>q.cat===cat);const groups={};qs.forEach(q=>(groups[key(q)]=groups[key(q)]||[]).push(q));
  const keys=Object.keys(groups).sort((a,b)=>{const qa=groups[a][0],qb=groups[b][0];return (num(qa.lbs)||0)-(num(qb.lbs)||0)||(num(qa.size)||0)-(num(qb.size)||0)||(num(qa.kw)||0)-(num(qb.kw)||0)||String(qa.option||'').localeCompare(qb.option||'')});
  document.getElementById('eqBody').innerHTML=`<div class="chips eqcats">${cs.map(([c,n])=>`<button class="chip" data-ec="${esc(c)}" aria-pressed="${c===cat}">${esc(c)}<small>${n}</small></button>`).join('')}</div>
   <div class="eqdays">Rental length <div class="step"><button data-dd="-1">−</button><input id="eqD" inputmode="numeric" value="${days}"><button data-dd="1">+</button></div> days <span class="muted">· cheapest total incl. delivery &amp; pickup is highlighted</span></div>
   ${keys.map(k=>{const g=groups[k];const q0=g[0];const latest={};g.forEach(q=>{const p=latest[q.vendor];if(!p||String(q.date||'')>String(p.date||''))latest[q.vendor]=q});const vs=Object.values(latest);
     const tot=vs.map(q=>{const b=bestCost(q,days);return b?b.cost+delivFor(q):null});const minT=Math.min(...tot.filter(x=>x!=null));
     const col=f=>{const v=vs.map(q=>num(q[f])).filter(x=>x!=null);return v.length?Math.min(...v):null};const mn={day:col('day'),week:col('week'),m4:col('m4'),month:col('month')};const hasMo=vs.some(q=>q.month!=null&&q.month!=='');
     return `<div class="panel eqcard"><div class="eqtitle"><b>${esc(q0.cat)}</b> <span>${esc(spec(q0))}</span>${q0.fuel?`<small class="muted">${esc(q0.fuel)}</small>`:''}</div>
      <div class="tblwrap"><table class="eqtbl"><thead><tr><th>Vendor</th><th class="n">Day</th><th class="n">Week</th><th class="n">4 Weeks</th>${hasMo?'<th class="n">Month</th>':''}<th class="n">Del+Pick</th><th class="n">${days}-day total</th><th>Quoted</th></tr></thead><tbody>
      ${vs.sort((a,b)=>(tot[vs.indexOf(a)]??1e12)-(tot[vs.indexOf(b)]??1e12)).map(q=>{const i=vs.indexOf(q);const b=bestCost(q,days);const t=tot[i];
        return `<tr data-q="${esc(q._id)}"><td><b>${esc(q.vendor)}</b>${q.note?`<br><small class="muted">${esc(q.note)}</small>`:''}</td>${['day','week','m4'].map(f=>`<td class="n ${num(q[f])!=null&&num(q[f])===mn[f]&&vs.length>1?'best':''}">${money(num(q[f])??q[f])}</td>`).join('')}${hasMo?`<td class="n ${num(q.month)!=null&&num(q.month)===mn.month&&vs.length>1?'best':''}">${money(num(q.month)??q.month)}</td>`:''}
        <td class="n">${delivFor(q)?money(delivFor(q)):'—'}</td><td class="n ${t!=null&&t===minT&&vs.length>1?'best tot':''}">${t!=null?money(t)+`<br><small class="muted">${esc(b.how)}</small>`:'—'}</td><td><small>${esc(q.date||'')}${q.job?' · '+esc(q.job):''}</small></td></tr>`}).join('')}
      </tbody></table></div>${g.length>vs.length?`<small class="muted">${g.length-vs.length} older quote(s) in “All quotes”.</small>`:''}</div>`}).join('')}`;
  const b=document.getElementById('eqBody');b.querySelectorAll('[data-ec]').forEach(x=>x.onclick=()=>{cat=x.dataset.ec;render()});
  b.querySelectorAll('[data-dd]').forEach(x=>x.onclick=()=>{days=Math.max(1,days+ +x.dataset.dd);render()});
  const di=document.getElementById('eqD');di.onchange=()=>{days=Math.max(1,parseInt(di.value)||1);render()};
  if(canEdit())b.querySelectorAll('tr[data-q]').forEach(r=>r.onclick=()=>openQuote(r.dataset.q))}
function renderList(){const q=qf.toLowerCase();const l=[...Q].filter(x=>!q||[x.cat,spec(x),x.vendor,x.job,x.site,x.note].join(' ').toLowerCase().includes(q)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||a.cat.localeCompare(b.cat));
  document.getElementById('eqBody').innerHTML=`<div class="filters"><input id="eqQ" class="search" placeholder="Search equipment, vendor, job…" value="${esc(qf)}"><button class="btn" id="eqX">Export Excel</button>${canEdit()?'<button class="btn" id="eqImp">Import Excel</button>':''}<span class="muted">${l.length} quotes</span></div>
   <div class="tblwrap"><table><thead><tr><th>Equipment</th><th>Spec</th><th>Vendor</th><th class="n">Day</th><th class="n">Week</th><th class="n">4 Weeks</th><th class="n">Month</th><th class="n">Del/Pick</th><th>Date</th><th>Job · Site</th></tr></thead><tbody>
   ${l.map(x=>`<tr data-q="${esc(x._id)}"><td><b>${esc(x.cat)}</b></td><td>${esc(spec(x))}</td><td>${esc(x.vendor)}</td><td class="n">${money(num(x.day)??x.day)}</td><td class="n">${money(num(x.week)??x.week)}</td><td class="n">${money(num(x.m4)??x.m4)}</td><td class="n">${money(num(x.month))}</td><td class="n">${x.deliv||x.pick?money(num(x.deliv))+' / '+money(num(x.pick)):''}</td><td>${esc(x.date||'')}</td><td>${esc([x.job,x.site].filter(Boolean).join(' · '))}</td></tr>`).join('')}</tbody></table></div>`;
  const i=document.getElementById('eqQ');i.oninput=()=>{qf=i.value;const p=i.selectionStart;renderList();const n=document.getElementById('eqQ');n.focus();n.setSelectionRange(p,p)};
  document.getElementById('eqX').onclick=exportX;wireImp();
  if(canEdit())document.querySelectorAll('#eqBody tr[data-q]').forEach(r=>r.onclick=()=>openQuote(r.dataset.q))}
function renderVen(){const vs=[...new Set(Q.map(q=>q.vendor))].sort();
  document.getElementById('eqBody').innerHTML=`<div class="panel"><p class="muted">Default delivery and pickup fees per vendor. A quote's own fee overrides these.</p>
   <div class="tblwrap"><table><thead><tr><th>Vendor</th><th class="n">Quotes</th><th class="n">Delivery</th><th class="n">Pickup</th><th>Contact / notes</th></tr></thead><tbody>
   ${vs.map(v=>{const d=VEN[v]||{};return `<tr><td><b>${esc(v)}</b></td><td class="n">${Q.filter(q=>q.vendor===v).length}</td>${canEdit()?`<td class="n"><input class="vin" data-v="${esc(v)}" data-f="deliv" value="${esc(d.deliv??'')}" inputmode="decimal"></td><td class="n"><input class="vin" data-v="${esc(v)}" data-f="pick" value="${esc(d.pick??'')}" inputmode="decimal"></td><td><input class="vin wide" data-v="${esc(v)}" data-f="note" value="${esc(d.note||'')}"></td>`:`<td class="n">${money(num(d.deliv))}</td><td class="n">${money(num(d.pick))}</td><td>${esc(d.note||'')}</td>`}</tr>`}).join('')}</tbody></table></div></div>`;
  document.querySelectorAll('.vin').forEach(i=>i.onchange=async()=>{const v=i.dataset.v,f=i.dataset.f;const val=f==='note'?i.value.trim():num(i.value);VEN={...VEN,[v]:{...(VEN[v]||{}),[f]:val}};try{await db.doc('config/eqvendors').set(VEN);toast('Saved')}catch(e){toast('Could not save')}})}
function openQuote(id){const q=id?Q.find(x=>x._id===id):{cat:cat||'',vendor:'',date:new Date().toISOString().slice(0,10)};if(!q)return;editId=id;
  const vs=[...new Set(Q.map(x=>x.vendor))].sort(),cs=[...new Set(Q.map(x=>x.cat))].sort();
  const F=(k,l,t='text',list)=>`<label class="f">${l}<input id="eq_${k}" type="${t}" value="${esc(q[k]??'')}" ${list?`list="eqdl_${k}"`:''} ${t==='number'?'inputmode="decimal" step="any"':''}></label>`;
  document.getElementById('dlgRoot').innerHTML=`<div class="scrim sheet"><div class="dlg"><h3>${id?'Edit quote':'New quote'}</h3>
   <datalist id="eqdl_cat">${cs.map(c=>`<option value="${esc(c)}">`).join('')}</datalist><datalist id="eqdl_vendor">${vs.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
   <div class="fields">${F('cat','Equipment type','text',1)}${F('vendor','Vendor','text',1)}${F('size',"Size (ft)",'number')}${F('lbs','Capacity (K lbs)','number')}${F('kw','kW','number')}${F('option','Option (e.g. W/ Jib, 185 CFM)')}${F('fuel','Fuel')}
   ${F('day','Day $','number')}${F('week','Week $','number')}${F('m4','4 Weeks $','number')}${F('month','Month $','number')}${F('deliv','Delivery $','number')}${F('pick','Pickup $','number')}
   ${F('date','Quote date','date')}${F('job','Job #')}${F('site','Site location')}<label class="f wide">Note<input id="eq_note" value="${esc(q.note||'')}"></label></div>
   <div class="bar">${id?'<button class="btn dng" id="eqDel">Delete</button>':''}<button class="btn" id="eqC">Cancel</button><button class="go" id="eqS" style="width:auto">Save</button></div></div></div>`;
  document.getElementById('eqC').onclick=closeDlg;
  const d=document.getElementById('eqDel');if(d)d.onclick=async()=>{if(!confirm('Delete this quote?'))return;await db.doc('eqp/'+id).delete();closeDlg()};
  document.getElementById('eqS').onclick=async()=>{const g=k=>document.getElementById('eq_'+k).value.trim();const o={cat:fixType(g('cat')),vendor:clean(g('vendor')),size:num(g('size')),lbs:num(g('lbs')),kw:num(g('kw')),option:g('option'),fuel:g('fuel'),day:num(g('day')),week:num(g('week')),m4:num(g('m4')),month:num(g('month')),deliv:num(g('deliv')),pick:num(g('pick')),date:g('date'),job:g('job')?normJob(g('job')):'',site:g('site'),note:g('note'),by:curUser,at:new Date().toISOString()};
    if(!o.cat||!o.vendor){toast('Equipment type and vendor are required.');return}if([o.day,o.week,o.m4,o.month].every(x=>x==null)&&!o.note){toast('Enter at least one price.');return}
    try{await db.doc('eqp/'+(id||('q'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)))).set({...(id?q:{}),...o,_id:undefined});cat=o.cat;closeDlg();toast('Saved')}catch(e){toast('Could not save: '+(e.message||e.code))}}}
async function exportX(){if(!window.XLSX)return;const rows=[...Q].sort((a,b)=>a.cat.localeCompare(b.cat)||(num(a.size)||0)-(num(b.size)||0)).map(q=>[q.cat,q.lbs??'',q.size??'',q.kw??'',q.option||'',q.fuel||'',q.vendor,num(q.day)??q.day??'',num(q.week)??q.week??'',num(q.m4)??q.m4??'',q.month??'',q.deliv??'',q.pick??'',q.date||'',q.job||'',q.site||'',q.note||'']);
  const ws=XLSX.utils.aoa_to_sheet([['Equipment','K lbs','Size ft','kW','Option','Fuel','Vendor','Day','Week','4 Weeks','Month','Delivery','Pickup','Quote date','Job','Site','Note'],...rows]);ws['!autofilter']={ref:ws['!ref']};const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Prices');
  const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});const dl=await window.claude?.use?.('downloads');const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const name='AME_Equipment_Prices_'+new Date().toISOString().slice(0,10)+'.xlsx';if(dl)dl.save({filename:name,data:blob})}

/* ---------- Excel import (your “Equipment Price Tracking” workbook layout) ---------- */
function wireImp(){const b=document.getElementById('eqImp');if(!b)return;b.onclick=()=>{let f=document.getElementById('eqFile');if(!f){f=document.createElement('input');f.type='file';f.id='eqFile';f.accept='.xlsx,.xls';f.hidden=true;document.body.appendChild(f);f.onchange=()=>{const x=f.files[0];f.value='';if(x)importFile(x)}}f.click()}}
function vendorHead(t){const m=String(t).match(/^(.*?)\s*\(\$?([\d.]+)\s*\+\s*\$?([\d.]+)\)/);return m?{name:clean(m[1]),deliv:+m[2],pick:+m[3]}:{name:clean(t)}}
function parseWB(wb){const out=[],ven={};const iso=v=>v instanceof Date?v.toISOString().slice(0,10):(typeof v==='number'&&v>30000?new Date(Math.round((v-25569)*864e5)).toISOString().slice(0,10):(typeof v==='string'&&/^\d{4}-\d\d-\d\d/.test(v)?v.slice(0,10):''));
  const above=(A,i)=>{for(let k=i-1;k>=0;k--)if(A[k]&&A[k].some(c=>clean(c)))return A[k];return []};
  for(const sn of wb.SheetNames){const A=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null,raw:true});
    const h=A.findIndex(r=>r&&r.some(c=>/^equipment type$/i.test(clean(c))));
    if(h>0){const H=A[h].map(c=>clean(c).toLowerCase()),V=above(A,h);const groups=[];V.forEach((c,i)=>{if(clean(c))groups.push({i,...vendorHead(c)})});
      groups.forEach((g,n)=>{g.end=n+1<groups.length?groups[n+1].i:H.length;if(g.deliv!=null)ven[g.name]={deliv:g.deliv,pick:g.pick}});
      const ci=n=>H.findIndex(x=>x.startsWith(n));const cType=ci('equipment type'),cL=ci('lbs'),cS=ci('size'),cK=ci('kw'),cO=ci('option'),cF=ci('fuel'),cD=ci('date'),cJ=ci('job'),cSite=ci('site');
      const master=/rental list/i.test(sn);
      for(const r of A.slice(h+1)){if(!r||!clean(r[cType]))continue;const date=cD>=0?iso(r[cD]):'';if(!master&&!date)continue;
        let type=fixType(r[cType]),size=cS>=0?num(r[cS]):null,lbs=cL>=0?num(r[cL]):null;
        if(!master){const m=type.match(/^(\d+)\s*k\b.*?(\d+)'.*?([A-Za-z].*)$/i);if(m){lbs=+m[1];size=+m[2];type=fixType(m[3])}else{const m2=type.match(/^(\d+)'\s*(.*)$/);if(m2){size=+m2[1];type=fixType(m2[2])}}}
        for(const g of groups){const pr={};for(let i=g.i;i<g.end;i++){const k=H[i];if(/^day/.test(k))pr.day=r[i];else if(/^week/.test(k))pr.week=r[i];else if(/^4 ?week/.test(k))pr.m4=r[i];else if(/deliver/.test(k))pr.deliv=r[i]}
          if([pr.day,pr.week,pr.m4].every(v=>v==null||v===''))continue;const call=[pr.day,pr.week,pr.m4].some(v=>typeof v==='string'&&/call|quote|for/i.test(v));
          out.push({cat:type,lbs,size,kw:cK>=0?num(r[cK]):null,option:cO>=0?clean(r[cO]).replace(/^N\/A$/i,''):'',fuel:cF>=0?fixType(r[cF]):'',vendor:g.name,day:call?null:num(pr.day),week:call?null:num(pr.week),m4:call?null:num(pr.m4),month:null,deliv:num(pr.deliv),pick:null,date,job:cJ>=0&&r[cJ]?normJob(r[cJ]):'',site:cSite>=0?clean(r[cSite]):'',note:call?'Call for quote':'',src:'xlsx:'+sn})}}
      continue}
    /* month-based sheets: vendor row, then Month/Delivery/Pickup row */
    const mh=A.findIndex(r=>r&&r.some(c=>/^month$/i.test(clean(c))));
    if(mh>=0){const H=A[mh].map(c=>clean(c).toLowerCase()),V=above(A,mh);const gs=[];V.forEach((c,i)=>{if(clean(c))gs.push({i,name:clean(c)})});gs.forEach((g,n)=>g.end=n+1<gs.length?gs[n+1].i:H.length);
      for(const r of A.slice(mh+1)){if(!r||!clean(r[0]))continue;for(const g of gs){const pr={};for(let i=g.i;i<g.end;i++){if(H[i]==='month')pr.month=num(r[i]);else if(H[i]==='delivery')pr.deliv=num(r[i]);else if(H[i]==='pickup')pr.pick=num(r[i])}
        if(pr.month==null)continue;out.push({cat:fixType(r[0]),lbs:null,size:null,kw:null,option:'',fuel:'',vendor:g.name,day:null,week:null,m4:null,month:pr.month,deliv:pr.deliv??null,pick:pr.pick??null,date:'',job:'',site:'',note:'',src:'xlsx:'+sn})}}continue}
    /* dumpster layout */
    const dh=A.findIndex(r=>r&&/dumpster size/i.test(clean(r[0])));
    if(dh>=0){const V=A[dh],P=A[dh+1]||[];const gs=[];V.forEach((c,i)=>{if(i&&clean(c))gs.push({i,name:clean(c),period:clean(P[i])})});
      for(const r of A.slice(dh+2)){if(!r||!clean(r[0]))continue;for(const g of gs){const p=num(r[g.i]);if(p==null)continue;out.push({cat:'Dumpster',lbs:null,size:num(String(r[0]).match(/\d+/)?.[0]),kw:null,option:clean(r[0]).replace(/\d+\s*/,'')||'yards',fuel:'',vendor:g.name,day:null,week:null,m4:null,month:null,flat:p,deliv:null,pick:null,date:'',job:'',site:'',note:[g.period,clean(r[g.i+1])].filter(Boolean).join(' · '),src:'xlsx:'+sn})}}}}
  return {out,ven}}
async function importFile(f){try{const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});const {out,ven}=parseWB(wb);if(!out.length){toast('No prices found in that file.');return}
  const exist=new Set(Q.map(q=>[key(q),q.vendor,q.day,q.week,q.m4,q.month,q.flat,q.date].join('~')));const fresh=out.filter(q=>!exist.has([key(q),q.vendor,q.day,q.week,q.m4,q.month,q.flat,q.date].join('~')));
  if(!confirm(`Found ${out.length} prices (${fresh.length} new) from ${new Set(out.map(q=>q.vendor)).size} vendors. Import ${fresh.length}?`))return;
  const now=new Date().toISOString();const map={};fresh.forEach((q,i)=>map['q'+Date.now().toString(36)+i.toString(36)]={...q,by:curUser,at:now});
  if(db.setMany)await db.setMany('eqp',map);else for(const [k,v] of Object.entries(map))await db.doc('eqp/'+k).set(v);
  const nv={...ven,...VEN};await db.doc('config/eqvendors').set(nv);toast(`Imported ${fresh.length} prices`)}catch(e){toast('Import failed: '+(e.message||e))}}
/* dumpsters & flat prices show in Compare via the "flat" field */
const _bc=bestCost;bestCost=function(q,D){if(num(q.flat)!=null)return {cost:num(q.flat),how:q.note||'flat'};return _bc(q,D)};

AME.eqParse=parseWB;
AME.register({id:'eqp',name:'Equipment Prices',desc:'Rental quotes by vendor · compare · cheapest for N days',perm:'EQP',tabs:['eqp'],section:'tab-eqp',
  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h13l3-6h-4l-2-4H7"/><circle cx="7" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M10 7l2 4"/></svg>',
  open:()=>showTab('eqp'),onShow:render});
const _ar=window.applyRole;window.applyRole=function(){_ar();const b=document.querySelector('nav.tabs [data-tab="eqp"]');if(b)b.hidden=!can('EQP')};
(function wait(){if(typeof db!=='undefined'&&db&&typeof db.collection==='function')load();else setTimeout(wait,300)})();
})();
