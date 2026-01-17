const app = require('./src/app');
const config = require('./src/config');

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 EnSeñas Collection API running on port ${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`☁️  Storage: ${config.storage.endpoint || 'AWS S3'}`);
});
