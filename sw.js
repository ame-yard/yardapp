/* AME service worker: makes the app installable. Always uses the network (no stale copies). */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>new Response('<h2 style="font-family:system-ui;padding:24px">You are offline. Connect to the internet and reopen AME.</h2>',{headers:{'Content-Type':'text/html'}})))});

self.addEventListener('notificationclick',e=>{e.notification.close();const d=e.notification.data||{};e.waitUntil((async()=>{const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true});const c=cs[0];if(c){await c.focus();c.postMessage({type:'open',...d})}else await self.clients.openWindow('./')})())});
