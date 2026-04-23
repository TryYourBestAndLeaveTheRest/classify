const app = require('./app');
const { ensureSchema } = require('./lib/db');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await ensureSchema();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error.message);
    process.exit(1);
  }
})();