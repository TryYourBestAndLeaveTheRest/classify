# Classify API

This project is a Node.js and Express application backed by PostgreSQL.

It supports the task 3 profiles API requirements:
- `GET /api/profiles` with filtering, sorting, and pagination.
- `GET /api/profiles/search` with rule-based natural language parsing.
- A separate seed command that loads `seed_profiles.json` into PostgreSQL without duplicating existing rows.

## Natural Language Parsing

The search endpoint is rule-based only. It does not use AI or an LLM.

Supported keyword mappings:
- `male`, `males`, `man`, `men`, `boy`, `boys` map to `gender=male`.
- `female`, `females`, `woman`, `women`, `girl`, `girls` map to `gender=female`.
- `young` maps to `min_age=16` and `max_age=24`.
- `teenager` or `teenagers` map to `age_group=teenager`.
- `adult` or `adults` map to `age_group=adult`.
- `senior` or `seniors` map to `age_group=senior`.
- `child` or `children` map to `age_group=child`.
- Comparison phrases like `above 30`, `over 30`, `older than 30`, `at least 30`, and `minimum age of 30` map to `min_age=30`.
- Comparison phrases like `below 20`, `under 20`, `younger than 20`, and `at most 20` map to `max_age=20`.
- Country names are matched against the seeded country names and a small alias list for common variants.

Parsing works by normalizing the query to lowercase text, scanning it for supported tokens, and combining every recognized token into the final filter set. If nothing supported is found, the endpoint returns `Unable to interpret query`.

## Limitations

- Only rule-based keyword parsing is supported.
- The parser does not understand arbitrary grammar, synonyms outside the documented list, or free-form semantic intent.
- Country matching is limited to the seeded country names plus a small alias list for common variants.
- Sorting is only supported on the fields required by the task.
- `GET /api/profiles/search` only uses `q`, `page`, and `limit`.

## Installation

```bash
npm install
```

## Running the application

```bash
npm start
```

## Seeding

```bash
npm run seed
```

The seed command reads the root-level `seed_profiles.json` file and inserts every profile into PostgreSQL using the unique `name` constraint to avoid duplicates.
