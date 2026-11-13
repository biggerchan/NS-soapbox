'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = path.resolve(process.env.DB_PATH || './data/soapbox.sqlite');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
if (process.env.NODE_ENV === 'production' && ADMIN_PASSWORD.length < 16) {
  throw new Error('Set ADMIN_PASSWORD to at least 16 characters before production deployment');
}
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 category TEXT NOT NULL,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 likes INTEGER NOT NULL DEFAULT 0,
 hidden INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 body TEXT NOT NULL,
 hidden INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 target_type TEXT NOT NULL CHECK (target_type IN ('post','comment')),
 target_id INTEGER NOT NULL,
 reason TEXT NOT NULL,
 resolved INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_visible_date ON posts(hidden, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, hidden, created_at);
`);

const app = express();
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy: {
  directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null }
}}));
app.use(express.json({limit: '16kb'}));
app.use('/api', rateLimit({windowMs: 15*60*1000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false, message: {error:'操作太頻繁，請稍後再試。'}}));
const writeLimiter = rateLimit({windowMs: 15*60*1000, limit: 15, standardHeaders:'draft-7', legacyHeaders:false, message: {error:'發文或互動過於頻繁，請 15 分鐘後再試。'}});
const categories = ['公司制度','工作環境','福利建議','心情分享','其他'];
const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0,max+1) : '';
const isValid = (s, min, max) => s.length >= min && s.length <= max;
const fail = (res, code, msg) => res.status(code).json({error: msg});

app.get('/api/posts', (req,res) => {
 const category = clean(req.query.category, 20);
 const sort = req.query.sort === 'popular' ? 'popular' : 'new';
 const limit = 30;
 const page = Math.min(100, Math.max(1, Number.parseInt(req.query.page,10)||1));
 const where = category && categories.includes(category) ? 'WHERE hidden=0 AND category=?' : 'WHERE hidden=0';
 const args = category && categories.includes(category) ? [category] : [];
 const order = sort === 'popular' ? 'likes DESC, created_at DESC' : 'created_at DESC';
 const rows = db.prepare(`SELECT id, category, title, body, likes, created_at,
 (SELECT COUNT(*) FROM comments WHERE post_id=posts.id AND hidden=0) AS comments_count
 FROM posts ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args,limit,(page-1)*limit);
 const total = db.prepare(`SELECT COUNT(*) AS count FROM posts ${where}`).get(...args).count;
 res.json({posts:rows, total, page, pages:Math.max(1,Math.ceil(total/limit))});
});
app.post('/api/posts', writeLimiter, (req,res) => {
 const category=clean(req.body?.category,20), title=clean(req.body?.title,100), body=clean(req.body?.body,1500);
 if (!categories.includes(category) || !isValid(title,4,100) || !isValid(body,10,1500)) return fail(res,400,'請填寫分類、4–100 字標題及 10–1500 字內容。');
 const result=db.prepare('INSERT INTO posts(category,title,body) VALUES(?,?,?)').run(category,title,body);
 res.status(201).json({id:result.lastInsertRowid});
});
app.get('/api/posts/:id/comments', (req,res) => {
 const id=Number(req.params.id); if (!Number.isSafeInteger(id)||id<1) return fail(res,400,'無效文章。');
 const post=db.prepare('SELECT id FROM posts WHERE id=? AND hidden=0').get(id);
 if (!post) return fail(res,404,'文章不存在。');
 res.json({comments:db.prepare('SELECT id,body,created_at FROM comments WHERE post_id=? AND hidden=0 ORDER BY created_at ASC LIMIT 300').all(id)});
});
app.post('/api/posts/:id/comments', writeLimiter, (req,res) => {
 const id=Number(req.params.id), body=clean(req.body?.body,500);
 if (!Number.isSafeInteger(id)||id<1 || !isValid(body,2,500)) return fail(res,400,'留言需要 2–500 字。');
 if (!db.prepare('SELECT id FROM posts WHERE id=? AND hidden=0').get(id)) return fail(res,404,'文章不存在。');
 const result=db.prepare('INSERT INTO comments(post_id,body) VALUES(?,?)').run(id,body);
 res.status(201).json({id:result.lastInsertRowid});
});
app.post('/api/posts/:id/like',writeLimiter,(req,res)=>{
 const id=Number(req.params.id);
 if (!Number.isSafeInteger(id)||id<1) return fail(res,400,'無效文章。');
 const info=db.prepare('UPDATE posts SET likes=likes+1 WHERE id=? AND hidden=0').run(id);
 if (!info.changes) return fail(res,404,'文章不存在。');
 res.json({ok:true});
});
app.post('/api/reports',writeLimiter,(req,res)=>{
 const type=clean(req.body?.type,20), id=Number(req.body?.id), reason=clean(req.body?.reason,200);
 if (!['post','comment'].includes(type)||!Number.isSafeInteger(id)||id<1||!isValid(reason,4,200)) return fail(res,400,'請選擇有效項目並輸入 4–200 字檢舉理由。');
 const table=type==='post'?'posts':'comments';
 if (!db.prepare(`SELECT id FROM ${table} WHERE id=? AND hidden=0`).get(id)) return fail(res,404,'項目不存在。');
 db.prepare('INSERT INTO reports(target_type,target_id,reason) VALUES(?,?,?)').run(type,id,reason);
 res.status(201).json({ok:true});
});

function adminAuth(req,res,next){
 if (!ADMIN_PASSWORD) return fail(res,503,'尚未設定管理員密碼。');
 const value=req.headers.authorization||'';
 const raw=value.startsWith('Basic ')?Buffer.from(value.slice(6),'base64').toString('utf8'):'';
 const split=raw.indexOf(':'); const name=split>=0?raw.slice(0,split):''; const pass=split>=0?raw.slice(split+1):'';
 const expected=Buffer.from(ADMIN_PASSWORD); const actual=Buffer.from(pass);
 const equal=actual.length===expected.length && crypto.timingSafeEqual(actual,expected);
 if (name!=='admin'||!equal) {res.setHeader('WWW-Authenticate','Basic realm="Soapbox Admin"');return fail(res,401,'需要管理員認證。');}
 next();
}
app.use('/api/admin',adminAuth);
app.get('/api/admin/reports',(req,res)=>{
 res.json({reports:db.prepare(`SELECT r.*, CASE WHEN r.target_type='post' THEN (SELECT title FROM posts WHERE id=r.target_id) ELSE (SELECT body FROM comments WHERE id=r.target_id) END AS target_excerpt FROM reports r WHERE r.resolved=0 ORDER BY r.created_at DESC LIMIT 200`).all()});
});
app.post('/api/admin/hide',(req,res)=>{
 const type=clean(req.body?.type,20),id=Number(req.body?.id);
 if (!['post','comment'].includes(type)||!Number.isSafeInteger(id)||id<1) return fail(res,400,'無效項目。');
 const table=type==='post'?'posts':'comments';
 const result=db.prepare(`UPDATE ${table} SET hidden=1 WHERE id=?`).run(id);
 db.prepare('UPDATE reports SET resolved=1 WHERE target_type=? AND target_id=?').run(type,id);
 res.json({ok:result.changes>0});
});
app.post('/api/admin/resolve',(req,res)=>{
 const id=Number(req.body?.id);if(!Number.isSafeInteger(id)||id<1)return fail(res,400,'無效檢舉。');
 res.json({ok:db.prepare('UPDATE reports SET resolved=1 WHERE id=?').run(id).changes>0});
});
app.use(express.static(path.join(__dirname,'public'),{index:'index.html',maxAge:0}));
app.use((err,req,res,next)=>{if(err instanceof SyntaxError&&'body'in err)return fail(res,400,'JSON 格式錯誤。');console.error(err);fail(res,500,'伺服器發生錯誤。');});
app.listen(PORT,()=>console.log(`Soapbox running at http://localhost:${PORT}`));
