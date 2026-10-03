import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

dotenv.config();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const DATA=path.join(__dirname,'../data/db.json');
const app=express();
app.use(cors({origin:true,credentials:true}));
app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname,'../../frontend')));

const SERVICES=[
 ['cleaning','Home Cleaning',199],['plumber','Plumber',179],['electrician','Electrician',179],
 ['maid','Maid / Helper',249],['ac','AC Service',349],['appliance','Appliance Repair',229],
 ['painting','Painting',499],['pest','Pest Control',449],['carpenter','Carpenter',229],
 ['moving','Home Shifting',649],['gardener','Gardener',249],['water','Water / Tank',299]
];
const DEMO_WORKERS=[
 {id:'W1001',name:'Arun Kumar',role:'Plumber',skills:['plumber'],lat:13.0827,lng:80.2707,rating:4.9,jobs:782,verified:true,online:true},
 {id:'W1002',name:'Suresh M.',role:'Electrician',skills:['electrician'],lat:12.9716,lng:80.2215,rating:4.8,jobs:641,verified:true,online:true},
 {id:'W1003',name:'Priya S.',role:'Home Helper',skills:['maid','cleaning'],lat:12.987,lng:80.252,rating:4.9,jobs:530,verified:true,online:true},
 {id:'W1004',name:'Karthik R.',role:'AC Technician',skills:['ac','appliance'],lat:13.0475,lng:80.209,rating:4.8,jobs:412,verified:true,online:true}
];
function load(){
 if(!fs.existsSync(DATA))fs.writeFileSync(DATA,JSON.stringify({users:[],workers:[],bookings:[],otp:[],tickets:[]},null,2));
 const d=JSON.parse(fs.readFileSync(DATA,'utf8'));
 d.users??=[];d.workers??=[];d.bookings??=[];d.otp??=[];d.tickets??=[];
 return d;
}
function save(d){fs.writeFileSync(DATA,JSON.stringify(d,null,2))}
function id(prefix){return prefix+crypto.randomBytes(5).toString('hex').toUpperCase()}
function normalizePhone(p){return String(p||'').replace(/\D/g,'').slice(-10)}
function hash(s){return crypto.createHash('sha256').update(String(s)).digest('hex')}
function auth(req,res,next){
 const token=String(req.headers.authorization||'').replace(/^Bearer\s+/,'');
 if(!token)return res.status(401).json({error:'Authentication required'});
 if(token.startsWith('demo-')){req.user={id:token,role:token.includes('admin')?'admin':'customer',name:token.includes('worker')?'Worker Preview':token.includes('admin')?'Admin Preview':'HomeHero User'};return next()}
 const d=load(),u=d.users.find(x=>x.token===token);
 if(!u)return res.status(401).json({error:'Invalid session'});
 req.user=u;next();
}
function adminAuth(req,res,next){if(req.user?.role==='admin'||String(req.headers.authorization||'').includes('demo-admin'))return next();return res.status(403).json({error:'Admin access required'})}
function distanceKm(a,b,c,d){const R=6371,rad=x=>x*Math.PI/180,dLat=rad(c-a),dLon=rad(d-b);const x=Math.sin(dLat/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function serviceById(id){const x=SERVICES.find(s=>s[0]===id);return x?{id:x[0],name:x[1],price:x[2]}:null}
function calculate(base,hours,express){
 const labour=base*hours,travel=39,platform=Number(process.env.PLATFORM_FEE||7),expressFee=express?39:0;
 const discount=Math.min(30,Math.floor(labour*.05)),total=labour+travel+platform+expressFee-discount;
 const commissionRate=Math.min(.18,Math.max(.08,Number(process.env.COMMISSION_DEFAULT||.12)));
 return {labour,travel,platform,expressFee,discount,total,estimatedPlatformCommission:+(labour*commissionRate).toFixed(2),workerPayout:+Math.max(0,total-platform-expressFee-labour*commissionRate).toFixed(2)};
}
function seed(){const d=load();if(!d.workers.length){d.workers=DEMO_WORKERS;save(d)}}seed();

app.get('/api/health',(req,res)=>res.json({
 ok:true,service:'HomeHero API',time:new Date().toISOString(),
 providers:{otp:process.env.OTP_PROVIDER||'demo',payment:process.env.PAYMENT_PROVIDER||'demo',ai:process.env.OPENROUTER_API_KEY?'openrouter':process.env.GROQ_API_KEY?'groq':(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_API_TOKEN?'cloudflare':'local')},models:{openrouter:process.env.OPENROUTER_MODEL||'openai/gpt-oss-120b',groq:process.env.GROQ_MODEL||'openai/gpt-oss-120b',cloudflare:process.env.CLOUDFLARE_AI_MODEL||'@cf/meta/llama-3.1-8b-instruct'},livePayment:!!(process.env.PAYMENT_PROVIDER&&process.env.PAYMENT_PROVIDER.toLowerCase()!=='demo')
}));
app.get('/api/services',(req,res)=>res.json(SERVICES.map(s=>({id:s[0],name:s[1],from:s[2]}))));
app.get('/api/config/public',(req,res)=>res.json({ok:true,ai:{provider:process.env.OPENROUTER_API_KEY?'openrouter':process.env.GROQ_API_KEY?'groq':(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_API_TOKEN?'cloudflare':'local'),models:{openrouter:process.env.OPENROUTER_MODEL||'openai/gpt-oss-120b',groq:process.env.GROQ_MODEL||'openai/gpt-oss-120b',cloudflare:process.env.CLOUDFLARE_AI_MODEL||'@cf/meta/llama-3.1-8b-instruct'}},otp:process.env.OTP_PROVIDER||'demo',payment:process.env.PAYMENT_PROVIDER||'demo'}));


app.post('/api/auth/request-otp',async(req,res)=>{
 const phone=normalizePhone(req.body.phone);if(phone.length!==10)return res.status(400).json({error:'Valid 10-digit mobile number required'});
 const d=load(),otp=String(crypto.randomInt(100000,1000000));
 d.otp=d.otp.filter(x=>x.phone!==phone);d.otp.push({phone,hash:hash(otp),expires:Date.now()+5*60e3,attempts:0});
 save(d);
 const provider=(process.env.OTP_PROVIDER||'demo').toLowerCase();
 if(provider==='demo')return res.json({sent:true,devOtp:otp,demo:true});
 try{
  if(provider==='twilio'){
   const sid=process.env.TWILIO_ACCOUNT_SID,token=process.env.TWILIO_AUTH_TOKEN,from=process.env.TWILIO_FROM;
   if(!sid||!token||!from)throw Error('Twilio credentials are incomplete');
   const body=new URLSearchParams({To:`+91${phone}`,From:from,Body:`Your HomeHero verification code is ${otp}. It expires in 5 minutes.`});
   const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${sid}:${token}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body});
   const j=await r.json();if(!r.ok)throw Error(j.message||'SMS provider error');
   return res.json({sent:true});
  }
  throw Error('Unsupported OTP_PROVIDER. Use demo or twilio.');
 }catch(e){return res.status(502).json({error:e.message})}
});
app.post('/api/auth/verify-otp',(req,res)=>{
 const phone=normalizePhone(req.body.phone),otp=String(req.body.otp||''),d=load(),row=d.otp.find(x=>x.phone===phone);
 if(!row||row.expires<Date.now())return res.status(400).json({error:'OTP expired or not requested'});
 if(row.attempts>=5)return res.status(429).json({error:'Too many OTP attempts. Request a new OTP.'});
 row.attempts++;
 if(hash(otp)!==row.hash){save(d);return res.status(400).json({error:'Invalid OTP'});}
 let u=d.users.find(x=>x.phone===phone);
 if(!u){u={id:id('U'),phone,name:'HomeHero User',role:'customer',token:crypto.randomBytes(32).toString('hex'),createdAt:new Date().toISOString()};d.users.push(u)}
 d.otp=d.otp.filter(x=>x.phone!==phone);save(d);
 res.json({token:u.token,user:{id:u.id,name:u.name,phone:u.phone,role:u.role}});
});

app.get('/api/profile',auth,(req,res)=>res.json({user:{id:req.user.id,name:req.user.name,phone:req.user.phone||'',role:req.user.role}}));
app.patch('/api/profile',auth,(req,res)=>{
 const name=String(req.body.name||'').trim();if(name.length<2)return res.status(400).json({error:'Name is too short'});
 if(req.user.token){const d=load(),u=d.users.find(x=>x.token===req.user.token);if(u){u.name=name;save(d);req.user=u}}
 else req.user.name=name;
 res.json({ok:true,user:{name:req.user.name,phone:req.user.phone||''}});
});

app.get('/api/bookings',auth,(req,res)=>{
 const d=load(),bookings=d.bookings.filter(b=>b.userId===req.user.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
 res.json({bookings});
});
app.post('/api/quote',auth,(req,res)=>{
 const s=serviceById(req.body.serviceId);if(!s)return res.status(400).json({error:'Unknown service'});
 const hours=Math.max(1,Math.min(24,Number(req.body.hours||1)));res.json(calculate(s.price,hours,!!req.body.express));
});
app.post('/api/bookings',auth,(req,res)=>{
 const s=serviceById(req.body.serviceId);if(!s)return res.status(400).json({error:'Unknown service'});
 const hours=Math.max(1,Math.min(24,Number(req.body.hours||1))),express=!!req.body.express,q=calculate(s.price,hours,express),d=load();
 const b={id:id('HH'),userId:req.user.id,serviceId:s.id,serviceName:s.name,hours,address:String(req.body.address||'').trim(),notes:String(req.body.notes||'').trim(),lat:Number.isFinite(req.body.lat)?req.body.lat:null,lng:Number.isFinite(req.body.lng)?req.body.lng:null,express,status:'searching',total:q.total,quote:q,worker:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(!b.address)return res.status(400).json({error:'Service address required'});
 d.bookings.push(b);save(d);res.status(201).json(b);
});
app.post('/api/bookings/:id/dispatch',auth,(req,res)=>{
 const d=load(),b=d.bookings.find(x=>x.id===req.params.id&&x.userId===req.user.id);if(!b)return res.status(404).json({error:'Booking not found'});
 let workers=(d.workers.length?d.workers:DEMO_WORKERS).filter(w=>w.online&&w.verified&&Array.isArray(w.skills)&&w.skills.includes(b.serviceId));
 if(b.lat!=null&&b.lng!=null)workers=workers.map(w=>({...w,distanceKm:+distanceKm(b.lat,b.lng,w.lat,w.lng).toFixed(2)})).sort((a,c)=>(a.distanceKm??99)-(c.distanceKm??99));
 const w=workers[0]||null;b.worker=w?{id:w.id,name:w.name,role:w.role,rating:w.rating,jobs:w.jobs,eta:Math.max(8,Math.round((w.distanceKm||1)*6+6)),initials:w.name.split(' ').map(x=>x[0]).join('')}:null;b.status=w?'assigned':'searching';b.updatedAt=new Date().toISOString();save(d);res.json(b);
});
app.post('/api/bookings/:id/cancel',auth,(req,res)=>{
 const d=load(),b=d.bookings.find(x=>x.id===req.params.id&&x.userId===req.user.id);if(!b)return res.status(404).json({error:'Booking not found'});
 if(['completed','cancelled'].includes(b.status))return res.status(400).json({error:`Booking is already ${b.status}`});
 b.status='cancelled';b.cancelledAt=new Date().toISOString();b.updatedAt=new Date().toISOString();save(d);res.json({ok:true,status:b.status});
});
app.post('/api/payments/create',auth,async(req,res)=>{
 const d=load(),b=d.bookings.find(x=>x.id===req.body.bookingId&&x.userId===req.user.id);if(!b)return res.status(404).json({error:'Booking not found'});
 if(b.status==='cancelled')return res.status(400).json({error:'Cancelled booking cannot be paid'});
 const provider=(process.env.PAYMENT_PROVIDER||'demo').toLowerCase();
 if(provider==='demo'){b.payment={provider:'demo',status:'paid',id:id('PAY'),paidAt:new Date().toISOString()};b.status='paid';save(d);return res.json({ok:true,live:false,message:'Demo payment successful',payment:b.payment});}
 if(provider==='razorpay'){
  const keyId=process.env.RAZORPAY_KEY_ID,keySecret=process.env.RAZORPAY_KEY_SECRET;
  if(!keyId||!keySecret)return res.status(503).json({error:'Razorpay is selected but credentials are not configured'});
  try{
   const receipt=`hh_${b.id}`.slice(0,40);
   const body=JSON.stringify({amount:Math.round(Number(b.total)*100),currency:'INR',receipt,notes:{bookingId:b.id,service:b.serviceName}});
   const r=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${keyId}:${keySecret}`).toString('base64'),'Content-Type':'application/json'},body});
   const j=await r.json();if(!r.ok)throw Error(j.error?.description||'Razorpay order creation failed');
   b.payment={provider:'razorpay',status:'created',orderId:j.id,amount:j.amount,currency:j.currency};save(d);
   return res.json({ok:true,live:true,keyId,order:j});
  }catch(e){return res.status(502).json({error:e.message})}
 }
 return res.status(501).json({error:`Unsupported PAYMENT_PROVIDER: ${provider}`});
});

app.post('/api/payments/confirm',auth,async(req,res)=>{
 const {bookingId,paymentId,orderId,signature}=req.body||{},d=load(),b=d.bookings.find(x=>x.id===bookingId&&x.userId===req.user.id);if(!b)return res.status(404).json({error:'Booking not found'});
 if((process.env.PAYMENT_PROVIDER||'').toLowerCase()!=='razorpay')return res.status(400).json({error:'Live payment confirmation is only enabled for Razorpay'});
 const secret=process.env.RAZORPAY_KEY_SECRET;if(!secret||!paymentId||!orderId||!signature)return res.status(400).json({error:'Payment confirmation data is incomplete'});
 const expected=crypto.createHmac('sha256',secret).update(`${orderId}|${paymentId}`).digest('hex');
 if(expected!==signature)return res.status(400).json({error:'Payment signature verification failed'});
 b.payment={...(b.payment||{}),provider:'razorpay',status:'paid',paymentId,orderId,paidAt:new Date().toISOString()};b.status='paid';b.updatedAt=new Date().toISOString();save(d);res.json({ok:true,payment:b.payment});
});
app.post('/api/bookings/:id/rating',auth,(req,res)=>{const rating=Number(req.body.rating);if(!Number.isInteger(rating)||rating<1||rating>5)return res.status(400).json({error:'Rating must be 1 to 5'});const d=load(),b=d.bookings.find(x=>x.id===req.params.id&&x.userId===req.user.id);if(!b)return res.status(404).json({error:'Booking not found'});if(!['paid','completed'].includes(b.status))return res.status(400).json({error:'Rate the service after completion/payment'});b.rating={stars:rating,createdAt:new Date().toISOString()};b.updatedAt=new Date().toISOString();save(d);res.json({ok:true,rating:b.rating});});
app.post('/api/support/tickets',auth,(req,res)=>{
 const subject=String(req.body.subject||'').trim();if(!subject)return res.status(400).json({error:'Describe the issue'});
 const d=load(),t={id:id('CASE'),userId:req.user.id,type:req.body.type||'general',subject,status:'open',bookingId:req.body.bookingId||null,createdAt:new Date().toISOString()};
 d.tickets.push(t);save(d);res.status(201).json({id:t.id,status:t.status,message:`Support case ${t.id} created.`});
});
app.post('/api/workers/apply',(req,res)=>{
 const required=['name','phone','services'];for(const k of required)if(!req.body[k])return res.status(400).json({error:`${k} required`});
 const d=load(),w={id:id('WA'),name:String(req.body.name),phone:normalizePhone(req.body.phone),skills:Array.isArray(req.body.services)?req.body.services:[],experience:String(req.body.experience||''),status:'pending_review',verified:false,online:false,createdAt:new Date().toISOString()};
 d.workers.push(w);save(d);res.status(201).json({id:w.id,status:w.status,message:'Registration received. Mobile, identity, skills and payout details can be verified during operations review.'});
});

app.get('/api/admin/summary',auth,adminAuth,(req,res)=>{
 const d=load();res.json({bookings:d.bookings.length,workers:d.workers.length,pendingWorkers:d.workers.filter(w=>w.status==='pending_review').length,users:d.users.length,paidBookings:d.bookings.filter(b=>b.status==='paid').length,tickets:d.tickets.length});
});

async function aiRouter({messages,task}){
 const system={role:'system',content:`You are HomeHero AI, a household-services support and booking assistant. Task: ${task}. Give accurate, concise, practical answers. Help identify the appropriate service, explain estimates, booking steps and support options. Never claim a worker is verified, a payment succeeded, an ETA is exact, a refund was issued, or a safety incident is resolved unless that fact is supplied by the application. For safety-sensitive household issues, advise the user to avoid dangerous electrical/gas/water actions and contact an appropriate professional. Do not expose secrets.`};
 const providers=[
  process.env.OPENROUTER_API_KEY?['openrouter',async()=>{const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':process.env.APP_URL||'http://localhost:8787','X-Title':'HomeHero'},body:JSON.stringify({model:process.env.OPENROUTER_MODEL||'openai/gpt-oss-120b',messages:[system,...messages],temperature:.2})});const j=await r.json();if(!r.ok)throw Error(j.error?.message||'OpenRouter error');return {provider:'openrouter',model:j.model,text:j.choices?.[0]?.message?.content||''}}]:null,
  process.env.GROQ_API_KEY?['groq',async()=>{const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',messages:[system,...messages],temperature:.2})});const j=await r.json();if(!r.ok)throw Error(j.error?.message||'Groq error');return {provider:'groq',model:j.model,text:j.choices?.[0]?.message?.content||''}}]:null,
  process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_API_TOKEN?['cloudflare',async()=>{const model=process.env.CLOUDFLARE_AI_MODEL||'@cf/meta/llama-3.1-8b-instruct',url=`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messages:[system,...messages]})});const j=await r.json();if(!r.ok)throw Error(j.errors?.[0]?.message||'Cloudflare AI error');return {provider:'cloudflare',model,text:j.result?.response||''}}]:null
 ].filter(Boolean);
 for(const [,run] of providers){try{return await run()}catch(e){/* fail over to next configured provider */}}
 const q=String(messages.at(-1)?.content||'').toLowerCase();
 let text='Tell me what is happening at home and I can help choose a service, explain the estimate, prepare the booking, or guide you to support.';
 if(/leak|tap|pipe|water/.test(q))text='A leaking tap or pipe normally needs a Plumber. Add the exact location and whether the leak is continuous in the booking notes. If water is near electrical equipment, avoid touching wet electrical parts and contact a professional.';
 else if(/clean|dust|bathroom/.test(q))text='For routine or deep household cleaning, choose Home Cleaning. Select the duration and add the rooms or tasks you want covered.';
 else if(/ac|cooling/.test(q))text='For an AC not cooling, choose AC Service. Describe the symptom and unit type in the notes. Avoid opening electrical panels yourself.';
 else if(/price|cost|₹|charge/.test(q))text='HomeHero calculates the estimate from the selected service, duration, travel, platform fee, optional Express fee and applicable offer. Review the complete total before confirming.';
 return {provider:'local',model:'HomeHero Smart Support',text};
}
app.post('/api/ai/chat',auth,async(req,res)=>{try{res.json(await aiRouter({messages:req.body.messages||[],task:req.body.task||'general'}))}catch(e){res.status(502).json({error:e.message})}});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../../frontend/index.html')));
const port=process.env.PORT||8787;
app.listen(port,()=>console.log(`HomeHero API listening on ${port}`));
