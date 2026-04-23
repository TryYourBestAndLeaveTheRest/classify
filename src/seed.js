const fs = require('fs/promises');
const path = require('path');
const { v7: uuidv7 } = require('uuid');
const { ensureSchema, pool } = require('./lib/db');

const seedFilePath = path.resolve(__dirname, '..', '..', 'seed_profiles.json');

const loadSeedProfiles = async () => {
  try {
    await ensureSchema();

    const rawSeed = await fs.readFile(seedFilePath, 'utf8');
    const parsedSeed = JSON.parse(rawSeed);
    const profiles = Array.isArray(parsedSeed.profiles) ? parsedSeed.profiles : [];

    const values = profiles.map((profile) => ({
      id: uuidv7(),
      name: String(profile.name).trim(),
      gender: String(profile.gender).trim().toLowerCase(),
      gender_probability: profile.gender_probability,
      age: profile.age,
      age_group: String(profile.age_group).trim().toLowerCase(),
      country_id: String(profile.country_id).trim().toUpperCase(),
      country_name: String(profile.country_name).trim(),
      country_probability: profile.country_probability,
    }));

    const result = await pool.query(
      `
        INSERT INTO profiles (
          id,
          name,
          gender,
          gender_probability,
          age,
          age_group,
          country_id,
          country_name,
          country_probability
        )
        SELECT
          id,
          name,
          gender,
          gender_probability,
          age,
          age_group,
          country_id,
          country_name,
          country_probability
        FROM jsonb_to_recordset($1::jsonb) AS seed_profiles(
          id uuid,
          name text,
          gender text,
          gender_probability double precision,
          age integer,
          age_group text,
          country_id varchar(2),
          country_name text,
          country_probability double precision
        )
        ON CONFLICT (name) DO NOTHING
      `,
      [JSON.stringify(values)]
    );

    const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM profiles');

    console.log(`Seed complete. Inserted ${result.rowCount} rows. Total profiles: ${countResult.rows[0].total}`);
  } finally {
    await pool.end().catch(() => {});
  }
};

loadSeedProfiles().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});