# ZanAI — Midtrans + Vercel

Struktur ini dibuat agar frontend berada di root sehingga mudah di-upload dari GitHub mobile.

## Struktur
- `api/index.js` — Vercel Serverless Function
- `server.js` — backend/API + local server
- semua halaman `.html` — frontend
- `vercel.json` — routing Vercel

## Environment Variables
Set di Vercel:
- `MIDTRANS_SERVER_KEY`
- `MIDTRANS_CLIENT_KEY`
- `MIDTRANS_IS_PRODUCTION=false` untuk Sandbox
- `SESSION_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `DEEPSEEK_API_KEY`

Jangan commit `.env`.

## GitHub mobile
Upload file-file root ke repository. Untuk folder API, buat file melalui GitHub:
`api/index.js`
GitHub akan otomatis membuat folder `api/`.

## Webhook Midtrans
Set URL:
`https://DOMAIN-KAMU/api/midtrans/notification`

Catatan: penyimpanan JSON di Vercel `/tmp` bersifat sementara. Untuk data produksi, gunakan database seperti Postgres/Supabase.
