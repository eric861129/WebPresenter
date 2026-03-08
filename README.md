# WebPresenter

WebPresenter 是一個完全運行於瀏覽器的線上簡報工具，支援 `PDF` 與 `PPTX` 上傳、單視窗或雙視窗簡報、手機掃描 QR Code 遙控、PPTX speaker notes 顯示，以及黑屏聚焦模式。

## 目前功能

- `PDF` 匯入與播放，透過 `PDF.js` 在瀏覽器端渲染。
- `PPTX` best-effort 匯入與播放，支援基本文字、圖片、背景色與 speaker notes。
- 演講者主控台、觀眾視圖、手機遙控頁三種模式。
- `BroadcastChannel` 雙視窗同步。
- `PeerJS` + QR Code 手機遙控配對。
- PWA shell 與 GitHub Pages 部署設定。

## 開發

```bash
npm install
npm run dev
```

## 驗證

```bash
npm run lint
npm test
npm run build
```

## 部署

專案已包含 GitHub Pages workflow：`.github/workflows/deploy.yml`。

Vite `base` 已設定為 `/WebPresenter/`，適用於此 repo 的 GitHub Pages project site。
