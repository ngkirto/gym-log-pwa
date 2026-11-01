# 兩分法訓練記錄（PWA）

A1／B1／A2／B2 訓練記錄：逐組記重量同次數，顯示上次成績、建議休息時間同「可加重」提示。

- 純 HTML + JavaScript（ES modules），冇 build 步驟
- 托管：GitHub Pages
- 資料庫：Firebase Firestore（`users/<uid>/sessions/<日期_日子>`），Google 登入
- 未設定 Firebase 或未登入時，記錄存喺手機瀏覽器（localStorage），登入後自動上載

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 畫面同樣式 |
| `app.js` | 訓練計劃、記錄邏輯、Firebase 讀寫 |
| `firebase-config.js` | Firebase 設定（要自己填） |
| `firestore.rules` | 資料庫安全規則：只有自己讀寫到自己嘅記錄 |
| `manifest.webmanifest`、`sw.js`、`icons/` | PWA：加到主畫面、離線開啟 |

## 設定 Firebase

1. 去 https://console.firebase.google.com 建立新專案（Google Analytics 可以唔開）
2. **Build → Firestore Database → 建立資料庫**，揀 production mode，地區揀 `asia-east2`（香港）
3. Firestore → **Rules**，貼上 `firestore.rules` 內容，Publish
4. **Build → Authentication → 開始使用 → Sign-in method → Google → 啟用**
5. Authentication → **Settings → Authorized domains → 加入 `<你的 GitHub username>.github.io`**
6. **專案設定（齒輪）→ 你的應用程式 → 網頁（</>）→ 註冊應用程式**，複製 `firebaseConfig` 入 `firebase-config.js`
7. commit + push

## 更新

改完 code 之後，將 `sw.js` 入面 `VERSION` 加一（例如 `v2`），手機下次開就會用新版本。

## 安裝到手機

用 Chrome 開 `https://<username>.github.io/<repo>/` → 右上角選單 →「加到主畫面」／「安裝應用程式」。

## 搬舊記錄

頁面底部「匯入記錄」揀 JSON 檔（格式同「匯出備份」一樣）。

## 測試

功能測試同壓力測試用 Playwright 喺真瀏覽器操作 app（Firebase 會被替換，唔會掂到真資料庫）。

```powershell
npm install
npx playwright install chromium
npm test
```

- `tests/app.test.mjs`：儲存、上次記錄、可加重、kg/lb、加組、開新一次、改日期、轉分頁、刪除、匯入匯出、手機闊度
- `tests/stress.test.mjs`：1,000 次記錄載入、快速轉分頁、快速輸入、2,000 次記錄匯入、儲存空間滿
