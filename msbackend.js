/* AME Yard — Microsoft 365 backend.
   Provides window.claude.use('db'|'assets'|'downloads'|'user') on top of
   MS sign-in (MSAL) + a SharePoint folder (Microsoft Graph).            */
(function(){
const CFG={
  clientId:'98326b62-ab8a-4d2c-afb8-8370dfbf8669',
  tenantId:'03cf4bd0-be44-487f-955a-bf20a7471f67',
  site:'apeakcontracting.sharepoint.com',      // root site
  folder:'AME Yard App',                        // Documents/AME Yard App on that site
  scopes:['Files.ReadWrite.All','Sites.ReadWrite.All'],
  pollMs:15000
};
const G='https://graph.microsoft.com/v1.0';
const DRIVE=`${G}/sites/${CFG.site}/drive`;
const enc=p=>p.split('/').map(encodeURIComponent).join('/');
const pathUrl=p=>`${DRIVE}/root:/${enc(CFG.folder+'/'+p)}`;

let msal=null, account=null, readyP=null;
function gate(msg,btn){
  let el=document.getElementById('msGate');
  if(!el){el=document.createElement('div');el.id='msGate';
    el.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;background:#2b2724;color:#f3ede6;font:16px system-ui;text-align:center;padding:24px';
    document.body.appendChild(el)}
  el.innerHTML=`<div style="font-weight:700;font-size:22px">AME App</div><div style="max-width:420px;opacity:.85">${msg}</div>`+
    (btn?`<button id="msGo" style="font:600 17px system-ui;padding:14px 26px;border-radius:12px;border:0;background:#c8742c;color:#fff">Sign in with Microsoft</button>`:'');
  if(btn)document.getElementById('msGo').onclick=()=>msal.loginRedirect({scopes:CFG.scopes,prompt:'select_account'});
}
function ungate(){document.getElementById('msGate')?.remove()}

async function init(){
  if(!window.msal){gate('Could not load Microsoft sign-in. Check the internet connection and reload.');throw new Error('msal')}
  msal=new window.msal.PublicClientApplication({auth:{clientId:CFG.clientId,authority:'https://login.microsoftonline.com/'+CFG.tenantId,redirectUri:location.origin+location.pathname},
    cache:{cacheLocation:'localStorage'}});
  await msal.initialize();
  const r=await msal.handleRedirectPromise().catch(e=>{gate('Sign-in failed: '+(e.errorMessage||e.message),true);throw e});
  account=r?.account||msal.getAllAccounts()[0]||null;/* a different Microsoft account on this device: drop the previous person's cached data */try{const who=(account&&account.username||'').toLowerCase();const was=localStorage.getItem('amecWho');if(who&&was&&was!==who)Object.keys(localStorage).filter(k=>k.startsWith('amec:')).forEach(k=>localStorage.removeItem(k));if(who)localStorage.setItem('amecWho',who)}catch(e){}
  if(!account){gate('Sign in once with your company Microsoft account. You will stay signed in on this device.',true);
    return new Promise(()=>{})}               // waits for redirect
  msal.setActiveAccount(account);ungate();
}
async function token(){
  try{return (await msal.acquireTokenSilent({scopes:CFG.scopes,account})).accessToken}
  catch(e){await msal.acquireTokenRedirect({scopes:CFG.scopes,account});return new Promise(()=>{})}
}

/* Send an email from the signed-in user's mailbox (needs Mail.Send; asks once). */
window.ameMail=async(to,subject,html,att)=>{const sc={scopes:['Mail.Send'],account};let t;
  try{t=(await msal.acquireTokenSilent(sc)).accessToken}catch(e){t=(await msal.acquireTokenPopup(sc)).accessToken}
  const r=await fetch(G+'/me/sendMail',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({message:{subject,body:{contentType:'HTML',content:html},toRecipients:to.map(a=>({emailAddress:{address:a}})),...(att&&att.length?{attachments:att.map(x=>({'@odata.type':'#microsoft.graph.fileAttachment',name:x.name,contentType:x.type||'application/pdf',contentBytes:x.b64}))}:{})},saveToSentItems:true})});
  if(!r.ok)throw new Error('Mail '+r.status);return true};
async function gfetch(url,opt={}){
  const t=await token();
  let r;for(let i=0;i<5;i++){r=await fetch(url,{...opt,headers:{Authorization:'Bearer '+t,...(opt.headers||{})}});
    if(r.status!==429&&r.status!==503&&r.status!==504)break;const ra=+(r.headers.get('Retry-After')||0);await new Promise(z=>setTimeout(z,(ra?ra*1000:800*2**i)+Math.random()*500))}
  if(r.status===403||r.status===401){const e=new Error('No access to the AME App data folder in SharePoint. Ask Kyle to share it with you.');e.code=r.status;throw e}
  return r;
}

/* ---------- storage: one JSON file per collection in data/ ---------- */
const store={},lastTxt={};       // coll -> {etag, docs:{id:obj}}
const subs=[];        // {coll, id?, cb}
let pending=0;
async function readColl(c){
  const r=await gfetch(pathUrl('data/'+c+'.json')+':/content');
  if(r.status===404){store[c]={etag:null,docs:{}};return store[c]}
  if(!r.ok)throw new Error('Read '+c+' failed ('+r.status+')');
  const t=await r.text();if(store[c]&&lastTxt[c]===t){return store[c]}lastTxt[c]=t;store[c]={etag:null,docs:JSON.parse(t),chg:true};
  try{if(t.length<1500000){localStorage.setItem('amec:'+c,t);localStorage.setItem('amect:'+c,String(Date.now()))}else localStorage.removeItem('amec:'+c)}catch(e){}
  return store[c];
}
async function listEtags(){
  const r=await gfetch(pathUrl('data')+':/children?$select=name,eTag');
  if(r.status===404)return {};
  if(!r.ok)throw new Error('List failed ('+r.status+')');
  const m={};(await r.json()).value.forEach(f=>m[f.name.replace(/\.json$/,'')]=f.eTag);return m;
}
function emit(c){
  const s=store[c];if(!s)return;
  subs.filter(x=>x.coll===c).forEach(x=>{
    try{
      if(x.id){const d=s.docs[x.id];x.cb({exists:!!d,id:x.id,data:()=>d?JSON.parse(JSON.stringify(d)):undefined})}
      else x.cb({docs:Object.keys(s.docs).map(id=>({id,data:()=>JSON.parse(JSON.stringify(s.docs[id]))}))});
    }catch(e){console.error(e)}
  });
}
let loading={};
async function ensure(c){
  if(store[c])return store[c];
  if(!loading[c]){let ch=null;try{/* the device copy is only a speed-up — drop it if this device has not synced for 14 days */const ts=+localStorage.getItem('amect:'+c)||0;if(Date.now()-ts>14*864e5){localStorage.removeItem('amec:'+c);localStorage.removeItem('amect:'+c)}else ch=localStorage.getItem('amec:'+c)}catch(e){}
    if(ch){try{store[c]={etag:null,docs:JSON.parse(ch)};const fresh=readColl(c).then(s=>{if(JSON.stringify(s.docs)!==ch)emit(c);return s}).catch(e=>console.warn('refresh',c,e));loading[c]=Promise.resolve(store[c]);return store[c]}catch(e){}}
    loading[c]=readColl(c).then(s=>{emit(c);return s})}
  return loading[c];
}
/* write with optimistic concurrency (If-Match on file eTag) */
const queue={};
function write(c,fn){if(window.__ameSandbox){const docs=JSON.parse(JSON.stringify((store[c]||{docs:{}}).docs||{}));fn(docs);store[c]={etag:null,docs};setTimeout(()=>emit(c),0);return Promise.resolve()}
  const b=batch[c]||(batch[c]={fns:[],p:null});b.fns.push(fn);
  if(!b.p)b.p=(queue[c]||Promise.resolve()).catch(()=>{}).then(()=>{const fns=b.fns;delete batch[c];return doWrite(c,docs=>fns.forEach(f=>f(docs)))});
  queue[c]=b.p;return b.p;
}
const batch={};
const sv=st=>{try{window.dispatchEvent(new CustomEvent('ame-save',{detail:st}))}catch(e){}};
async function doWrite(c,fn){
  pending++;sv('saving');let ok=false;
  try{
    for(let attempt=0;attempt<14;attempt++){
      // fetch latest content + etag
      const meta=await gfetch(pathUrl('data/'+c+'.json')+'?$select=eTag');
      let etag=null,docs={};
      if(meta.ok){etag=(await meta.json()).eTag;
        const r=await gfetch(pathUrl('data/'+c+'.json')+':/content');if(!r.ok)throw new Error('Read '+c+' failed ('+r.status+')');docs=await r.json()}
      else if(meta.status!==404)throw new Error('Could not reach SharePoint ('+meta.status+') — try again.');
      fn(docs);
      const put=await gfetch(pathUrl('data/'+c+'.json')+':/content',{method:'PUT',
        headers:{'Content-Type':'application/json',...(etag?{'If-Match':etag}:{})},body:JSON.stringify(docs)});
      if(put.status===412||put.status===409||put.status===423){await new Promise(r=>setTimeout(r,Math.min(6000,250*2**attempt)*(0.5+Math.random())));continue}
      if(!put.ok)throw new Error('Save failed ('+put.status+')');
      const j=await put.json();store[c]={etag:j.eTag,docs};lastTxt[c]=JSON.stringify(docs);knownEtags[c]=j.eTag;emit(c);ok=true;return;
    }
    throw new Error('SharePoint is busy — your change was not saved. Try again in a few seconds.');
  }finally{pending--;sv(ok?(pending?'saving':'saved'):'error')}
}
let knownEtags={};
async function poll(){
  if(pending||document.hidden||window.__ameSandbox)return;
  try{
    const m=await listEtags();
    for(const c of Object.keys(m)){
      if(knownEtags[c]&&knownEtags[c]!==m[c]&&store[c]){const s0=store[c];const s1=await readColl(c);if(s1!==s0)emit(c)}
      knownEtags[c]=m[c];
    }
  }catch(e){console.warn('poll',e)}
}
const clean=o=>{const r={};for(const k in o){const v=o[k];if(v&&typeof v==='object'&&v.__delete__)continue;r[k]=v}return r};
function docRef(path){
  const [c,id]=path.split('/');
  return{
    set:d=>{let pv=null,nx=null;return write(c,docs=>{pv=docs[id]?JSON.parse(JSON.stringify(docs[id])):null;docs[id]=clean(d);nx=docs[id]}).then(r=>{partTrash(c,id,pv,nx);return r})},
    update:d=>{let pv=null,nx=null;return write(c,docs=>{pv=docs[id]?JSON.parse(JSON.stringify(docs[id])):null;const cur=docs[id]||{};for(const k in d){const v=d[k];if(v&&typeof v==='object'&&v.__delete__)delete cur[k];else cur[k]=v}docs[id]=cur;nx=cur}).then(r=>{partTrash(c,id,pv,nx);return r})},
    delete:()=>{let rm=[];return write(c,docs=>{if(docs[id]!==undefined)rm=[[id,docs[id]]];delete docs[id]}).then(r=>{toTrash(c,rm);return r})},
    get:async()=>{const s=await ensure(c);const d=s.docs[id];return{exists:!!d,id,data:()=>d}},
    onSnapshot:(cb,err)=>{subs.push({coll:c,id,cb});ensure(c).then(()=>emit(c)).catch(e=>err&&err(e));return()=>{}}
  };
}
function collRef(c){
  return{
    doc:id=>docRef(c+'/'+id),
    add:async d=>{const id=Math.random().toString(36).slice(2,12)+Date.now().toString(36);await docRef(c+'/'+id).set(d);return{id}},
    onSnapshot:(cb,err)=>{subs.push({coll:c,cb});ensure(c).then(()=>emit(c)).catch(e=>err&&err(e));return()=>{}},
    get:async()=>{const s=await ensure(c);return{docs:Object.keys(s.docs).map(id=>({id,data:()=>s.docs[id]}))}}
  };
}
const NOTRASH=['presence','trash','logins','dsplive'];const NOPART=['config/security','config/devbind','config/perms','config/spectrum'];
const idOf=o=>o&&typeof o==='object'?(o._id||o.id||o.key||o.no||o.code||o.path||o.url||(o.name!=null?o.name+'|'+(o.size||o.role||o.date||''):'')||JSON.stringify(o)):JSON.stringify(o);
function lostParts(a,b,path,out,depth){if(depth>4||!a||typeof a!=='object')return;
  if(Array.isArray(a)){if(!Array.isArray(b)){if(a.some(x=>x&&typeof x==='object'))out.push({p:path,items:a.filter(x=>x&&typeof x==='object')});return}
    if(b.length<a.length&&a.some(x=>x&&typeof x==='object')){const ids=new Set(b.map(idOf));let lost=a.filter(x=>x&&typeof x==='object'&&!ids.has(idOf(x)));if(!lost.length){const js=new Set(b.map(x=>JSON.stringify(x)));lost=a.filter(x=>!js.has(JSON.stringify(x))).slice(0,a.length-b.length)}if(lost.length)out.push({p:path,items:lost})}
    else if(b.length===a.length)a.forEach((x,i)=>lostParts(x,b[i],path+'.'+i,out,depth+1));return}
  for(const k in a){if(k.startsWith('_'))continue;const v=a[k];if(b&&typeof b==='object'&&k in b)lostParts(v,b[k],path?path+'.'+k:k,out,depth+1);else if(v&&typeof v==='object'&&(Array.isArray(v)?v.length:Object.keys(v).length))out.push({p:path?path+'.'+k:k,obj:v})}}
function partTrash(c,id,prev,next){if(NOTRASH.includes(c)||NOPART.includes(c+'/'+id)||!prev)return;const out=[];try{lostParts(prev,next,'',out,0)}catch(e){return}if(!out.length)return;
  let by='';try{by=typeof curUser!=='undefined'?curUser:''}catch(e){}const at=new Date().toISOString();
  write('trash',t=>{t['p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)]={coll:c,id,kind:'part',parts:out,parent:{name:prev.name||prev.job||prev.no||prev.code||'',type:prev.type||''},at,by}}).catch(()=>{})}
function toTrash(c,removed){if(NOTRASH.includes(c)||!removed.length)return;let by='';try{by=typeof curUser!=='undefined'?curUser:''}catch(e){}const at=new Date().toISOString();
  /* several records deleted together are kept as ONE bundle (restore puts them all back) */
  write('trash',t=>{const k0='t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);if(removed.length>1)t[k0]={coll:c,kind:'bundle',items:removed.map(([id,d])=>({id,data:d})),n:removed.length,at,by};else removed.forEach(([id,d],k)=>{t[k0+k]={coll:c,id,data:d,at,by}})}).catch(()=>{})}
const db={idle:async()=>{for(const c of Object.keys(queue)){try{await queue[c]}catch(e){}}return pending===0},collection:collRef,doc:docRef,deleteMany:(c,ids)=>{let rm=[];return write(c,docs=>{rm=[];ids.forEach(id=>{if(docs[id]!==undefined)rm.push([id,docs[id]]);delete docs[id]})}).then(r=>{toTrash(c,rm);return r})},setMany:(c,map)=>write(c,docs=>{Object.assign(docs,map)}),
  /* poll one collection fast (e.g. live presence on a shared screen); returns stop() */
  watchFast:(c,ms)=>{let et=null,busy=false;const t=setInterval(async()=>{if(busy||document.hidden)return;busy=true;try{const r=await gfetch(pathUrl('data/'+c+'.json')+'?$select=eTag');if(r.ok){const e=(await r.json()).eTag;if(et&&e!==et&&store[c]){const s0=store[c];const s1=await readColl(c);if(s1!==s0)emit(c)}et=e;knownEtags[c]=e}}catch(e){}busy=false},ms||3000);return()=>clearInterval(t)},
  refresh:async()=>{for(const c of Object.keys(store)){try{await readColl(c);emit(c)}catch(e){console.warn(e)}}try{knownEtags=await listEtags()}catch(e){}}};

/* first run: create data files from seed.json */
async function seedIfEmpty(){
  const m=await listEtags();
  if(Object.keys(m).length){knownEtags=m;return}
  const r=await fetch('seed.json');if(!r.ok)return;
  const seed=await r.json();
  for(const c of Object.keys(seed)){
    const put=await gfetch(pathUrl('data/'+c+'.json')+':/content',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(seed[c])});
    if(put.ok)knownEtags[c]=(await put.json()).eTag;
  }
}

/* ---------- photos ---------- */
const assets={upload:async blob=>{if(window.__ameSandbox){const u=URL.createObjectURL(blob);return{url:u,id:'sandbox'}}
  const id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const p='photos/'+id+'.jpg';
  const r=await gfetch(pathUrl(p)+':/content',{method:'PUT',headers:{'Content-Type':blob.type||'image/jpeg'},body:blob});
  if(!r.ok)throw new Error('Photo upload failed ('+r.status+')');
  photoCache['sp:'+p]=URL.createObjectURL(blob);
  return{url:'sp:'+p,id};
}};
const photoCache={},photoLoading={};
async function resolvePhoto(src){
  if(photoCache[src])return photoCache[src];
  if(!photoLoading[src])photoLoading[src]=gfetch(pathUrl(src.slice(3))+':/content').then(r=>r.ok?r.blob():null).then(b=>b?(photoCache[src]=URL.createObjectURL(b)):null);
  return photoLoading[src];
}
function fixImgs(root){
  (root.querySelectorAll?root.querySelectorAll('img[src^="sp:"]'):[]).forEach(img=>{
    const s=img.getAttribute('src');img.removeAttribute('src');img.dataset.sp=s;
    if(photoCache[s])img.src=photoCache[s];else resolvePhoto(s).then(u=>{if(u)img.src=u});
  });
}
new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>n.nodeType===1&&(n.matches?.('img[src^="sp:"]')?fixImgs(n.parentNode):fixImgs(n)))))
  .observe(document.documentElement,{childList:true,subtree:true});

/* ---------- downloads ---------- */
const downloads={save:async({filename,data})=>{
  try{if(typeof db!=='undefined'&&db&&typeof curUser!=='undefined')db.collection('logs').add({ts:new Date().toISOString(),action:'EXPORT',itemId:'',name:String(filename||''),size:'',unit:'',loc:'',n:0,before:'',after:'',job:'',by:curUser||'',note:'Downloaded '+String(filename||''),cond:''}).catch(()=>{})}catch(e){}
  const u=URL.createObjectURL(data instanceof Blob?data:new Blob([data]));
  const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),30000);
}};

/* ---------- files: big uploads resume after a dropped connection, show one progress bar, and block app updates until done;
   opened files are cached on this device (checked against the SharePoint version, so you never see an old copy) ---------- */
window.__ameUp=0;const upBar=(()=>{let el=null;return {set(name,done,total,t0){if(!el){el=document.createElement('div');el.id='ameUpBar';el.style.cssText='position:fixed;left:12px;bottom:12px;z-index:100002;background:var(--panel,#3b3633);color:var(--fg,#f3ede6);border:1px solid var(--line,#5a514a);border-radius:12px;padding:8px 12px;font:600 12px system-ui;box-shadow:0 6px 20px rgba(0,0,0,.35);min-width:240px;max-width:min(360px,calc(100vw - 24px))';document.body.appendChild(el)}
  const pct=total?Math.round(done/total*100):0;const sec=(Date.now()-t0)/1000;const sp=sec>1?done/sec:0;const left=sp?Math.max(0,(total-done)/sp):0;
  el.innerHTML=`<div style="display:flex;justify-content:space-between;gap:8px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Uploading ${String(name).split('/').pop()}</span><b>${pct}%</b></div><div style="height:6px;border-radius:3px;background:rgba(127,127,127,.3);margin:6px 0 4px;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:#f47b20"></i></div><small style="opacity:.75">${(done/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MB${sp?` · ${(sp/1048576).toFixed(1)} MB/s · ~${left>90?Math.round(left/60)+' min':Math.round(left)+' s'} left`:''} · keep this open</small>`},
  msg(t){if(el)el.querySelector('small').textContent=t},done(){if(el){el.remove();el=null}}}})();
window.addEventListener('beforeunload',e=>{if(window.__ameUp>0){e.preventDefault();e.returnValue=''}});
const waitOnline=()=>navigator.onLine===false?new Promise(r=>window.addEventListener('online',()=>r(),{once:true})):Promise.resolve();
const FC='ame-files-v1';async function fcGet(path){try{if(!('caches' in window))return null;const m=await gfetch(pathUrl(path)+'?$select=eTag,size');if(!m.ok)return null;const et=(await m.json()).eTag;const c=await caches.open(FC);const hit=await c.match('/f/'+encodeURIComponent(path));if(hit&&hit.headers.get('x-etag')===et)return {blob:await hit.blob(),et};return {blob:null,et}}catch(e){return null}}
async function fcPut(path,blob,et){try{if(!et||!('caches' in window)||blob.size>300*1048576)return;const c=await caches.open(FC);await c.put('/f/'+encodeURIComponent(path),new Response(blob,{headers:{'x-etag':et,'content-type':blob.type||'application/octet-stream'}}))}catch(e){}}
async function fetchFile(path,what){const ch=await fcGet(path);if(ch&&ch.blob)return ch.blob;const r=await gfetch(pathUrl(path)+':/content');if(!r.ok)throw new Error(what+' failed ('+r.status+')');const b=await r.blob();if(ch&&ch.et)fcPut(path,b,ch.et);return b}
const files={read:async path=>fetchFile(path,'Read'),link:async path=>{const r=await gfetch(pathUrl(path)+':/createLink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'view',scope:'organization'})});if(!r.ok)throw new Error('Link failed ('+r.status+')');const j=await r.json();return j.link&&j.link.webUrl},
 save:async(path,blob)=>{window.__ameUp++;try{if(blob.size>4e6){const ss=await gfetch(pathUrl(path)+':/createUploadSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'replace'}})});if(!ss.ok)throw new Error('Upload start failed ('+ss.status+')');const up=(await ss.json()).uploadUrl;
   const CH=15728640,N=blob.size,t0=Date.now();let j=null,o=0,fails=0;upBar.set(path,0,N,t0);
   while(o<N){const e=Math.min(o+CH,N);let r=null;try{await waitOnline();r=await fetch(up,{method:'PUT',headers:{'Content-Range':`bytes ${o}-${e-1}/${N}`},body:blob.slice(o,e)})}catch(x){r=null}
     if(r&&(r.ok||r.status===202)){fails=0;if(e===N){j=await r.json();o=N;break}try{const k=await r.json();const nx=k.nextExpectedRanges&&k.nextExpectedRanges[0];o=nx?parseInt(nx):e}catch(x){o=e}upBar.set(path,o,N,t0);continue}
     /* dropped or rejected: ask SharePoint how far it got, then carry on from there */
     fails++;if(fails>8)throw new Error('Upload failed at '+Math.round(o/N*100)+'% — check the connection and try again');upBar.msg('Connection hiccup — resuming… (try '+fails+')');await new Promise(z=>setTimeout(z,Math.min(15000,1500*fails)));
     try{await waitOnline();const st=await fetch(up);if(st.ok){const k=await st.json();const nx=k.nextExpectedRanges&&k.nextExpectedRanges[0];if(nx)o=parseInt(nx)}else if(st.status===404)throw new Error('Upload session expired — please upload again')}catch(x){if(/expired/.test(x.message))throw x}}
   upBar.done();try{window.toast&&window.toast('Uploaded '+String(path).split('/').pop())}catch(x){}return{url:j&&j.webUrl,id:j&&j.id}}
  const r=await gfetch(pathUrl(path)+':/content',{method:'PUT',headers:{'Content-Type':blob.type||'application/octet-stream'},body:blob});if(!r.ok)throw new Error('Save failed ('+r.status+')');const j=await r.json();return{url:j.webUrl,id:j.id}}catch(e){upBar.done();throw e}finally{window.__ameUp--}},
 list:async folder=>{const r=await gfetch(pathUrl(folder)+':/children?$select=name&$top=999');if(!r.ok)return[];return (await r.json()).value.map(x=>x.name)},get:async path=>fetchFile(path,'Open')};


/* ---------- daily backup: data/*.json -> backups/YYYY-MM-DD/, keep newest 3 ---------- */
const BK={keep:3};
async function bkList(){const r=await gfetch(pathUrl('backups')+':/children?$select=name,folder&$top=500');if(r.status===404)return[];if(!r.ok)throw new Error('List backups failed ('+r.status+')');return (await r.json()).value.filter(f=>f.folder&&/^\d{4}-\d{2}-\d{2}/.test(f.name)).map(f=>f.name).sort().reverse()}
async function bkRun(force,tag){const day=new Date().toLocaleDateString('en-CA');const name=tag?day+'-'+tag:day;
  const have=await bkList();if(!force&&have.includes(day)){return {skipped:true,name:day}}
  const r=await gfetch(pathUrl('data')+':/children?$select=name&$top=500');if(!r.ok)throw new Error('List data failed ('+r.status+')');
  const names=(await r.json()).value.map(f=>f.name).filter(n=>n.endsWith('.json'));let n=0;
  for(const f of names){const g=await gfetch(pathUrl('data/'+f)+':/content');if(!g.ok)continue;const b=await g.arrayBuffer();
    const p=await gfetch(pathUrl('backups/'+name+'/'+f)+':/content',{method:'PUT',headers:{'Content-Type':'application/json'},body:b});if(p.ok)n++}
  const all=[...new Set([...have,name])].sort().reverse();
  /* every backup stays in SharePoint (backups/<date>); the app only lists the latest few */
  try{localStorage.setItem('ameBkDay',day)}catch(e){}return {name,files:n}}
async function bkFiles(name){const r=await gfetch(pathUrl('backups/'+name)+':/children?$select=name,size&$top=500');if(!r.ok)return[];return (await r.json()).value.map(f=>({name:f.name.replace(/\.json$/,''),size:f.size}))}
async function bkRestore(name,coll){await bkRun(true,'before-restore');const g=await gfetch(pathUrl('backups/'+name+'/'+coll+'.json')+':/content');if(!g.ok)throw new Error('Backup file not found');const docs=await g.json();
  await write(coll,cur=>{for(const k of Object.keys(cur))delete cur[k];Object.assign(cur,docs)});return Object.keys(docs).length}
window.ameBackup={list:bkList,run:bkRun,files:bkFiles,restore:bkRestore};
const user={canEdit:()=>true,name:()=>account?.name||'',email:()=>account?.username||''};

readyP=(async()=>{
  await init();
  let warm=false;try{warm=!!localStorage.getItem('ameWarm')}catch(e){}
  const sd=seedIfEmpty().then(()=>{try{localStorage.setItem('ameWarm','1')}catch(e){}});
  if(warm)sd.catch(e=>{console.warn('seed',e);if(e&&(e.code===401||e.code===403))gate(e.message,false)});
  else try{await sd}catch(e){gate(e.message||String(e),false);throw e}
  (function tick(){setTimeout(()=>{poll().finally(tick)},CFG.pollMs*(0.8+Math.random()*0.5))})();
  setTimeout(()=>{let d='';try{d=localStorage.getItem('ameBkDay')}catch(e){}if(d!==new Date().toLocaleDateString('en-CA'))bkRun(false).catch(e=>console.warn('backup',e))},20000);
  {let lp=0;const nowPoll=()=>{if(document.hidden||Date.now()-lp<3000)return;lp=Date.now();poll()};document.addEventListener('visibilitychange',nowPoll);window.addEventListener('focus',nowPoll);window.addEventListener('online',()=>{lp=0;nowPoll()});window.addEventListener('pageshow',nowPoll)}
})();
window.claude={use:async name=>{
  await readyP;
  return {db,assets,downloads,user,files}[name]||null;
}};
window.msSignOut=()=>{try{Object.keys(localStorage).filter(k=>k.startsWith('amec:')||k.startsWith('amect:')||k==='ameWarm').forEach(k=>localStorage.removeItem(k))}catch(e){}msal?.logoutRedirect({account})};
})();
