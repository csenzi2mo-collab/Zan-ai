ZanAI — Frontend HTML Standalone

Semua halaman memiliki CSS dan JavaScript di dalam file HTML masing-masing. Tidak ada backend di paket ini.

Halaman user: dashboard.html, chat.html, history.html, account.html, settings.html, qris.html, qris-payment.html, qris-history.html.
Halaman admin: admin-login.html, admin-dashboard.html, admin-members.html, admin-keys.html, admin-orders.html, admin-settings.html.
Halaman reseller: reseller-login.html, reseller-dashboard.html, reseller-create.html, reseller-members.html, reseller-history.html, reseller-settings.html.

Frontend memakai API backend melalui same-origin secara default. Jika backend berada di alamat lain, server hosting dapat menyediakan window.ZAN_API_BASE sebelum halaman berjalan. API key DeepSeek hanya dikirim ke endpoint konfigurasi admin dan tidak disimpan di HTML/localStorage.

Untuk KSWEB/Termux, letakkan file HTML di document root web server. Backend/API tetap perlu dijalankan terpisah untuk autentikasi, database, AI, pembayaran, dan webhook nyata.


PERBAIKAN V4
- Navigasi bawah mengikuti halaman aktif dan dapat berpindah antar halaman.
- Access key ditampilkan lengkap dan tersedia tombol Salin.
- Data non-backend tetap menggunakan localStorage.
- QRIS tetap membutuhkan API key/backend/provider pembayaran.
