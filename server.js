const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

const app = express();
const PORT = Number(process.env.PORT || process.env.SERVER_PORT || process.env.APP_PORT || 3000);
const DB = path.join(__dirname, 'database', 'data.json');
const PUBLIC = path.join(__dirname, 'public');
const startedAt = Date.now();

app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));
app.use(express.static(PUBLIC, { maxAge: '2m' }));

function blank(){ return { employees: [], attendance: [], devices: [], activities: [] }; }
function readDB(){ try { return JSON.parse(fs.readFileSync(DB,'utf8')); } catch(e){ return blank(); } }
function writeDB(db){ fs.mkdirSync(path.dirname(DB), {recursive:true}); fs.writeFileSync(DB, JSON.stringify(db,null,2)); }
function nowISO(){ return new Date().toISOString(); }
function todayJakarta(){ return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
function timeJakarta(){ return new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replaceAll('.',':'); }
function minutes(hm){ const [h,m] = String(hm).slice(0,5).split(':').map(Number); return h*60+m; }
function haversine(lat1, lon1, lat2, lon2){
  const R=6371000, toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}
function log(db,type,detail,actor='system'){
  db.activities ||= [];
  db.activities.unshift({ id:'act_'+Date.now()+Math.random().toString(16).slice(2), type, detail, actor, at:nowISO() });
  db.activities = db.activities.slice(0,300);
}
function seed(db){
  db.employees ||= []; db.attendance ||= []; db.devices ||= []; db.activities ||= [];
  if(!db.employees.some(e=>e.username==='rian01')) db.employees.push({id:'emp_rian',name:'Rian',username:'rian01',password:'123456',role:'Karyawan',phone:'-',active:true,createdAt:nowISO()});
  if(!db.employees.some(e=>e.username==='dina01')) db.employees.push({id:'emp_dina',name:'Dina',username:'dina01',password:'123456',role:'Kasir',phone:'-',active:true,createdAt:nowISO()});
}
function publicStatus(){ return { online:true, message:'Server Online', app:cfg.appName, brand:cfg.brand, version:'8.0.0-render', node:process.version, port:PORT, uptimeSeconds:Math.round((Date.now()-startedAt)/1000), time:nowISO(), serverTime:timeJakarta() }; }

app.get('/api/health', (req,res)=> res.json({ ok:true, ...publicStatus() }));
app.get('/api/status', (req,res)=> res.json({ ok:true, status:publicStatus(), config:{ store:cfg.store, attendance:cfg.attendance } }));
app.get('/api/config', (req,res)=> res.json({ ok:true, appName:cfg.appName, brand:cfg.brand, store:cfg.store, attendance:cfg.attendance, today:todayJakarta(), serverTime:timeJakarta() }));

app.post('/api/login',(req,res)=>{
  const { username='', password='', deviceName='Android APK', deviceId='device' } = req.body || {};
  const db=readDB(); seed(db);
  let user=null;
  if(username===cfg.owner.username && password===cfg.owner.password) user={id:'owner',name:'Owner Sejahtera',role:'Owner',username};
  else {
    const emp=db.employees.find(e=>e.username===username && e.password===password && e.active!==false);
    if(emp) user={id:emp.id,name:emp.name,role:emp.role || 'Karyawan',username:emp.username};
  }
  if(!user){ log(db,'LOGIN_GAGAL',`Login gagal: ${username || '-'}`,username || '-'); writeDB(db); return res.status(401).json({ok:false,message:'Username atau password salah'}); }
  const rec={deviceId,deviceName,userId:user.id,name:user.name,role:user.role,online:true,lastSeen:nowISO()};
  const i=db.devices.findIndex(d=>d.deviceId===deviceId && d.userId===user.id);
  if(i>=0) db.devices[i]={...db.devices[i],...rec}; else db.devices.unshift(rec);
  log(db,'LOGIN',`${user.name} login dari ${deviceName}`,user.name); writeDB(db);
  res.json({ok:true,user,token:Buffer.from(`${user.id}:${Date.now()}`).toString('base64')});
});

app.post('/api/device/ping',(req,res)=>{
  const {userId='guest',name='Guest',role='-',deviceId='device',deviceName='Android APK'}=req.body||{};
  const db=readDB(); seed(db);
  const rec={deviceId,deviceName,userId,name,role,online:true,lastSeen:nowISO()};
  const i=db.devices.findIndex(d=>d.deviceId===deviceId && d.userId===userId);
  if(i>=0) db.devices[i]={...db.devices[i],...rec}; else db.devices.unshift(rec);
  writeDB(db); res.json({ok:true});
});

app.get('/api/owner/dashboard',(req,res)=>{
  const db=readDB(); seed(db); writeDB(db);
  const today=todayJakarta(); const rows=db.attendance.filter(a=>a.date===today);
  const by=s=>rows.filter(r=>r.status===s).length;
  const activeDevices = (db.devices||[]).filter(d=>Date.now()-new Date(d.lastSeen).getTime()<1000*60*10).length;
  res.json({ok:true,server:publicStatus(),summary:{hadir:by('VALID')+by('TOLERANSI'),telat:by('TELAT'),izin:by('IZIN'),ditolak:by('DITOLAK'),devices:activeDevices},employees:db.employees,recent:db.attendance.slice(0,50),devices:db.devices.slice(0,50),activities:db.activities.slice(0,60),config:{store:cfg.store,attendance:cfg.attendance}});
});

app.post('/api/owner/employee',(req,res)=>{
  const {name,username,password,role='Karyawan',phone='-'}=req.body||{};
  if(!name||!username||!password) return res.status(400).json({ok:false,message:'Nama, username, password wajib'});
  const db=readDB(); seed(db);
  if(db.employees.some(e=>e.username===username)) return res.status(409).json({ok:false,message:'Username sudah dipakai'});
  const emp={id:'emp_'+Date.now(),name,username,password,role,phone,active:true,createdAt:nowISO()};
  db.employees.unshift(emp); log(db,'TAMBAH_KARYAWAN',`Menambahkan ${name}`,'Owner'); writeDB(db); res.json({ok:true,employee:emp});
});

app.post('/api/attendance/checkin',(req,res)=>{
  const { userId, name, lat, lng, selfie='' } = req.body || {};
  if(!userId||!name) return res.status(400).json({ok:false,message:'User belum login'});
  if(typeof lat!=='number'||typeof lng!=='number') return res.status(400).json({ok:false,message:'GPS tidak terbaca'});
  const db=readDB(); seed(db); const date=todayJakarta(); const serverTime=timeJakarta();
  if(db.attendance.some(a=>a.userId===userId && a.date===date && a.type==='MASUK')) return res.status(409).json({ok:false,message:'Sudah absen masuk hari ini'});
  const dist=haversine(cfg.store.lat,cfg.store.lng,lat,lng);
  const cur=minutes(serverTime), start=minutes(cfg.attendance.startTime);
  let status='VALID', note='Hadir normal';
  if(dist>cfg.store.radiusMeter){ status='DITOLAK'; note='Di luar area toko'; }
  else if(cur>start+cfg.attendance.limitMinutes){ status='TELAT'; note='Lewat batas 10 menit'; }
  else if(cur>start+cfg.attendance.toleranceMinutes){ status='TOLERANSI'; note='Dalam batas toleransi'; }
  const rec={id:'att_'+Date.now(),type:'MASUK',userId,name,date,serverTime,lat,lng,distanceMeter:dist,status,note,selfie:selfie?'ADA':'TIDAK_ADA',locked:true,createdAt:nowISO()};
  db.attendance.unshift(rec); log(db,'ABSEN_MASUK',`${name} ${status} (${dist} m)`,name); writeDB(db); res.json({ok:true,attendance:rec});
});

app.post('/api/attendance/permission',(req,res)=>{
  const {userId,name,type='IZIN',reason='-'}=req.body||{};
  const db=readDB(); seed(db);
  const rec={id:'perm_'+Date.now(),userId,name,type,status:'IZIN',reason,date:todayJakarta(),serverTime:timeJakarta(),locked:true,createdAt:nowISO()};
  db.attendance.unshift(rec); log(db,'IZIN',`${name} ${type}: ${reason}`,name); writeDB(db); res.json({ok:true,attendance:rec});
});

app.get('*',(req,res)=>res.sendFile(path.join(PUBLIC,'index.html')));
app.listen(PORT,'0.0.0.0',()=>{
  console.log('================================');
  console.log('Absen Sejahtera server running');
  console.log('Node:', process.version);
  console.log('Port:', PORT);
  console.log('Health: /api/health');
  console.log('Render OK: use process.env.PORT');
  console.log('Owner:', cfg.owner.username);
  console.log('================================');
});
