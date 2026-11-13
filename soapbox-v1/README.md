# 公司肥皂箱 v1

公開匿名討論網站。**任何知道網址的人**都可以閱讀、發文、留言、按支持及檢舉，無需註冊。多位使用者共用 SQLite 資料庫。

## 網站架構

- `public/index.html`、`public/style.css`、`public/app.js`：公開前台
- `public/admin.html`、`public/admin.js`：內容管理頁
- `server.js`：Express API、資料驗證、限流與管理端認證
- `data/soapbox.sqlite`：持久化 SQLite 資料庫（第一次啟動自動產生）

## 本機啟動

需要 Node.js 20+：

```bash
npm install
cp .env.example .env
# 修改 .env 的 ADMIN_PASSWORD 為至少 16 字元的隨機強密碼
npm start
```

開啟 http://localhost:3000 ，管理後台 http://localhost:3000/admin.html 。管理帳號固定為 `admin`，密碼為環境變數 `ADMIN_PASSWORD`。

## 對外發布

建議部署到支援 Node.js 和**持久化磁碟**的主機，例如 VPS、Fly.io（掛 Volume）或有 Persistent Disk 的服務。設定：

- `NODE_ENV=production`
- `ADMIN_PASSWORD`：至少 16 字元，勿上傳到 Git
- `DB_PATH=/data/soapbox.sqlite`：改成主機掛載的永久磁碟位置
- `TRUST_PROXY=1`：僅在確實位於**一層可信任反向代理**後方時設定
- `PORT`：主機平台會指定（若無則預設 3000）
- 必須配置 **HTTPS** 和備份 SQLite 資料庫

建議使用單一執行個體。**不要直接部署到只有暫存磁碟的無伺服器主機**：資料在重啟時可能消失。

## API

- `GET /api/posts?category=...&sort=new|popular&page=1`
- `POST /api/posts` `{category,title,body}`
- `GET /api/posts/:id/comments`
- `POST /api/posts/:id/comments` `{body}`
- `POST /api/posts/:id/like`
- `POST /api/reports` `{type:'post'|'comment',id,reason}`
- `GET /api/admin/reports`、`POST /api/admin/hide`、`POST /api/admin/resolve`：HTTP Basic 認證

## 範圍及安全注意

- **不提供絕對匿名保證**。應用程式資料表不儲存姓名、帳號或 IP；但網路、反向代理、主機平台、攻擊者及內容本身都可能讓身分被推知。Express 限流會在記憶體暫時處理連線 IP，網站部署端亦可能記錄存取日誌。
- 任何知道網址的人都能讀寫，包括公司外部。此版本沒有員工驗證，也不阻擋外人假扮員工。
- 按讚去重**只有瀏覽器端 localStorage**，清除紀錄或更換瀏覽器能重複按讚，不能把支持數當成正式民調。
- 限流用記憶體儲存，重啟會重置；有人惡意灌水時應加入 CAPTCHA、專業防護、IP 節流及審核策略，同時評估隱私風險。
- 透過 `textContent` 顯示所有使用者文字，避免直接注入 HTML；使用 Helmet 安全標頭。
- 文章和留言不提供自行編輯或刪除，管理員能依檢舉隱藏；管理後台只有被檢舉的項目可處理。
- 上線前應先完成壓力測試、異地備份、法律/隱私告知、檢舉處理SOP及安全性檢測。若涉及性騷擾、霸凌、貪腐等敏感申訴，應另設受保護的正式申訴管道，勿僅使用公開論壇。
