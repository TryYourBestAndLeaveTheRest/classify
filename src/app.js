const express = require('express');
const cors = require('cors');
const profileRoutes = require('./routes/profiles');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/profiles', profileRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong!';
  res.status(statusCode).json({
    status: 'error',
    message: message,
  });
});

module.exports = app;