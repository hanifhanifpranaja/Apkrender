# Absen Sejahtera - Render Server v8

Deploy paling mudah pakai Render Web Service.

## Setting Render
- Build Command: `npm install`
- Start Command: `npm start`
- Node: 20/22/24 aman

Render akan memberi URL seperti:
`https://absen-sejahtera.onrender.com`

Tes server:
`https://absen-sejahtera.onrender.com/api/health`

Kalau muncul JSON dengan `ok: true`, APK bisa konek.

## Environment opsional
- OWNER_USERNAME=Barokah
- OWNER_PASSWORD=Barokah123
- STORE_LAT=-2.054619
- STORE_LNG=125.980278
- STORE_RADIUS=50
- START_TIME=08:30
- TOLERANCE_MINUTES=5
- LIMIT_MINUTES=10

Catatan: Render free dapat sleep jika lama tidak dipakai. Buka pertama bisa lebih lama.
