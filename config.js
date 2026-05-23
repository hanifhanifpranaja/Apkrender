module.exports = {
  appName: 'Absen Sejahtera',
  brand: 'Sejahtera TB',
  owner: {
    username: process.env.OWNER_USERNAME || 'Barokah',
    password: process.env.OWNER_PASSWORD || 'Barokah123'
  },
  store: {
    name: process.env.STORE_NAME || 'Sejahtera TB',
    address: process.env.STORE_ADDRESS || 'Toko Bangunan Sejahtera',
    lat: Number(process.env.STORE_LAT || -2.054619),
    lng: Number(process.env.STORE_LNG || 125.980278),
    radiusMeter: Number(process.env.STORE_RADIUS || 50)
  },
  attendance: {
    startTime: process.env.START_TIME || '08:30',
    toleranceMinutes: Number(process.env.TOLERANCE_MINUTES || 5),
    limitMinutes: Number(process.env.LIMIT_MINUTES || 10)
  }
};
