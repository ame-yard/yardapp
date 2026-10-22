/* AME AI Assistant (test, Kyle only) — asks Claude questions about the app's data.
   The API key is kept only in this browser (localStorage), never saved to the app's data or code. */
(function(){
const dev=()=>typeof isDev==='function'&&typeof curUser!=='undefined'&&isDev(curUser);
const mk=id=>{let s=document.getElementById('tab-'+id);if(!s){s=document.createElement('section');s.id='tab-'+id;s.hidden=true;(document.querySelector('main')||document.body).appendChild(s)}return s};
const S=mk('ai');const MODEL='claude-sonnet-5-5';
let MSG=[],busy=false,files=[],stepTxt='';
const key=()=>{try{return localStorage.getItem('ameAIKey')||''}catch(e){return ''}};
const BLOCK=new Set(['deval','logins','presence','tslog','trash']);   // never sent to the AI
const COLS=['items','jobs','dsites','vehicles','reservations','truckservice','eqp','deliveries','mpl','freports','fjobs','fsites','safetymeet','safetyjobs','logs','dleave','lunch','stock','newitems','tags'];
const strip=o=>{if(!o||typeof o!=='object')return o;const c=Array.isArray(o)?[]:{};for(const k in o){if(/^(photo|photos|pin|pinH|email|wemail|cell|phone|doc|b64|data)$/i.test(k)&&typeof o[k]==='string'&&o[k].length>60)continue;if(/pin|phone|cell|email/i.test(k))continue;const v=o[k];c[k]=typeof v==='string'&&v.length>400?v.slice(0,400)+'…':(typeof v==='object'?strip(v):v)}return c};
const clip=(x,n=24000)=>{const t=JSON.stringify(x);return t.length>n?t.slice(0,n)+' …(cut)':t};
const TOOLS=[
 {name:'search_inventory',description:'Search yard inventory items (tools, materials, equipment) by words in name, size, brand, category or rack location. Returns name, size, brand, qty, unit, rack, level, condition, out-on-job info.',input_schema:{type:'object',properties:{query:{type:'string',description:'words to match, empty for all'},limit:{type:'integer'}},required:['query']}},
 {name:'read_collection',description:'Read records from an app collection. Collections: '+COLS.join(', ')+'. items=inventory, jobs=yard jobs, dsites=dispatch jobsites (job #, name, PM, FM, status, roof system, dates), vehicles=trucks & trailers, reservations=truck reservations, truckservice=service log, eqp=equipment rental price quotes, deliveries=office deliveries, mpl=mobilization prep lists, freports=field reports, logs=activity log (take out/return), dleave=staff leave. Optional text filter.',input_schema:{type:'object',properties:{name:{type:'string'},filter:{type:'string',description:'only records whose JSON contains these words (all words, case-insensitive)'},limit:{type:'integer'}},required:['name']}},
 {name:'read_doc',description:'Read one document by path. Useful: dday/<YYYY-MM-DD monday> = dispatch board for that week (rows per jobsite: crew, foreman; days[date].rows for single days); config/staff = staff directory (names, roles, levels); config/yardmap = yard map; config/racks.',input_schema:{type:'object',properties:{path:{type:'string'}},required:['path']}},
 {name:'today',description:'Current date/time and the Monday of this week.',input_schema:{type:'object',properties:{}}}];
async function runTool(n,a){try{
  if(n==='today'){const d=new Date();const m=new Date(d);m.setDate(d.getDate()-((d.getDay()+6)%7));return {now:d.toString(),monday:m.toISOString().slice(0,10)}}
  if(n==='search_inventory'){const w=String(a.query||'').toLowerCase().split(/\s+/).filter(Boolean);const L=(typeof items!=='undefined'?items:[]).filter(i=>{const t=[i.name,i.size,i.mfgr,i.type,i.cat,i.loc,i.level,i.unit].join(' ').toLowerCase();return w.every(x=>t.includes(x))});
    return {count:L.length,items:L.slice(0,a.limit||60).map(i=>({name:i.name,size:i.size,brand:i.mfgr,cat:i.type||i.cat,qty:i.qty,unit:i.unit,rack:i.loc,level:i.level,cond:i.cond,repair:i.repair||undefined,out:i.out||undefined}))}}
  if(n==='read_collection'){const c=String(a.name||'');if(BLOCK.has(c)||!COLS.includes(c))return {error:'not allowed: '+c};const s=await db.collection(c).get();let L=s.docs.map(d=>({_id:d.id,...d.data()}));
    if(a.filter){const w=String(a.filter).toLowerCase().split(/\s+/).filter(Boolean);L=L.filter(o=>{const t=JSON.stringify(o).toLowerCase();return w.every(x=>t.includes(x))})}
    if(c==='logs')L.sort((x,y)=>String(y.ts).localeCompare(String(x.ts)));return {count:L.length,records:L.slice(0,a.limit||80).map(strip)}}
  if(n==='read_doc'){const p=String(a.path||'');if(/^config\/(security|perms|devbind)|^usersig|deval/.test(p))return {error:'not allowed'};const d=(await db.doc(p).get()).data();return d?strip(d):{error:'not found'}}
  return {error:'unknown tool'}}catch(e){return {error:String(e.message||e)}}}
async function call(){const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key(),'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
  body:JSON.stringify({model:MODEL,max_tokens:2000,tools:TOOLS,system:`You are the assistant inside the AME Builders app (a commercial roofing company in Upland, CA). The user is Kyle K., a project manager. Answer using the tools to look up real app data; never guess numbers. Answer in the language the user writes in (Korean or English), short and clear. For lists use short bullet lines. If data is missing, say so. Today: ${new Date().toDateString()}.`,messages:MSG})});
  const j=await r.json();if(!r.ok)throw new Error(j.error?.message||('HTTP '+r.status));return j}
async function ask(text){if(!key()){toast('Add your API key first (Settings).');return}if(busy)return;busy=true;
  const content=[];for(const f of files)content.push(f.block);content.push({type:'text',text:text||'(see attachment)'});MSG.push({role:'user',content});files=[];render();
  try{for(let step=0;step<10;step++){stepTxt=step?'Looking things up…':'Thinking…';render();const j=await call();MSG.push({role:'assistant',content:j.content});
      const tu=j.content.filter(b=>b.type==='tool_use');if(j.stop_reason!=='tool_use'||!tu.length)break;
      const res=[];for(const t of tu){stepTxt='Reading '+(t.input?.name||t.input?.path||t.name.replace('_',' '))+'…';render();res.push({type:'tool_result',tool_use_id:t.id,content:clip(await runTool(t.name,t.input||{}))})}MSG.push({role:'user',content:res})}}
  catch(e){MSG.push({role:'assistant',content:[{type:'text',text:'Error: '+(e.message||e)}]})}
  busy=false;stepTxt='';render();const b=S.querySelector('#aiLog');if(b)b.scrollTop=b.scrollHeight}
const md=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^#+\s*(.+)$/gm,'<b>$1</b>').replace(/^\s*[-•]\s+/gm,'• ').replace(/\n/g,'<br>');
function bubbles(){const out=[];for(const m of MSG){const parts=(m.content||[]);if(m.role==='user'){const t=parts.filter(p=>p.type==='text').map(p=>p.text).join(' ');const att=parts.filter(p=>p.type==='document'||p.type==='image').length;if(t||att)out.push(`<div class="aim me">${att?`<small class="aiat">${att} file${att>1?'s':''}</small><br>`:''}${esc(t)}</div>`)}
  else{const t=parts.filter(p=>p.type==='text').map(p=>p.text).join('\n').trim();if(t)out.push(`<div class="aim bot">${md(t)}</div>`)}}return out.join('')}
function render(){if(!key()){S.innerHTML=`<div class="mplhead"><h2>AI Assistant</h2></div><div class="panel aiset"><h3 style="margin-top:0">Connect Claude</h3>
   <ol><li>Go to <b>console.anthropic.com</b> → sign in with a company account → <b>API Keys</b> → <b>Create Key</b>.</li><li>Add a payment method / credits there (billing is per use).</li><li>Paste the key below. It stays only in this browser on this device — it is not saved in the app or shared.</li></ol>
   <input id="aiK" type="password" placeholder="sk-ant-…" autocomplete="off" style="width:100%;padding:10px;font:inherit;box-sizing:border-box"><div class="bar"><button class="go" id="aiKS" style="width:auto">Save key</button></div></div>`;
   S.querySelector('#aiKS').onclick=()=>{const v=S.querySelector('#aiK').value.trim();if(!/^sk-ant-/.test(v)){toast('That does not look like an Anthropic key.');return}try{localStorage.setItem('ameAIKey',v)}catch(e){}render()};return}
  const ex=['재고에서 사다리 종류랑 수량 알려줘','이번 주 배차표 요약해줘','Which trucks are reserved tomorrow?','붐 리프트 가장 싼 업체는?'];
  S.innerHTML=`<div class="mplhead"><h2>AI Assistant</h2><span class="muted" style="font-size:12px">Test · only you · ${MODEL}</span><span style="flex:1"></span><button class="btn small" id="aiNew">New chat</button><button class="btn small" id="aiSet">Settings</button></div>
   <div class="panel aichat"><div id="aiLog" class="ailog">${MSG.length?bubbles():`<div class="aiempty"><p class="muted">Ask about inventory, jobs, dispatch, trucks, equipment prices, deliveries… You can also attach a quote PDF or photo.</p>${ex.map(x=>`<button class="aiex">${esc(x)}</button>`).join('')}</div>`}${busy?`<div class="aim bot aibusy">${esc(stepTxt||'Thinking…')}</div>`:''}</div>
   ${files.length?`<div class="aifiles">${files.map((f,i)=>`<span class="pchip">${esc(f.name)}<button data-fx="${i}">×</button></span>`).join('')}</div>`:''}
   <div class="aiin"><label class="btn" title="Attach PDF or photo"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.6-8.6a3.3 3.3 0 014.7 4.7l-8.6 8.6a1.7 1.7 0 01-2.4-2.4l8-8"/></svg><input type="file" id="aiF" accept="application/pdf,image/*" hidden multiple></label><textarea id="aiQ" rows="2" placeholder="Ask anything about the app data…" ${busy?'disabled':''}></textarea><button class="go" id="aiGo" style="width:auto" ${busy?'disabled':''}>Send</button></div></div>`;
  const q=S.querySelector('#aiQ');const go=()=>{const v=q.value.trim();if(!v&&!files.length)return;ask(v)};S.querySelector('#aiGo').onclick=go;q.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();go()}};
  S.querySelectorAll('.aiex').forEach(b=>b.onclick=()=>ask(b.textContent));S.querySelector('#aiNew').onclick=()=>{MSG=[];files=[];render()};
  S.querySelector('#aiSet').onclick=()=>{if(confirm('Remove the saved API key from this browser?')){try{localStorage.removeItem('ameAIKey')}catch(e){}render()}};
  S.querySelectorAll('[data-fx]').forEach(b=>b.onclick=()=>{files.splice(+b.dataset.fx,1);render()});
  S.querySelector('#aiF').onchange=async e=>{for(const f of e.target.files){if(f.size>20e6){toast(f.name+' is too big');continue}const b64=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(String(fr.result).split(',')[1]);fr.readAsDataURL(f)});
    files.push({name:f.name,block:f.type==='application/pdf'?{type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}}:{type:'image',source:{type:'base64',media_type:f.type,data:b64}}})}render()};
  const L=S.querySelector('#aiLog');if(L)L.scrollTop=L.scrollHeight;if(!busy)q.focus()}
document.head.insertAdjacentHTML('beforeend',`<style>
#tab-ai{max-width:900px;margin:0 auto}.aichat{display:flex;flex-direction:column;gap:10px;height:calc(100vh - 230px);min-height:420px}.ailog{flex:1;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:4px}
.aim{max-width:85%;padding:10px 14px;border-radius:14px;line-height:1.45;font-size:15px}.aim.me{align-self:flex-end;background:var(--hi,#f47b20);color:#fff;border-bottom-right-radius:4px}.aim.bot{align-self:flex-start;background:rgba(255,255,255,.06);border:1px solid var(--line);border-bottom-left-radius:4px}
.aibusy{opacity:.7;font-style:italic}.aiat{opacity:.85}.aiempty{margin:auto;text-align:center;max-width:520px}.aiex{display:block;width:100%;margin:6px 0;padding:10px;border:1px solid var(--line);border-radius:10px;background:none;color:inherit;font:inherit;cursor:pointer;text-align:left}.aiex:hover{border-color:var(--hi)}
.aiin{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:end}.aiin textarea{width:100%;box-sizing:border-box;padding:10px;font:inherit;resize:none;border-radius:10px}.aifiles{display:flex;flex-wrap:wrap;gap:6px}
.aiset ol{line-height:1.6;padding-left:20px}
</style>`);
const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
AME.register({id:'ai',devOnly:true,name:'AI Assistant',desc:'Ask about inventory, jobs, dispatch, trucks, prices · read quotes',allow:dev,tabs:['ai'],section:'tab-ai',icon:ICON,open:()=>{showTab('ai');render()},onShow:render});
})();
