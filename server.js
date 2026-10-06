import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';

const app = express();
const db = new Database('khidmeni.db');
const SECRET = process.env.JWT_SECRET;
if (!SECRET) console.warn('WARNING: JWT_SECRET is not set. Set a strong secret before production deployment.');
const JWT_SECRET = SECRET || 'LOCAL_ONLY_CHANGE_ME';

app.use(cors({origin: true}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 phone TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user',
 click_number TEXT DEFAULT '',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS services(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 category TEXT NOT NULL,
 description TEXT,
 price REAL NOT NULL,
 provider_id INTEGER
);
CREATE TABLE IF NOT EXISTS requests(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 service_id INTEGER NOT NULL,
 details TEXT,
 provider_id INTEGER,
 status TEXT DEFAULT 'new',
 click_number TEXT DEFAULT '',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notifications(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 provider_id INTEGER NOT NULL,
 request_id INTEGER NOT NULL,
 message TEXT NOT NULL,
 read INTEGER DEFAULT 0,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const devs = [
 ['admin', process.env.ADMIN_PHONE || 'admin@khidmeni.local', process.env.ADMIN_PASSWORD || 'khidmeni2026'],
 ['developer2', process.env.DEV2_PHONE || 'developer2@khidmeni.local', process.env.DEV2_PASSWORD || 'khidmeni2026-2'],
 ['developer3', process.env.DEV3_PHONE || 'developer3@khidmeni.local', process.env.DEV3_PASSWORD || 'khidmeni2026-3']
];
for (const [name, phone, pw] of devs) {
 const u = db.prepare('SELECT id FROM users WHERE phone=?').get(phone);
 if (!u) db.prepare('INSERT INTO users(name,phone,password,role) VALUES(?,?,?,?)').run(name, phone, bcrypt.hashSync(pw, 10), 'developer');
}

if (!db.prepare('SELECT id FROM services LIMIT 1').get()) {
 const services = [
  ['تصميم عروض تقديمية','تصميم','تصميم PowerPoint مرتب للمشاريع والعروض الجامعية.',5],
  ['ترجمة عربي ↔ إنجليزي','ترجمة','ترجمة ملفات وبحوث قصيرة مع تنسيق مناسب.',2],
  ['مساعدة برمجية','برمجة','مساعدة في مشاريع الويب والبرمجة للطلاب.',5],
  ['تلخيص وتنظيم ملاحظات','دراسة','تنظيم وتلخيص ملاحظاتك بطريقة واضحة للدراسة.',2],
  ['تدقيق واجبات جامعية','دراسة','مراجعة وتنظيم الواجبات الجامعية والتأكد من الأخطاء الإملائية والتنسيق.',5],
  ['تصوير مناسبات ومشاريع','تصوير','تصوير بسيط داخل الجامعة أو للمشاريع الطلابية.',5]
 ];
 const ins = db.prepare('INSERT INTO services(name,category,description,price) VALUES(?,?,?,?)');
 for (const s of services) ins.run(...s);
}

function auth(req, res, next) {
 try {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw new Error();
  req.user = jwt.verify(token, JWT_SECRET);
  next();
 } catch { res.status(401).json({error:'يجب تسجيل الدخول'}); }
}
function developer(req,res,next){
 if(req.user?.role !== 'developer') return res.status(403).json({error:'غير مصرح'});
 next();
}
function tokenFor(user){ return jwt.sign({id:user.id, role:user.role}, JWT_SECRET, {expiresIn:'7d'}); }
function publicUser(u){ return {id:u.id,name:u.name,phone:u.phone,role:u.role,click_number:u.click_number||''}; }

app.get('/api/health',(req,res)=>res.json({ok:true,service:'khidmeni'}));

app.post('/api/register',(req,res)=>{
 const {name,phone,password} = req.body || {};
 if(!name || !phone || !password || String(password).length < 6) return res.status(400).json({error:'أدخل الاسم ورقم الهاتف وكلمة مرور 6 أحرف/أرقام على الأقل'});
 try {
  const hash=bcrypt.hashSync(String(password),10);
  const r=db.prepare('INSERT INTO users(name,phone,password) VALUES(?,?,?)').run(String(name).trim(),String(phone).trim(),hash);
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);
  res.json({token:tokenFor(u),user:publicUser(u)});
 } catch { res.status(409).json({error:'رقم الهاتف مستخدم مسبقًا'}); }
});

app.post('/api/login',(req,res)=>{
 const {phone,password}=req.body || {};
 const u=db.prepare('SELECT * FROM users WHERE phone=?').get(String(phone||'').trim());
 if(!u || !bcrypt.compareSync(String(password||''),u.password)) return res.status(401).json({error:'بيانات الدخول غير صحيحة'});
 res.json({token:tokenFor(u),user:publicUser(u)});
});

app.get('/api/me',auth,(req,res)=>{
 const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
 if(!u) return res.status(404).json({error:'المستخدم غير موجود'});
 res.json({user:publicUser(u)});
});

app.get('/api/services',(req,res)=>res.json(db.prepare(`
 SELECT s.*, u.name provider_name, u.phone provider_phone, u.click_number provider_click
 FROM services s LEFT JOIN users u ON u.id=s.provider_id ORDER BY s.id DESC
`).all()));

app.post('/api/provider/click',auth,(req,res)=>{
 const n=String(req.body?.click_number||'').trim();
 if(!n) return res.status(400).json({error:'أدخل رقم Click'});
 db.prepare('UPDATE users SET click_number=? WHERE id=?').run(n,req.user.id);
 res.json({ok:true,click_number:n});
});

app.post('/api/provider/offer',auth,(req,res)=>{
 const {service_id}=req.body || {};
 const s=db.prepare('SELECT * FROM services WHERE id=?').get(service_id);
 if(!s) return res.status(404).json({error:'الخدمة غير موجودة'});
 if(s.provider_id && Number(s.provider_id)!==Number(req.user.id)) return res.status(409).json({error:'هذه الخدمة مرتبطة حاليًا بمقدم خدمة آخر'});
 const me=db.prepare('SELECT click_number FROM users WHERE id=?').get(req.user.id);
 if(!me?.click_number) return res.status(400).json({error:'ضع رقم CliQ أولًا ثم اختر الخدمة'});
 db.prepare('UPDATE services SET provider_id=? WHERE id=?').run(req.user.id,service_id);
 res.json({ok:true});
});

app.post('/api/requests',auth,(req,res)=>{
 const {service_id,details}=req.body || {};
 const s=db.prepare('SELECT * FROM services WHERE id=?').get(service_id);
 if(!s) return res.status(404).json({error:'الخدمة غير موجودة'});
 if(!s.provider_id) return res.status(400).json({error:'هذه الخدمة لم يتم تعيين مقدم خدمة لها بعد'});
 if(Number(s.provider_id)===Number(req.user.id)) return res.status(400).json({error:'لا يمكنك طلب خدمتك أنت'});
 const p=db.prepare('SELECT id,name,click_number FROM users WHERE id=?').get(s.provider_id);
 if(!p) return res.status(400).json({error:'مقدم الخدمة غير موجود'});
 const r=db.prepare('INSERT INTO requests(user_id,service_id,details,provider_id,click_number) VALUES(?,?,?,?,?)').run(req.user.id,service_id,String(details||''),s.provider_id,p.click_number||'');
 db.prepare('INSERT INTO notifications(provider_id,request_id,message) VALUES(?,?,?)').run(s.provider_id,r.lastInsertRowid,'طلب جديد لخدمة: '+s.name);
 res.json({ok:true,request_id:r.lastInsertRowid,click_number:p.click_number||'',provider_name:p.name});
});

app.get('/api/notifications',auth,(req,res)=>res.json(db.prepare(`
 SELECT n.*, r.status, s.name service_name, u.name customer_name
 FROM notifications n
 JOIN requests r ON r.id=n.request_id
 JOIN services s ON s.id=r.service_id
 JOIN users u ON u.id=r.user_id
 WHERE n.provider_id=? ORDER BY n.id DESC
`).all(req.user.id)));
app.post('/api/notifications/read',auth,(req,res)=>{
 db.prepare('UPDATE notifications SET read=1 WHERE provider_id=?').run(req.user.id);
 res.json({ok:true});
});

app.get('/api/requests',auth,(req,res)=>res.json(db.prepare(`
 SELECT r.*,s.name service_name,s.price,u.name customer_name,p.name provider_name
 FROM requests r
 JOIN services s ON s.id=r.service_id
 JOIN users u ON u.id=r.user_id
 LEFT JOIN users p ON p.id=r.provider_id
 WHERE r.provider_id=? OR r.user_id=? ORDER BY r.id DESC
`).all(req.user.id,req.user.id)));

app.patch('/api/requests/:id/status',auth,(req,res)=>{
 const allowed=['new','accepted','completed','cancelled'];
 const status=String(req.body?.status||'');
 if(!allowed.includes(status)) return res.status(400).json({error:'حالة غير صحيحة'});
 const r=db.prepare('SELECT * FROM requests WHERE id=?').get(req.params.id);
 if(!r || (r.provider_id!==req.user.id && r.user_id!==req.user.id)) return res.status(403).json({error:'غير مصرح'});
 db.prepare('UPDATE requests SET status=? WHERE id=?').run(status,r.id);
 res.json({ok:true});
});

app.get('/api/admin/stats',auth,developer,(req,res)=>{
 res.json({
  users:db.prepare("SELECT count(*) c FROM users WHERE role='user'").get().c,
  providers:db.prepare("SELECT count(*) c FROM users WHERE role='user' AND click_number<>''").get().c,
  requests:db.prepare('SELECT count(*) c FROM requests').get().c,
  services:db.prepare('SELECT count(*) c FROM services').get().c
 });
});
app.get('/api/admin/users',auth,developer,(req,res)=>res.json(db.prepare("SELECT id,name,phone,role,click_number,created_at FROM users ORDER BY id DESC").all()));
app.get('/api/admin/requests',auth,developer,(req,res)=>res.json(db.prepare(`SELECT r.*,s.name service_name,u.name customer_name,p.name provider_name FROM requests r JOIN services s ON s.id=r.service_id JOIN users u ON u.id=r.user_id LEFT JOIN users p ON p.id=r.provider_id ORDER BY r.id DESC`).all()));
app.post('/api/admin/service',auth,developer,(req,res)=>{
 const {name,category,description,price,provider_id}=req.body||{};
 if(!name||!category||Number.isNaN(Number(price))) return res.status(400).json({error:'بيانات الخدمة ناقصة'});
 const r=db.prepare('INSERT INTO services(name,category,description,price,provider_id) VALUES(?,?,?,?,?)').run(name,category,description||'',Number(price),provider_id||null);
 res.json({id:r.lastInsertRowid});
});
app.patch('/api/admin/service/:id',auth,developer,(req,res)=>{
 const {name,category,description,price,provider_id}=req.body||{};
 const s=db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id);
 if(!s) return res.status(404).json({error:'الخدمة غير موجودة'});
 db.prepare('UPDATE services SET name=?,category=?,description=?,price=?,provider_id=? WHERE id=?').run(name??s.name,category??s.category,description??s.description,price??s.price,provider_id??s.provider_id,s.id);
 res.json({ok:true});
});
app.delete('/api/admin/service/:id',auth,developer,(req,res)=>{db.prepare('DELETE FROM services WHERE id=?').run(req.params.id);res.json({ok:true})});

app.get('/robots.txt',(req,res)=>{res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: '+req.protocol+'://'+req.get('host')+'/sitemap.xml');});
app.get('/sitemap.xml',(req,res)=>{const base=req.protocol+'://'+req.get('host');res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+base+'/</loc></url></urlset>');});
app.get('*',(req,res)=>res.sendFile(process.cwd()+'/public/index.html'));

const port=process.env.PORT||3000;
app.listen(port,()=>console.log('Khidmeni running on http://localhost:'+port));
