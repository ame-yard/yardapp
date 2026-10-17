/* AME responsive polish — phone card-rows for wide tables, "show more" on long tables, compact phone layouts. */
(function(){
const PH=()=>innerWidth<600;
const SKIP='.tstbl,.tssum,.sfmx,.frtbl,.nocard';
/* 1. Wide tables → labeled cards on phones */
function label(t){if(t.matches(SKIP)||t.closest('.nocard'))return;const ths=[...t.querySelectorAll(':scope>thead th')];if(ths.length<4){t.classList.remove('cardrows');return}
  const names=ths.map(h=>h.textContent.trim());let ti=ths.findIndex(h=>h.dataset.ph==='t');if(ti<0)ti=ths.findIndex(h=>/^(item|name|report|what|vehicle|course)$/i.test(h.textContent.trim()));if(ti<0)ti=0;t.classList.add('cardrows');
  t.querySelectorAll(':scope>tbody>tr').forEach(tr=>{const tds=[...tr.children];if(tds.length<3){tr.classList.add('cr-full');return}let ci=0;tds.forEach(td=>{const span=td.colSpan||1;td.classList.toggle('cr-t',ci===ti);if(!td.dataset.l&&names[ci]!==undefined)td.dataset.l=names[ci];if(!td.textContent.trim()&&!td.querySelector('img,button,input,select,.pill,.lchk'))td.classList.add('cr-empty');else td.classList.remove('cr-empty');ci+=span})})}
/* 2. Long tables → show 80 rows + "Show more" */
const LIM=80;
function limit(t){const tb=t.querySelector(':scope>tbody');if(!tb)return;const rows=[...tb.children].filter(r=>!r.classList.contains('showmore'));const old=tb.querySelector(':scope>.showmore');
  if(rows.length<=LIM+10){rows.forEach(r=>r.classList.remove('cr-hid'));old&&old.remove();return}
  const n=Number(tb.dataset.show||LIM);rows.forEach((r,i)=>r.classList.toggle('cr-hid',i>=n));const left=rows.length-n;
  if(left>0){const m=old||document.createElement('tr');m.className='showmore';m.innerHTML=`<td colspan="20"><button type="button" class="btn">Show ${Math.min(left,LIM)} more · ${left} hidden</button></td>`;m.querySelector('button').onclick=()=>{tb.dataset.show=String(n+LIM);limit(t)};tb.appendChild(m)}else old&&old.remove()}
function pass(){document.querySelectorAll('table').forEach(t=>{try{limit(t);if(PH())label(t);else t.classList.remove('cardrows')}catch(e){}})}
let tmr=0;const sched=()=>{clearTimeout(tmr);tmr=setTimeout(pass,60)};
new MutationObserver(sched).observe(document.body,{childList:true,subtree:true});addEventListener('resize',sched);sched();
/* 3. Long help paragraphs collapse on phones (tap to read) */
document.addEventListener('click',e=>{const p=e.target.closest('.panel>p.muted,.frform>p.muted,section>p.muted');if(p&&PH())p.classList.toggle('open')});
document.head.insertAdjacentHTML('beforeend',`<style>
.cr-hid{display:none!important}.showmore td{text-align:center;padding:10px}
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
 /* generic nav tabs scroll */
 nav.tabs{overflow-x:auto;scrollbar-width:none}nav.tabs::-webkit-scrollbar{display:none}
 .mplhead h2{font-size:19px}
}
@media(min-width:600px) and (max-width:900px){#tab-home .apps{grid-template-columns:repeat(2,1fr)}}
</style>`);
})();
