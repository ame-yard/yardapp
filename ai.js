/* AME AI Assistant (test, Kyle only) — asks Claude questions about the app's data.
   The API key is kept only in this browser (localStorage), never saved to the app's data or code. */
(function(){
const dev=()=>typeof isDev==='function'&&typeof curUser!=='undefined'&&isDev(curUser);
const mk=id=>{let s=document.getElementById('tab-'+id);if(!s){s=document.createElement('section');s.id='tab-'+id;s.hidden=true;(document.querySelector('main')||document.body).appendChild(s)}return s};
const S=mk('ai');const MODELS=[['claude-haiku-5-5','Haiku 5.5 · cheapest, quick lookups'],['claude-sonnet-5-5','Sonnet 5.5 · balanced'],['claude-opus-5-5','Opus 5.5 · smartest, most expensive']];let MODEL=(()=>{try{const m=localStorage.getItem('ameAIModel');return MODELS.some(x=>x[0]===m)?m:'claude-sonnet-5-5'}catch(e){return 'claude-sonnet-5-5'}})();
let H=S,voiceMode=false,lastVoice=false;
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
  if(n==='read_doc'){const p=String(a.path||'');if(/^ntcsecret|^config\/(security|perms|devbind)|^usersig|deval/.test(p))return {error:'not allowed'};const d=(await db.doc(p).get()).data();return d?strip(d):{error:'not found'}}
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
  busy=false;stepTxt='';render();const b=H.querySelector('#aiLog');if(b)b.scrollTop=b.scrollHeight;if(lastVoice){const m=MSG[MSG.length-1];const t=(m&&m.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');speak(t)}}
const md=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^#+\s*(.+)$/gm,'<b>$1</b>').replace(/^\s*[-•]\s+/gm,'• ').replace(/\n/g,'<br>');
function bubbles(){const out=[];for(const m of MSG){const parts=(m.content||[]);if(m.role==='user'){const t=parts.filter(p=>p.type==='text').map(p=>p.text).join(' ');const att=parts.filter(p=>p.type==='document'||p.type==='image').length;if(t||att)out.push(`<div class="aim me">${att?`<small class="aiat">${att} file${att>1?'s':''}</small><br>`:''}${esc(t)}</div>`)}
  else{const t=parts.filter(p=>p.type==='text').map(p=>p.text).join('\n').trim();if(t)out.push(`<div class="aim bot">${md(t)}</div>`)}}return out.join('')}
function render(){if(!key()){H.innerHTML=`<div class="mplhead"><h2>AI Assistant</h2></div><div class="panel aiset"><h3 style="margin-top:0">Connect Claude</h3>
   <ol><li>Go to <b>console.anthropic.com</b> → sign in with a company account → <b>API Keys</b> → <b>Create Key</b>.</li><li>Add a payment method / credits there (billing is per use).</li><li>Paste the key below. It stays only in this browser on this device — it is not saved in the app or shared.</li></ol>
   <input id="aiK" type="password" placeholder="sk-ant-…" autocomplete="off" style="width:100%;padding:10px;font:inherit;box-sizing:border-box"><div class="bar"><button class="go" id="aiKS" style="width:auto">Save key</button></div></div>`;
   H.querySelector('#aiKS').onclick=()=>{const v=H.querySelector('#aiK').value.trim();if(!/^sk-ant-/.test(v)){toast('That does not look like an Anthropic key.');return}try{localStorage.setItem('ameAIKey',v)}catch(e){}render()};return}
  const ex=['재고에서 사다리 종류랑 수량 알려줘','이번 주 배차표 요약해줘','Which trucks are reserved tomorrow?','붐 리프트 가장 싼 업체는?'];
  H.innerHTML=`<div class="mplhead"><h2>AI Assistant</h2><span class="muted" style="font-size:12px">Test · only you</span><select id="aiMod" title="Model" style="font-size:12px;padding:3px 6px;border-radius:6px">${MODELS.map(([v,l])=>`<option value="${v}" ${v===MODEL?'selected':''}>${l}</option>`).join('')}</select><span style="flex:1"></span><button class="btn small" id="aiLang" title="Voice language">${vLang==='ko-KR'?'한국어':'English'}</button><button class="btn small${voiceMode?' aion':''}" id="aiVo" title="Read answers out loud">${SPK} ${voiceMode?'Voice on':'Voice off'}</button><button class="btn small" id="aiNew">New chat</button><button class="btn small" id="aiSet">Settings</button></div>
   <div class="panel aichat"><div id="aiLog" class="ailog">${MSG.length?bubbles():`<div class="aiempty"><p class="muted">Ask about inventory, jobs, dispatch, trucks, equipment prices, deliveries… You can also attach a quote PDF or photo.</p>${ex.map(x=>`<button class="aiex">${esc(x)}</button>`).join('')}</div>`}${busy?`<div class="aim bot aibusy">${esc(stepTxt||'Thinking…')}</div>`:''}</div>
   ${files.length?`<div class="aifiles">${files.map((f,i)=>`<span class="pchip">${esc(f.name)}<button data-fx="${i}">×</button></span>`).join('')}</div>`:''}
   <div class="aiin"><label class="btn" title="Attach PDF or photo"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.6-8.6a3.3 3.3 0 014.7 4.7l-8.6 8.6a1.7 1.7 0 01-2.4-2.4l8-8"/></svg><input type="file" id="aiF" accept="application/pdf,image/*" hidden multiple></label><button class="btn aimic${listening?' on':''}" id="aiMic" type="button" title="Talk (voice)">${MIC}</button><textarea id="aiQ" rows="2" placeholder="Ask anything about the app data…" ${busy?'disabled':''}></textarea><button class="go" id="aiGo" style="width:auto" ${busy?'disabled':''}>Send</button></div></div>`;
  const q=H.querySelector('#aiQ');const go=()=>{const v=q.value.trim();if(!v&&!files.length)return;lastVoice=false;stopSpeak();ask(v)};H.querySelector('#aiGo').onclick=go;q.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();go()}};
  H.querySelectorAll('.aiex').forEach(b=>b.onclick=()=>ask(b.textContent));H.querySelector('#aiNew').onclick=()=>{MSG=[];files=[];render()};
  H.querySelector('#aiMod').onchange=e=>{MODEL=e.target.value;try{localStorage.setItem('ameAIModel',MODEL)}catch(x){}toast('Model: '+e.target.selectedOptions[0].text.split(' ·')[0])};H.querySelector('#aiSet').onclick=()=>{if(confirm('Remove the saved API key from this browser?')){try{localStorage.removeItem('ameAIKey')}catch(e){}render()}};
  H.querySelector('#aiMic').onclick=()=>{if(listening){stopListen();return}stopSpeak();listen()};H.querySelector('#aiVo').onclick=()=>{voiceMode=!voiceMode;try{localStorage.setItem('ameAIVoice',voiceMode?'1':'')}catch(e){}if(!voiceMode)stopSpeak();render()};H.querySelector('#aiLang').onclick=()=>{vLang=vLang==='ko-KR'?'en-US':'ko-KR';try{localStorage.setItem('ameAILang',vLang)}catch(e){}render()};H.querySelectorAll('[data-fx]').forEach(b=>b.onclick=()=>{files.splice(+b.dataset.fx,1);render()});
  H.querySelector('#aiF').onchange=async e=>{for(const f of e.target.files){if(f.size>20e6){toast(f.name+' is too big');continue}const b64=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(String(fr.result).split(',')[1]);fr.readAsDataURL(f)});
    files.push({name:f.name,block:f.type==='application/pdf'?{type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}}:{type:'image',source:{type:'base64',media_type:f.type,data:b64}}})}render()};
  const L=H.querySelector('#aiLog');if(L)L.scrollTop=L.scrollHeight;if(!busy)q.focus()}
document.head.insertAdjacentHTML('beforeend',`<style>
#tab-ai{max-width:900px;margin:0 auto}.aichat{display:flex;flex-direction:column;gap:10px;height:calc(100vh - 230px);min-height:420px}.ailog{flex:1;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:4px}
.aim{max-width:85%;padding:10px 14px;border-radius:14px;line-height:1.45;font-size:15px}.aim.me{align-self:flex-end;background:var(--hi,#f47b20);color:#fff;border-bottom-right-radius:4px}.aim.bot{align-self:flex-start;background:rgba(127,127,127,.06);border:1px solid var(--line);border-bottom-left-radius:4px}
.aibusy{opacity:.7;font-style:italic}.aiat{opacity:.85}.aiempty{margin:auto;text-align:center;max-width:520px}.aiex{display:block;width:100%;margin:6px 0;padding:10px;border:1px solid var(--line);border-radius:10px;background:none;color:inherit;font:inherit;cursor:pointer;text-align:left}.aiex:hover{border-color:var(--hi)}
.aiin{display:grid;grid-template-columns:auto auto 1fr auto;gap:8px;align-items:end}.aiin textarea{width:100%;box-sizing:border-box;padding:10px;font:inherit;resize:none;border-radius:10px}.aifiles{display:flex;flex-wrap:wrap;gap:6px}

.aimic.on{background:#e5484d;color:#fff;border-color:#e5484d;animation:aipulse 1.2s infinite}@keyframes aipulse{50%{box-shadow:0 0 0 6px rgba(229,72,77,.25)}}.aion{border-color:var(--hi,#f47b20)!important;color:var(--hi,#f47b20)!important}
#aiW{position:fixed;right:20px;bottom:20px;z-index:900}#aiFab{width:58px;height:58px;border-radius:50%;border:0;background:var(--hi,#f47b20);color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer;display:grid;place-items:center}#aiFab svg{width:28px;height:28px}
#aiPan{width:400px;height:620px;max-height:calc(100vh - 40px);background:var(--panel,#2b2b2b);border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.45);display:flex;flex-direction:column;overflow:hidden}#aiPan[hidden]{display:none}
.aipt{display:flex;align-items:center;gap:6px;padding:10px 12px;background:var(--hi,#f47b20);color:#fff}.aipt button{background:none;border:1px solid rgba(255,255,255,.6);color:#fff;border-radius:6px;padding:3px 8px;cursor:pointer;font:12px inherit}.aipt #aiClose{border:0;font-size:22px;line-height:1;padding:0 4px}
#aiBody{flex:1;display:flex;flex-direction:column;min-height:0;padding:8px}#aiBody .mplhead{flex-wrap:wrap;gap:4px;margin:0 0 6px}#aiBody .mplhead h2{display:none}#aiBody .aichat{height:auto;flex:1;min-height:0;padding:8px}#aiBody .aim{font-size:14px}
@media(max-width:600px){#aiW{right:12px;bottom:12px}#aiPan{position:fixed;inset:0;width:auto;height:auto;max-height:none;border-radius:0}}
.aiset ol{line-height:1.6;padding-left:20px}
</style>`);

const MIC='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const SPK='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>';
let vLang=(()=>{try{return localStorage.getItem('ameAILang')||'ko-KR'}catch(e){return 'ko-KR'}})();try{voiceMode=localStorage.getItem('ameAIVoice')==='1'}catch(e){}
let rec=null,listening=false;
function listen(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast('Voice input is not supported in this browser. Use Chrome, Edge or Safari.');return}if(busy)return;
  rec=new SR();rec.lang=vLang;rec.interimResults=true;rec.continuous=false;let fin='';
  rec.onresult=e=>{let t='';for(let i=0;i<e.results.length;i++)t+=e.results[i][0].transcript;fin=t;const q=H.querySelector('#aiQ');if(q)q.value=t};
  rec.onerror=e=>{if(e.error==='not-allowed')toast('Allow microphone access for this site.');};
  rec.onend=()=>{listening=false;const t=fin.trim();if(t){lastVoice=true;ask(t)}else render()};
  listening=true;render();try{rec.start()}catch(e){listening=false;render()}}
function stopListen(){try{rec&&rec.stop()}catch(e){}}
function stopSpeak(){try{speechSynthesis.cancel()}catch(e){}}
function speak(t){if(!voiceMode||!t||!window.speechSynthesis)return;const clean=t.replace(/\*\*|#+\s*|`/g,'').replace(/^\s*[-•]\s+/gm,'').replace(/https?:\S+/g,'').slice(0,1500);const ko=/[가-힣]/.test(clean);
  const u=new SpeechSynthesisUtterance(clean);u.lang=ko?'ko-KR':'en-US';const vs=speechSynthesis.getVoices().filter(v=>v.lang.replace('_','-').startsWith(u.lang.slice(0,2)));const best=vs.find(v=>/Google|Natural|Online/i.test(v.name))||vs[0];if(best)u.voice=best;u.rate=1.05;
  u.onend=()=>{if(voiceMode&&lastVoice&&(H!==S?panelOpen:!S.hidden))setTimeout(listen,300)};stopSpeak();speechSynthesis.speak(u)}
/* floating "ask AI" bubble on the home screen, like a website help chat */
let panelOpen=false;const W=document.createElement('div');W.id='aiW';W.innerHTML='<button id="aiFab" type="button" title="Ask AI">'+'ICONX'+'</button><div id="aiPan" hidden><div class="aipt"><b>AME AI</b><span style="flex:1"></span><button type="button" id="aiFull" title="Open full page">Open full</button><button type="button" id="aiClose" title="Close">×</button></div><div id="aiBody"></div></div>';
function fabSync(){const show=dev()&&window.AME&&(AME.cur==='home'||!AME.cur);W.hidden=!show;if(!show&&panelOpen)closeP()}
function openP(){panelOpen=true;W.querySelector('#aiPan').hidden=false;W.querySelector('#aiFab').hidden=true;H=W.querySelector('#aiBody');render()}
function closeP(){panelOpen=false;stopListen();stopSpeak();W.querySelector('#aiPan').hidden=true;W.querySelector('#aiFab').hidden=false;H=S}
const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
W.innerHTML=W.innerHTML.replace('ICONX',ICON);document.body.appendChild(W);W.querySelector('#aiFab').onclick=openP;W.querySelector('#aiClose').onclick=closeP;W.querySelector('#aiFull').onclick=()=>{closeP();AME.open('ai')};setInterval(fabSync,700);fabSync();
AME.register({id:'ai',devOnly:true,name:'AI Assistant',desc:'Ask about inventory, jobs, dispatch, trucks, prices · read quotes',allow:dev,tabs:['ai'],section:'tab-ai',icon:ICON,open:()=>{H=S;showTab('ai');render()},onShow:()=>{H=S;render()}});
})();
