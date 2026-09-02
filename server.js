const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto'), {URL}=require('url');
const ROOT=__dirname, FRONT=ROOT, DATA_DIR=path.join(ROOT,'data');
const DATA_FILE=process.env.VERCEL ? '/tmp/zanai-db.json' : path.join(DATA_DIR,'db.json');
if(!process.env.VERCEL) fs.mkdirSync(DATA_DIR,{recursive:true});
const env=(k,d='')=>process.env[k]??d, PORT=Number(env('PORT','3000')), PROD=String(env('MIDTRANS_IS_PRODUCTION','false')).toLowerCase()==='true';
const SERVER_KEY=env('MIDTRANS_SERVER_KEY',''), CLIENT_KEY=env('MIDTRANS_CLIENT_KEY',''), ADMIN_USERNAME=env('ADMIN_USERNAME','zanai'), ADMIN_PASSWORD=env('ADMIN_PASSWORD','zanai');
const DEEPSEEK_KEY=env('DEEPSEEK_API_KEY',''), DEEPSEEK_BASE=env('DEEPSEEK_BASE_URL','https://api.deepseek.com').replace(/\/$/,''), DEEPSEEK_MODEL=env('DEEPSEEK_MODEL','deepseek-chat');
const MIDTRANS_API=PROD?'https://app.midtrans.com':'https://app.sandbox.midtrans.com', SNAP_JS=PROD?'https://app.midtrans.com/snap/snap.js':'https://app.sandbox.midtrans.com/snap/snap.js';
function load(){
  try{return JSON.parse(fs.readFileSync(DATA_FILE,'utf8'))}
  catch{
    const seed={keys:[],orders:[],history:[],prices:{FREE:0,PRO:15000,VIP:30000}};
    try{if(process.env.VERCEL)fs.writeFileSync(DATA_FILE,JSON.stringify(seed,null,2))}catch{}
    return seed;
  }
}
let db=load();
const SESSION_SECRET=env('SESSION_SECRET','change-this-session-secret');
const b64u=v=>Buffer.from(v).toString('base64url');
const fromb64u=v=>Buffer.from(v,'base64url').toString('utf8');
function signToken(payload){
  const body=b64u(JSON.stringify(payload));
  const sig=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest('base64url');
  return body+'.'+sig;
}
function readToken(token){
  try{
    const [body,sig]=String(token||'').split('.');
    if(!body||!sig)return null;
    const expected=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest('base64url');
    if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
    const data=JSON.parse(fromb64u(body));
    if(data.exp && Date.now()>data.exp)return null;
    return data;
  }catch{return null}
}
function save(){fs.writeFileSync(DATA_FILE,JSON.stringify(db,null,2))} function now(){return new Date().toISOString()} function id(p='id'){return `${p}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`} function mask(k){return k.slice(0,4)+'••••••'+k.slice(-4)}
function keyFor(role,duration,owner='admin'){const k=`ZAN-${role}-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;const x={id:id('key'),access_key:k,access_key_masked:mask(k),role:String(role).toUpperCase(),status:'ACTIVE',expires_at:new Date(Date.now()+Math.max(1,Number(duration)||1)*86400000).toISOString(),created_at:now(),owner_id:owner};db.keys.unshift(x);save();return x}
function cookies(req){const out={};(req.headers.cookie||'').split(';').forEach(x=>{const i=x.indexOf('=');if(i>0)out[x.slice(0,i).trim()]=decodeURIComponent(x.slice(i+1))});return out}
function current(req){const c=cookies(req).zan_session,s=readToken(c);if(!s)return null;const k=db.keys.find(x=>x.id===s.keyId);if(!k||k.status==='REVOKED'||new Date(k.expires_at)<=new Date())return null;return {id:k.id,role:k.role,status:k.status,access_key:k.access_key,access_key_masked:k.access_key_masked,expires_at:k.expires_at}}
function json(res,code,data){const b=JSON.stringify(data);res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(b)});res.end(b)}
function setCookie(res,name,value,maxAge){res.setHeader('Set-Cookie',`${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${PROD?'; Secure':''}`)}
function clearCookie(res,name){res.setHeader('Set-Cookie',`${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)}
async function body(req){let s='';for await(const c of req)s+=c;if(!s)return {};try{return JSON.parse(s)}catch{return {}}}
function history(title,message,userId=null){db.history.unshift({id:id('hist'),title,type:title,message,created_at:now(),user_id:userId});db.history=db.history.slice(0,1000);save()}
async function midtransCreate(order){if(!SERVER_KEY||SERVER_KEY.includes('YOUR_'))throw Error('MIDTRANS_SERVER_KEY belum dikonfigurasi');const auth=Buffer.from(SERVER_KEY+':').toString('base64');const body={transaction_details:{order_id:order.id,gross_amount:order.amount},item_details:[{id:order.role,name:`ZanAI ${order.role}`,price:order.amount,quantity:1}],customer_details:{first_name:'ZanAI User',customer_id:order.user_id}};const r=await fetch(`${MIDTRANS_API}/snap/v1/transactions`,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error_messages?.join(', ')||d.status_message||'Midtrans gagal membuat transaksi');return d}
async function route(req,res){const u=new URL(req.url,`http://${req.headers.host||'localhost'}`), p=u.pathname, method=req.method;
 if(p==='/api/health')return json(res,200,{ok:true,service:'ZanAI Midtrans backend',production:PROD});
 if(p==='/api/payments/config')return json(res,200,{clientKey:CLIENT_KEY,snapJs:SNAP_JS,production:PROD});
 if(p==='/api/auth/login'&&method==='POST'){const b=await body(req),k=db.keys.find(x=>x.access_key===String(b.accessKey||'')&&x.status!=='REVOKED');if(!k||new Date(k.expires_at)<=new Date())return json(res,401,{error:{message:'Access key tidak valid atau sudah kedaluwarsa'}});const t=signToken({keyId:k.id,exp:Date.now()+604800000});setCookie(res,'zan_session',t,604800);history('Login','Login berhasil',k.id);return json(res,200,{success:true,user:{id:k.id,role:k.role,status:k.status,access_key:k.access_key,access_key_masked:k.access_key_masked,expires_at:k.expires_at}})}
 if(p==='/api/auth/me'){const me=current(req);if(!me)return json(res,401,{error:{message:'Belum masuk'}});return json(res,200,{success:true,user:me,history:db.history.filter(x=>x.user_id===me.id)})}
 if(p==='/api/auth/logout'){const c=cookies(req);clearCookie(res,'zan_session');return json(res,200,{success:true})}
 if(p==='/api/admin/auth/login'&&method==='POST'){const b=await body(req);if(b.username===ADMIN_USERNAME&&b.password===ADMIN_PASSWORD){const t=signToken({admin:true,exp:Date.now()+604800000});setCookie(res,'zan_admin',t,604800);return json(res,200,{success:true,user:{username:ADMIN_USERNAME,role:'ADMIN'}})}return json(res,401,{error:{message:'Username atau password salah'}})}
 if(p==='/api/admin/auth/logout'){const c=cookies(req);clearCookie(res,'zan_admin');return json(res,200,{success:true})}
 const admin=()=>{const c=cookies(req),s=readToken(c.zan_admin);return !!s?.admin};
 if(p.startsWith('/api/admin/')){if(!admin())return json(res,401,{error:{message:'Admin belum masuk'}});}
 if(p==='/api/admin/overview'){const active=db.keys.filter(x=>x.status==='ACTIVE'&&new Date(x.expires_at)>new Date()).length,expired=db.keys.filter(x=>x.status==='EXPIRED'||new Date(x.expires_at)<=new Date()).length;return json(res,200,{total_members:db.keys.length,active_members:active,expired_members:expired,pending_orders:db.orders.filter(x=>x.status==='PENDING').length,recent_members:db.keys.slice(0,8)})}
 if(p==='/api/admin/members')return json(res,200,{members:db.keys});
 if(/^\/api\/admin\/members\/[^/]+\/revoke$/.test(p)&&method==='POST'){const x=db.keys.find(v=>v.id===p.split('/')[4]);if(x){x.status='REVOKED';save();history('Key','Key dicabut: '+x.access_key_masked)}return json(res,200,{success:true})}
 if(p==='/api/admin/keys'&&method==='POST'){const b=await body(req),x=keyFor(b.role,b.duration,'admin');history('Key','Admin membuat key '+x.role);return json(res,200,{success:true,access_key:x.access_key,key:x.access_key})}
 if(p==='/api/admin/orders')return json(res,200,{orders:db.orders});
 if(p==='/api/admin/config/prices'&&method==='GET')return json(res,200,{prices:db.prices});
 if(p==='/api/admin/config/prices'&&method==='PATCH'){const b=await body(req);db.prices={FREE:Number(b.FREE)||0,PRO:Number(b.PRO)||0,VIP:Number(b.VIP)||0};save();return json(res,200,{success:true,prices:db.prices})}
 if(p==='/api/admin/config/deepseek'&&method==='PATCH')return json(res,200,{success:true,note:'Gunakan DEEPSEEK_API_KEY pada environment server.'});
 const me=current(req);if(p.startsWith('/api/orders')){if(!me)return json(res,401,{error:{message:'Belum masuk'}})}
 if(p==='/api/orders'&&method==='GET')return json(res,200,{orders:db.orders.filter(x=>x.user_id===me.id)});
 if(p==='/api/orders'&&method==='POST'){try{const b=await body(req),role=String(b.role||'FREE').toUpperCase(),duration=Math.max(1,Number(b.duration)||1),amount=Number(db.prices[role]||0);if(!['FREE','PRO','VIP'].includes(role))return json(res,400,{error:{message:'Paket tidak valid'}});if(amount<=0)return json(res,400,{error:{message:'Harga paket belum dikonfigurasi admin'}});const o={id:id('ZAN'),user_id:me.id,role,duration,amount,status:'PENDING',payment_provider:'midtrans',created_at:now(),updated_at:now()};db.orders.unshift(o);save();const mt=await midtransCreate(o);o.snap_token=mt.token;o.redirect_url=mt.redirect_url;save();return json(res,200,{success:true,order:o})}catch(e){return json(res,502,{error:{message:e.message}})}}
 const om=p.match(/^\/api\/orders\/([^/]+)\/status$/);if(om&&method==='GET'){const o=db.orders.find(x=>x.id===om[1]&&x.user_id===me.id);return o?json(res,200,{success:true,order:o}):json(res,404,{error:{message:'Order tidak ditemukan'}})}
 if(p==='/api/midtrans/notification'&&method==='POST'){const n=await body(req),o=db.orders.find(x=>x.id===String(n.order_id||''));if(!o)return json(res,404,{error:{message:'order not found'}});const raw=`${n.order_id}${n.status_code}${n.gross_amount}${SERVER_KEY}`,expected=crypto.createHash('sha512').update(raw).digest('hex'),given=String(n.signature_key||'');if(!SERVER_KEY||expected.length!==given.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(given)))return json(res,403,{error:{message:'invalid signature'}});o.midtrans_status=n.transaction_status;o.payment_type=n.payment_type||o.payment_type;o.updated_at=now();const success=n.transaction_status==='settlement'||(n.transaction_status==='capture'&&String(n.fraud_status||'').toLowerCase()==='accept');if(success&&o.status!=='PAID'){o.status='PAID';o.paid_at=now();const k=keyFor(o.role,o.duration,o.user_id);o.issued_key_id=k.id;o.issued_key_masked=k.access_key_masked;history('Payment','Pembayaran '+o.id+' berhasil',o.user_id)}else if(['cancel','deny','expire'].includes(n.transaction_status))o.status='FAILED';save();return json(res,200,{ok:true})}
 if(p==='/api/ai/chat'&&method==='POST'){if(!me)return json(res,401,{error:{message:'Belum masuk'}});const b=await body(req),message=String(b.message||'');if(!DEEPSEEK_KEY)return json(res,200,{answer:'Backend aktif. DEEPSEEK_API_KEY belum dikonfigurasi di server.',content:'Backend aktif. DEEPSEEK_API_KEY belum dikonfigurasi di server.'});try{const r=await fetch(DEEPSEEK_BASE+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+DEEPSEEK_KEY},body:JSON.stringify({model:DEEPSEEK_MODEL,messages:[{role:'user',content:message}],stream:false})}),d=await r.json();if(!r.ok)return json(res,r.status,{error:{message:d?.error?.message||'DeepSeek gagal'}});const a=d?.choices?.[0]?.message?.content||'Selesai.';history('AI',message,me.id);history('AI',a,me.id);return json(res,200,{answer:a,content:a})}catch{return json(res,502,{error:{message:'DeepSeek tidak dapat dihubungi'}})}}
 if(p==='/api/reseller/overview'||p==='/api/reseller/members'||p==='/api/reseller/keys'||p==='/api/reseller/history'){if(!me||me.role!=='RESELLER')return json(res,401,{error:{message:'Akses ditolak'}});if(p==='/api/reseller/overview'){const a=db.keys.filter(x=>x.owner_id===me.id);return json(res,200,{total_keys:a.length,active_members:a.filter(x=>x.status==='ACTIVE'&&new Date(x.expires_at)>new Date()).length,expired_members:a.filter(x=>new Date(x.expires_at)<=new Date()).length})}if(p==='/api/reseller/members')return json(res,200,{members:db.keys.filter(x=>x.owner_id===me.id)});if(p==='/api/reseller/history')return json(res,200,{history:db.history.filter(x=>x.user_id===me.id)});if(method==='POST'){const b=await body(req),x=keyFor(b.role,b.duration,me.id);return json(res,200,{success:true,access_key:x.access_key,key:x.access_key})}}
 if(p==='/api/reseller/permissions')return json(res,200,{permissions:[{name:'CREATE_KEY',label:'Membuat access key'},{name:'VIEW_MEMBERS',label:'Melihat member'},{name:'VIEW_HISTORY',label:'Melihat riwayat'}]});
 return serveStatic(req,res,u.pathname);
}
function serveStatic(req,res,urlPath){
  let rel=decodeURIComponent(urlPath||'/').replace(/^\/+/,'');
  if(rel==='' ) rel='index.html';
  const allowed=/\.(html|css|js|png|jpg|jpeg|svg|webp|ico|txt)$/i;
  if(!allowed.test(rel)) return res.writeHead(404).end('Not found');
  const file=path.resolve(FRONT,rel);
  if(!file.startsWith(path.resolve(FRONT)+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()) return res.writeHead(404).end('Not found');
  const ext=path.extname(file).toLowerCase(),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
}
module.exports={route};
if(require.main===module){
  const server=http.createServer((req,res)=>{route(req,res).catch(e=>{console.error(e);if(!res.headersSent)json(res,500,{error:{message:'Internal server error'}})})});
  server.listen(PORT,()=>console.log(`ZanAI http://localhost:${PORT} | Midtrans ${PROD?'PRODUCTION':'SANDBOX'}`));
}
