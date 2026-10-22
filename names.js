/* AME Name Cleanup — find inventory items whose names differ for the same thing, pick one standard name (Kyle only, draft) */
(function(){
const STOP=new Set(['the','and','of','for','with','w','an','ea','pc','pcs','set','new','old']);
const SYN={drill:'drill',driver:'drill',drivers:'drill',drills:'drill',gun:'gun',guns:'gun',ladders:'ladder',saws:'saw',grinders:'grinder',nails:'nail',screws:'screw',cords:'cord',extension:'ext',ext:'ext',galvanized:'galv',galv:'galv','aluminium':'aluminum',alum:'aluminum',fiber:'fiberglass',fibreglass:'fiberglass',hose:'hose',hoses:'hose','w/':''};
const BR=new Set(['dewalt','milwaukee','makita','bosch','ryobi','hilti','ridgid','husky','werner','little','giant','honda','stihl','paslode','bostitch','hitachi','metabo','porter','cable','kobalt','craftsman','rigid','sika','garland','tremco','soprema','dowsil','gaco','henry']);
const toks=s=>String(s||'').toLowerCase().replace(/([a-z])(\d)/g,'$1 $2').replace(/[()\[\],\/\\&+_-]+/g,' ').replace(/(\D)\.|\.(\D)|\.$/g,'$1 $2').split(/\s+/).map(t=>SYN[t]??t.replace(/s$/,'')).filter(t=>t&&!STOP.has(t)&&t!=='"'&&t!="'");
const core=i=>toks(i.name).filter(t=>!BR.has(t));
const sz=i=>{const s=String(i.size||'').trim().toLowerCase().replace(/\s+/g,'');return s==='-'||s==='—'?'':s};
const jac=(a,b)=>{const A=new Set(a),B=new Set(b);let n=0;A.forEach(x=>{if(B.has(x))n++});return n/(A.size+B.size-n||1)};
window.__nameGroups=function(list,dec){const N=list.length,par=list.map((_,i)=>i),f=x=>par[x]===x?x:(par[x]=f(par[x]));const C=list.map(core),T=list.map(i=>toks(i.name));
  for(let a=0;a<N;a++)for(let b=a+1;b<N;b++){const da=C[a].filter(t=>!C[b].includes(t)),db=C[b].filter(t=>!C[a].includes(t));const tag=t=>/^[a-z]$|\d/.test(t);if(da.some(tag)&&db.some(tag))continue;
    const exact=T[a].join(' ')===T[b].join(' ');const j=jac(C[a],C[b]);const sub=C[a].length&&C[b].length&&(C[a].every(t=>C[b].includes(t))||C[b].every(t=>C[a].includes(t)))&&Math.min(C[a].length,C[b].length)>=2;
    if(exact||j>=.67||sub)par[f(a)]=f(b)}
  const G={};list.forEach((it,i)=>{(G[f(i)]=G[f(i)]||[]).push(it)});
  return Object.values(G).filter(g=>g.length>1&&new Set(g.map(i=>String(i.name).trim())).size>1).map(g=>({key:g.map(i=>i.id).sort().join('|'),items:g}))}})();

(function(){
const dev=()=>typeof isDev==='function'&&typeof curUser!=='undefined'&&isDev(curUser);
let S=document.getElementById('tab-nmc');if(!S){S=document.createElement('section');S.id='tab-nmc';S.hidden=true;(document.querySelector('main')||document.body).appendChild(S)}
let DEC={},view='todo',busy=false;
(function w(){if(typeof db!=='undefined'&&db&&db.doc){db.doc('config/namefix').onSnapshot(s=>{DEC=(s.data()||{}).dec||{};if(!S.hidden)render()},()=>{})}else setTimeout(w,500)})();
const all=()=>typeof items!=='undefined'?items:[];
const locOfI=i=>String(i.loc||'').split('~')[0];
function groups(){return window.__nameGroups(all().filter(i=>i&&i.name))}
async function saveDec(key,v){DEC={...DEC,[key]:v};render();try{await db.doc('config/namefix').set({dec:DEC})}catch(e){toast('Could not save: '+(e.message||e))}}
function render(){if(typeof items==='undefined'){S.innerHTML='<div class="panel">Loading…</div>';return}
  const G=groups();const st=g=>(DEC[g.key]||{}).s||'';const todo=G.filter(g=>!st(g)),diff=G.filter(g=>st(g)==='diff'),skip=G.filter(g=>st(g)==='skip');const done=Object.values(DEC).filter(d=>d.s==='done').length;
  const L=view==='todo'?todo:view==='diff'?diff:skip;
  S.innerHTML=`<div class="mplhead"><h2>Name Cleanup</h2><span class="muted" style="font-size:12px">Draft · only you</span></div>
   <p class="muted" style="margin:0 0 10px;font-size:13px">These look like the same kind of item written different ways. Pick the name everyone should use and press <b>Use this name</b>. Items stay where they are (rack, qty, history) — only the name changes, and the old names are kept as search words.</p>
   <div class="nmtabs"><button data-v="todo" aria-pressed="${view==='todo'}">To review <b>${todo.length}</b></button><button data-v="diff" aria-pressed="${view==='diff'}">Not the same <b>${diff.length}</b></button><button data-v="skip" aria-pressed="${view==='skip'}">Later <b>${skip.length}</b></button><span class="muted" style="margin-left:auto;font-size:12px">Fixed so far: ${done}</span></div>
   ${L.map((g,gi)=>{const names=[...new Set(g.items.map(i=>String(i.name).trim()))];const cnt=n=>g.items.filter(i=>String(i.name).trim()===n).length;
     return `<div class="panel nmcard" data-g="${gi}"><div class="nmnames"><span class="qlabel">Pick the standard name</span>${names.map((n,k)=>`<label class="nmopt"><input type="radio" name="nm${gi}" value="${esc(n)}" ${k===0?'checked':''}> <b>${esc(n)}</b> <small class="muted">${cnt(n)} item${cnt(n)>1?'s':''}</small></label>`).join('')}<label class="nmopt"><input type="radio" name="nm${gi}" value="__new"> Type a new name <input class="nmnew" placeholder="e.g. Impact Driver 20V"></label></div>
       <table class="nmtbl"><thead><tr><th></th><th>Current name</th><th>Size</th><th>Brand</th><th>Rack</th><th class="n">Qty</th></tr></thead><tbody>${g.items.map(i=>`<tr><td><input type="checkbox" data-iid="${esc(i.id)}" checked title="Include"></td><td>${thumb(i)} ${esc(i.name)}</td><td>${esc(i.size&&i.size!=='-'?i.size:'')}</td><td>${esc(i.mfgr||'')}</td><td>${esc(locOfI(i))}</td><td class="n">${esc(typeof qtyTxt==="function"?qtyTxt(i):i.qty)}</td></tr>`).join('')}</tbody></table>
       <div class="nmbar">${view==='todo'?`<button class="go" data-a="use" style="width:auto">Use this name</button><button class="btn" data-a="diff">Not the same</button><button class="btn" data-a="skip">Later</button>`:`<button class="btn" data-a="back">Move back to review</button>`}<small class="muted">Uncheck an item to leave it out.</small></div></div>`}).join('')||`<div class="panel muted">${view==='todo'?'Nothing left to review.':'Empty.'}</div>`}`;
  S.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{view=b.dataset.v;render()});
  S.querySelectorAll('.nmcard').forEach(c=>{const g=L[+c.dataset.g];c.querySelector('.nmnew').oninput=()=>{c.querySelector('input[value="__new"]').checked=true};
    c.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{const a=b.dataset.a;
      if(a==='diff')return saveDec(g.key,{s:'diff',by:curUser,at:new Date().toISOString()});if(a==='skip')return saveDec(g.key,{s:'skip',by:curUser,at:new Date().toISOString()});if(a==='back'){const d={...DEC};delete d[g.key];DEC=d;render();try{await db.doc('config/namefix').set({dec:DEC})}catch(e){}return}
      let nm=c.querySelector('input[type=radio]:checked').value;if(nm==='__new')nm=c.querySelector('.nmnew').value.trim();if(!nm){toast('Type the new name.');return}
      const ids=[...c.querySelectorAll('[data-iid]:checked')].map(x=>x.dataset.iid);const sel=g.items.filter(i=>ids.includes(i.id)&&String(i.name).trim()!==nm);if(!sel.length){toast('Nothing to rename.');return}
      if(!confirm(`Rename ${sel.length} item${sel.length>1?'s':''} to "${nm}"?`))return;if(busy)return;busy=true;b.disabled=true;
      try{for(const it of sel){const old=String(it.name).trim();const al=[...new Set([...(it.aliases||[]),old])].filter(x=>x&&x!==nm);await writeItem(it.id,{name:nm,aliases:al,updatedAt:new Date().toISOString(),updatedBy:curUser});it.name=nm;it.aliases=al;
          try{await db.collection('logs').add({ts:new Date().toISOString(),action:'EDIT',itemId:it.id,name:nm,size:it.size||'',unit:it.unit||'',loc:it.loc,n:0,before:it.qty,after:it.qty,job:'',by:curUser,note:`Renamed from "${old}" (Name Cleanup)`,cond:''})}catch(e){}}
        await saveDec(g.key+'#'+Date.now(),{s:'done',name:nm,n:sel.length,by:curUser,at:new Date().toISOString()});toast('Renamed '+sel.length)}catch(e){toast('Could not rename: '+(e.message||e))}busy=false;render()})})}
document.head.insertAdjacentHTML('beforeend',`<style>.nmtabs{display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap}.nmtabs button{border:1px solid var(--line);background:var(--panel);color:inherit;font:inherit;font-size:13px;font-weight:700;padding:7px 12px;border-radius:999px;cursor:pointer}.nmtabs button[aria-pressed=true]{background:var(--hi);color:#fff;border-color:var(--hi)}.nmtabs b{margin-left:4px}
.nmcard{margin-bottom:10px}.nmnames{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin-bottom:8px}.nmnames .qlabel{flex-basis:100%;margin:0}.nmopt{display:inline-flex;align-items:center;gap:6px;font-size:14px;cursor:pointer}.nmnew{padding:5px 8px;font:inherit;font-size:13px;width:200px}
.nmtbl{width:100%;border-collapse:collapse;font-size:13px}.nmtbl th{font-size:11px;text-transform:uppercase;color:var(--muted);text-align:left;padding:4px}.nmtbl td{padding:5px 4px;border-top:1px solid var(--line);vertical-align:middle}.nmtbl .n{text-align:right}.nmtbl .thumb{width:26px;height:26px;object-fit:cover;border-radius:4px;vertical-align:middle}
.nmbar{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}</style>`);
const IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M4 12h7M4 17h10"/><path d="M15 15l3 3 4-6"/></svg>';
(function reg(){if(typeof AME==='undefined'||!AME.register){setTimeout(reg,300);return}
  AME.register({id:'nmc',devOnly:true,name:'Name Cleanup',desc:'Find items written different ways · pick one standard name',allow:dev,tabs:['nmc'],section:'tab-nmc',icon:IC,open:()=>{showTab('nmc');render()},onShow:()=>render()})})();
})();
