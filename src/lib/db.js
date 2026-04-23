const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const schemaStatements = [
  `
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY,
      name VARCHAR NOT NULL UNIQUE,
      gender VARCHAR,
      gender_probability DOUBLE PRECISION,
      age INTEGER,
      age_group VARCHAR,
      country_id VARCHAR(2),
      country_name VARCHAR,
      country_probability DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  'CREATE INDEX IF NOT EXISTS profiles_gender_idx ON profiles (gender)',
  'CREATE INDEX IF NOT EXISTS profiles_age_group_idx ON profiles (age_group)',
  'CREATE INDEX IF NOT EXISTS profiles_country_id_idx ON profiles (country_id)',
  'CREATE INDEX IF NOT EXISTS profiles_age_idx ON profiles (age)',
  'CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles (created_at)',
  'CREATE INDEX IF NOT EXISTS profiles_gender_probability_idx ON profiles (gender_probability)',
  'CREATE INDEX IF NOT EXISTS profiles_country_probability_idx ON profiles (country_probability)',
];

const ensureSchema = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  for (const statement of schemaStatements) {
    await pool.query(statement);
  }
};

const query = (text, values) => pool.query(text, values);

module.exports = {
  pool,
  query,
  ensureSchema,
};