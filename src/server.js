const app = require('./app');
const db = require('./lib/db');

const PORT = process.env.PORT || 3000;

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gender TEXT,
      gender_probability REAL,
      sample_size INTEGER,
      age INTEGER,
      age_group TEXT,
      country_id TEXT,
      country_probability REAL,
      created_at TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('Error creating profiles table:', err.message);
    } else {
      console.log('Profiles table created or already exists.');
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    }
  });
});