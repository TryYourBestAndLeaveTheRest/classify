const path = require('path');

const seedProfiles = require(path.resolve(__dirname, '../..', 'seed_profiles.json'));

const allowedListQueryKeys = new Set([
  'gender',
  'age_group',
  'country_id',
  'min_age',
  'max_age',
  'min_gender_probability',
  'min_country_probability',
  'sort_by',
  'order',
  'page',
  'limit',
]);

const allowedSearchQueryKeys = new Set(['q', 'page', 'limit']);

const allowedGenders = new Set(['male', 'female']);
const allowedAgeGroups = new Set(['child', 'teenager', 'adult', 'senior']);
const allowedSortColumns = new Set(['age', 'created_at', 'gender_probability']);
const allowedSortOrders = new Set(['asc', 'desc']);

const countryLookup = new Map();

const normalizeText = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const registerCountry = (alias, countryId, countryName) => {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) {
    return;
  }

  countryLookup.set(normalizedAlias, {
    country_id: String(countryId).toUpperCase(),
    country_name: countryName,
  });
};

for (const profile of seedProfiles.profiles) {
  registerCountry(profile.country_name, profile.country_id, profile.country_name);
  registerCountry(profile.country_id, profile.country_id, profile.country_name);
}

registerCountry('usa', 'US', 'United States');
registerCountry('u s a', 'US', 'United States');
registerCountry('united states of america', 'US', 'United States');
registerCountry('us', 'US', 'United States');
registerCountry('uk', 'GB', 'United Kingdom');
registerCountry('u k', 'GB', 'United Kingdom');
registerCountry('great britain', 'GB', 'United Kingdom');
registerCountry('england', 'GB', 'United Kingdom');

const countryAliases = [...countryLookup.keys()].sort((left, right) => right.length - left.length);

const getAgeGroup = (age) => {
  if (age >= 0 && age <= 12) return 'child';
  if (age >= 13 && age <= 19) return 'teenager';
  if (age >= 20 && age <= 59) return 'adult';
  if (age >= 60) return 'senior';
  return 'unknown';
};

const formatProfile = (row) => ({
  id: row.id,
  name: row.name,
  gender: row.gender,
  gender_probability: row.gender_probability,
  age: row.age,
  age_group: row.age_group,
  country_id: row.country_id,
  country_name: row.country_name,
  country_probability: row.country_probability,
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
});

const parseInteger = (value, fieldName, { min, max, defaultValue, required = false } = {}) => {
  if (value === undefined) {
    if (required) {
      throw Object.assign(new Error(`Missing or empty ${fieldName}`), { statusCode: 400 });
    }

    return defaultValue;
  }

  const text = String(value).trim();
  if (!text || !/^-?\d+$/.test(text)) {
    throw Object.assign(new Error('Invalid query parameters'), { statusCode: 422 });
  }

  const parsed = Number.parseInt(text, 10);
  if ((min !== undefined && parsed < min) || (max !== undefined && parsed > max)) {
    throw Object.assign(new Error('Invalid query parameters'), { statusCode: 422 });
  }

  return parsed;
};

const parseFloatValue = (value, fieldName, { min, max } = {}) => {
  if (value === undefined) {
    return undefined;
  }

  const text = String(value).trim();
  if (!text || !/^-?(?:\d+|\d*\.\d+)$/.test(text)) {
    throw Object.assign(new Error('Invalid query parameters'), { statusCode: 422 });
  }

  const parsed = Number.parseFloat(text);
  if ((min !== undefined && parsed < min) || (max !== undefined && parsed > max)) {
    throw Object.assign(new Error('Invalid query parameters'), { statusCode: 422 });
  }

  return parsed;
};

const parseStringValue = (value, fieldName, allowedValues) => {
  if (value === undefined) {
    return undefined;
  }

  const text = String(value).trim().toLowerCase();
  if (!text) {
    throw Object.assign(new Error('Invalid query parameters'), { statusCode: 422 });
  }

  if (allowedValues && !allowedValues.has(text)) {
    throw Object.assign(new Error('Invalid query parameters'), { statusCode: 422 });
  }

  return text;
};

const findCountryMatch = (query) => {
  for (const alias of countryAliases) {
    const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i');
    if (pattern.test(query)) {
      return countryLookup.get(alias);
    }
  }

  return undefined;
};

const parseProfileFilters = (query, { allowSearchOnly = false } = {}) => {
  const entries = Object.entries(query || {});
  const allowedKeys = allowSearchOnly ? allowedSearchQueryKeys : allowedListQueryKeys;

  for (const [key, value] of entries) {
    if (!allowedKeys.has(key) && value !== undefined && String(value).trim() !== '') {
      throw Object.assign(new Error('Invalid query parameters'), { statusCode: 422 });
    }
  }

  if (allowSearchOnly) {
    const q = String(query?.q ?? '').trim();
    if (!q) {
      throw Object.assign(new Error('Missing or empty parameter'), { statusCode: 400 });
    }

    const parsedSearch = parseNaturalLanguageQuery(q);
    if (!parsedSearch) {
      throw Object.assign(new Error('Unable to interpret query'), { statusCode: 422 });
    }

    const page = parseInteger(query.page, 'page', { min: 1, defaultValue: 1 });
    const limit = parseInteger(query.limit, 'limit', { min: 1, max: 50, defaultValue: 10 });

    return {
      filters: parsedSearch,
      pagination: { page, limit },
      sortBy: 'created_at',
      order: 'desc',
    };
  }

  const gender = parseStringValue(query.gender, 'gender', allowedGenders);
  const ageGroup = parseStringValue(query.age_group, 'age_group', allowedAgeGroups);
  const countryId = query.country_id === undefined ? undefined : String(query.country_id).trim().toUpperCase();

  if (countryId !== undefined && !/^[A-Z]{2}$/.test(countryId)) {
    throw Object.assign(new Error('Invalid query parameters'), { statusCode: 422 });
  }

  const minAge = parseInteger(query.min_age, 'min_age', { min: 0 });
  const maxAge = parseInteger(query.max_age, 'max_age', { min: 0 });
  const minGenderProbability = parseFloatValue(query.min_gender_probability, 'min_gender_probability', { min: 0, max: 1 });
  const minCountryProbability = parseFloatValue(query.min_country_probability, 'min_country_probability', { min: 0, max: 1 });
  const sortBy = parseStringValue(query.sort_by, 'sort_by', allowedSortColumns) ?? 'created_at';
  const order = parseStringValue(query.order, 'order', allowedSortOrders) ?? 'desc';
  const page = parseInteger(query.page, 'page', { min: 1, defaultValue: 1 });
  const limit = parseInteger(query.limit, 'limit', { min: 1, max: 50, defaultValue: 10 });

  if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
    throw Object.assign(new Error('Invalid query parameters'), { statusCode: 422 });
  }

  return {
    filters: {
      gender,
      age_group: ageGroup,
      country_id: countryId,
      min_age: minAge,
      max_age: maxAge,
      min_gender_probability: minGenderProbability,
      min_country_probability: minCountryProbability,
    },
    pagination: { page, limit },
    sortBy,
    order,
  };
};

const parseNaturalLanguageQuery = (input) => {
  const normalizedQuery = normalizeText(input);
  if (!normalizedQuery) {
    return null;
  }

  const filters = {};
  let matched = false;

  const maleDetected = /\b(male|males|man|men|boy|boys)\b/.test(normalizedQuery);
  const femaleDetected = /\b(female|females|woman|women|girl|girls)\b/.test(normalizedQuery);
  if (maleDetected || femaleDetected) {
    matched = true;
    if (maleDetected && !femaleDetected) {
      filters.gender = 'male';
    } else if (femaleDetected && !maleDetected) {
      filters.gender = 'female';
    }
  }

  if (/\byoung\b/.test(normalizedQuery)) {
    matched = true;
    filters.min_age = filters.min_age === undefined ? 16 : Math.max(filters.min_age, 16);
    filters.max_age = filters.max_age === undefined ? 24 : Math.min(filters.max_age, 24);
  }

  if (/\bteenagers?\b/.test(normalizedQuery)) {
    matched = true;
    filters.age_group = 'teenager';
  }

  if (/\badults?\b/.test(normalizedQuery)) {
    matched = true;
    filters.age_group = 'adult';
  }

  if (/\bseniors?\b/.test(normalizedQuery)) {
    matched = true;
    filters.age_group = 'senior';
  }

  if (/\bchildren?\b/.test(normalizedQuery)) {
    matched = true;
    filters.age_group = 'child';
  }

  const aboveMatch = normalizedQuery.match(/\b(?:above|over|older than|at least|minimum age of)\s+(\d{1,3})\b/);
  if (aboveMatch) {
    matched = true;
    const parsed = Number.parseInt(aboveMatch[1], 10);
    filters.min_age = filters.min_age === undefined ? parsed : Math.max(filters.min_age, parsed);
  }

  const belowMatch = normalizedQuery.match(/\b(?:below|under|younger than|at most)\s+(\d{1,3})\b/);
  if (belowMatch) {
    matched = true;
    const parsed = Number.parseInt(belowMatch[1], 10);
    filters.max_age = filters.max_age === undefined ? parsed : Math.min(filters.max_age, parsed);
  }

  const countryMatch = findCountryMatch(normalizedQuery);
  if (countryMatch) {
    matched = true;
    filters.country_id = countryMatch.country_id;
  }

  if (!matched) {
    return null;
  }

  if (filters.min_age !== undefined && filters.max_age !== undefined && filters.min_age > filters.max_age) {
    throw Object.assign(new Error('Invalid query parameters'), { statusCode: 422 });
  }

  return filters;
};

const buildProfilesQuery = ({ filters, pagination, sortBy, order }) => {
  const whereClauses = [];
  const values = [];

  const addClause = (clause, value) => {
    values.push(value);
    whereClauses.push(`${clause} $${values.length}`);
  };

  if (filters.gender) addClause('gender =', filters.gender);
  if (filters.age_group) addClause('age_group =', filters.age_group);
  if (filters.country_id) addClause('country_id =', filters.country_id);
  if (filters.min_age !== undefined) addClause('age >=', filters.min_age);
  if (filters.max_age !== undefined) addClause('age <=', filters.max_age);
  if (filters.min_gender_probability !== undefined) addClause('gender_probability >=', filters.min_gender_probability);
  if (filters.min_country_probability !== undefined) addClause('country_probability >=', filters.min_country_probability);

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sortColumn = sortBy || 'created_at';
  const sortOrder = order || 'desc';
  const limitPlaceholder = `$${values.length + 1}`;
  const offsetPlaceholder = `$${values.length + 2}`;

  return {
    countSql: `SELECT COUNT(*)::int AS total FROM profiles ${whereSql}`,
    dataSql: `SELECT id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at FROM profiles ${whereSql} ORDER BY ${sortColumn} ${sortOrder} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
    limitOffsetValues: [pagination.limit, (pagination.page - 1) * pagination.limit],
  };
};

module.exports = {
  allowedListQueryKeys,
  allowedSearchQueryKeys,
  allowedGenders,
  allowedAgeGroups,
  allowedSortColumns,
  allowedSortOrders,
  countryLookup,
  getAgeGroup,
  formatProfile,
  parseProfileFilters,
  parseNaturalLanguageQuery,
  buildProfilesQuery,
  normalizeText,
};