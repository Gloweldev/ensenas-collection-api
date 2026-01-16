const app = require('./src/app');
const config = require('./src/config');

const PORT = config.PORT;

app.listen(PORT, () => {
    console.log(`🚀 EnSeñas Collection API running on port ${PORT}`);
    console.log(`📦 Environment: ${config.NODE_ENV}`);
    console.log(`☁️  Storage: ${config.storage.endpoint || 'AWS S3'}`);
});
