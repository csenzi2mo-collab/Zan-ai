# ZanAI — Midtrans Backend Edition

Versi ini mengubah flow pembayaran ZanAI dari mock/local QRIS menjadi backend server + Midtrans Snap + webhook.

## Struktur

- `ZanAI/` — frontend HTML asli ZanAI
- `server.js` — backend HTTP Node.js tanpa framework/dependency tambahan
- `data/db.json` — penyimpanan sederhana untuk user/key/order/history
- `.env.example` — contoh konfigurasi Midtrans dan DeepSeek
- `package.json` — script start

## Jalankan

Gunakan Node.js 18+.

1. Salin `.env.example` menjadi `.env` atau set environment variable pada hosting.
2. Isi:
   - `MIDTRANS_SERVER_KEY`
   - `MIDTRANS_CLIENT_KEY`
   - `MIDTRANS_IS_PRODUCTION=false` untuk Sandbox
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
3. Jalankan `node server.js`.
4. Buka `http://localhost:3000`.

Server ini memakai Node.js built-in `fetch`, jadi tidak membutuhkan npm package runtime tambahan.

## Midtrans Webhook

Set Payment Notification URL di dashboard Midtrans ke:

`https://DOMAIN-KAMU/api/midtrans/notification`

Endpoint tersebut memvalidasi `signature_key` menggunakan SHA-512 sebelum mengubah order menjadi `PAID` dan menerbitkan access key.

## Flow pembayaran

User → pilih paket → backend membuat Snap transaction → Snap/Midtrans → pembayaran → webhook → verifikasi signature → order `PAID` → access key otomatis dibuat.

## Penting

- Jangan masukkan `MIDTRANS_SERVER_KEY` ke HTML/frontend.
- Gunakan HTTPS pada production.
- Gunakan Sandbox untuk pengujian awal.
- `data/db.json` cocok untuk demo/proyek kecil. Untuk production dengan trafik tinggi, pindahkan storage ke database seperti PostgreSQL/MySQL.


## Vercel deployment

This package now includes `api/index.js` and `vercel.json` for Vercel.
Set these Environment Variables in Vercel:
- `MIDTRANS_SERVER_KEY`
- `MIDTRANS_CLIENT_KEY`
- `MIDTRANS_IS_PRODUCTION=false` for Sandbox
- `SESSION_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`

Important: `data/db.json` is suitable for local development only. Vercel serverless storage is ephemeral, so production use should connect the order/key/history data to a persistent database (for example Supabase/Postgres) before accepting real payments.
