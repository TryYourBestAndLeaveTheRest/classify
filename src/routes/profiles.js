const express = require('express');
const { v7: uuidv7 } = require('uuid');
const db = require('../lib/db');
const { getGender, getAge, getNationality } = require('../lib/apiClients');

const router = express.Router();

const getAgeGroup = (age) => {
  if (age >= 0 && age <= 12) return 'child';
  if (age >= 13 && age <= 19) return 'teenager';
  if (age >= 20 && age <= 59) return 'adult';
  if (age >= 60) return 'senior';
  return 'unknown';
};

router.post('/', async (req, res, next) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Missing or empty name' });
  }

  try {
    db.get('SELECT * FROM profiles WHERE name = ?', [name.toLowerCase()], async (err, row) => {
      if (err) {
        return next(err);
      }
      if (row) {
        return res.status(200).json({
          status: 'success',
          message: 'Profile already exists',
          data: {
            ...row,
            gender_probability: row.gender_probability,
            country_probability: row.country_probability,
          },
        });
      }

      try {
        const [genderData, ageData, nationalityData] = await Promise.all([
          getGender(name),
          getAge(name),
          getNationality(name),
        ]);

        console.log('Country data:' ,nationalityData.country );

        if (!genderData.gender || genderData.count === 0) {
          return res.status(502).json({ status: 'error', message: 'Genderize returned an invalid response' });
        }
        if (ageData.age === null) {
          return res.status(502).json({ status: 'error', message: 'Agify returned an invalid response' });
        }
        if (!nationalityData.country || nationalityData.country.length === 0) {
          return res.status(502).json({ status: 'error', message: 'Nationalize returned an invalid response' });
        }

        const topCountry = nationalityData.country.sort((a, b) => b.probability - a.probability)[0];

        const newProfile = {
          id: uuidv7(),
          name: name.toLowerCase(),
          gender: genderData.gender,
          gender_probability: genderData.probability,
          sample_size: genderData.count,
          age: ageData.age,
          age_group: getAgeGroup(ageData.age),
          country_id: topCountry.country_id,
          country_probability: topCountry.probability,
          created_at: new Date().toISOString(),
        };

        db.run(
          'INSERT INTO profiles (id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            newProfile.id,
            newProfile.name,
            newProfile.gender,
            newProfile.gender_probability,
            newProfile.sample_size,
            newProfile.age,
            newProfile.age_group,
            newProfile.country_id,
            newProfile.country_probability,
            newProfile.created_at,
          ],
          (err) => {
            if (err) {
              return next(err);
            }
            res.status(201).json({ status: 'success', data: newProfile });
          }
        );
      } catch (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', (req, res, next) => {
  const { id } = req.params;
  db.get('SELECT * FROM profiles WHERE id = ?', [id], (err, row) => {
    if (err) {
      return next(err);
    }
    if (!row) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    res.status(200).json({ status: 'success', data: row });
  });
});

router.get('/', (req, res, next) => {
  const { gender, country_id, age_group } = req.query;
  let query = 'SELECT id, name, gender, age, age_group, country_id FROM profiles WHERE 1=1';
  const params = [];

  if (gender) {
    query += ' AND lower(gender) = ?';
    params.push(gender.toLowerCase());
  }
  if (country_id) {
    query += ' AND lower(country_id) = ?';
    params.push(country_id.toLowerCase());
  }
  if (age_group) {
    query += ' AND lower(age_group) = ?';
    params.push(age_group.toLowerCase());
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return next(err);
    }
    res.status(200).json({
      status: 'success',
      count: rows.length,
      data: rows,
    });
  });
});

router.delete('/:id', (req, res, next) => {
  const { id } = req.params;
  db.run('DELETE FROM profiles WHERE id = ?', [id], function (err) {
    if (err) {
      return next(err);
    }
    if (this.changes === 0) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    res.status(204).send();
  });
});

module.exports = router;