const express = require('express');
const { v7: uuidv7 } = require('uuid');
const { query } = require('../lib/db');
const { getGender, getAge, getNationality } = require('../lib/apiClients');
const {
  getAgeGroup,
  formatProfile,
  parseProfileFilters,
  buildProfilesQuery,
  countryLookup,
} = require('../lib/profileQueries');

const router = express.Router();

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

router.post('/', async (req, res, next) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return next(createHttpError('Missing or empty name', 400));
  }

  try {
    const existing = await query('SELECT * FROM profiles WHERE name = $1', [name.trim()]);
    if (existing.rows.length > 0) {
      return res.status(200).json({
        status: 'success',
        message: 'Profile already exists',
        data: formatProfile(existing.rows[0]),
      });
    }

    const [genderData, ageData, nationalityData] = await Promise.all([
      getGender(name),
      getAge(name),
      getNationality(name),
    ]);

    if (!genderData.gender || genderData.count === 0) {
      return next(createHttpError('Genderize returned an invalid response', 502));
    }
    if (ageData.age === null) {
      return next(createHttpError('Agify returned an invalid response', 502));
    }
    if (!nationalityData.country || nationalityData.country.length === 0) {
      return next(createHttpError('Nationalize returned an invalid response', 502));
    }

    const topCountry = nationalityData.country.sort((left, right) => right.probability - left.probability)[0];
    const countryDetails = countryLookup.get(String(topCountry.country_id).toLowerCase());

    const newProfile = {
      id: uuidv7(),
      name: name.trim(),
      gender: genderData.gender,
      gender_probability: genderData.probability,
      age: ageData.age,
      age_group: getAgeGroup(ageData.age),
      country_id: topCountry.country_id.toUpperCase(),
      country_name: countryDetails?.country_name || topCountry.country_id.toUpperCase(),
      country_probability: topCountry.probability,
      created_at: new Date().toISOString(),
    };

    await query(
      'INSERT INTO profiles (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        newProfile.id,
        newProfile.name,
        newProfile.gender,
        newProfile.gender_probability,
        newProfile.age,
        newProfile.age_group,
        newProfile.country_id,
        newProfile.country_name,
        newProfile.country_probability,
        newProfile.created_at,
      ]
    );

    return res.status(201).json({ status: 'success', data: newProfile });
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const parsed = parseProfileFilters(req.query, { allowSearchOnly: true });
    const { countSql, dataSql, values, limitOffsetValues } = buildProfilesQuery(parsed);

    const totalResult = await query(countSql, values);
    const dataResult = await query(dataSql, [...values, ...limitOffsetValues]);

    return res.status(200).json({
      status: 'success',
      page: parsed.pagination.page,
      limit: parsed.pagination.limit,
      total: totalResult.rows[0].total,
      data: dataResult.rows.map(formatProfile),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const parsed = parseProfileFilters(req.query);
    const { countSql, dataSql, values, limitOffsetValues } = buildProfilesQuery(parsed);

    const totalResult = await query(countSql, values);
    const dataResult = await query(dataSql, [...values, ...limitOffsetValues]);

    return res.status(200).json({
      status: 'success',
      page: parsed.pagination.page,
      limit: parsed.pagination.limit,
      total: totalResult.rows[0].total,
      data: dataResult.rows.map(formatProfile),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', (req, res, next) => {
  const { id } = req.params;
  query('SELECT id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at FROM profiles WHERE id = $1', [id])
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'Profile not found' });
      }

      return res.status(200).json({ status: 'success', data: formatProfile(result.rows[0]) });
    })
    .catch(next);
});

router.delete('/:id', (req, res, next) => {
  const { id } = req.params;
  query('DELETE FROM profiles WHERE id = $1', [id])
    .then((result) => {
      if (result.rowCount === 0) {
        return res.status(404).json({ status: 'error', message: 'Profile not found' });
      }

      return res.status(204).send();
    })
    .catch(next);
});

module.exports = router;