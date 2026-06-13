ALTER TABLE users
  ADD COLUMN IF NOT EXISTS birth_date date;

UPDATE users
SET birth_date = make_date(
  extract(year FROM current_date)::integer - age,
  1,
  1
)
WHERE age IS NOT NULL AND birth_date IS NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_age_range,
  DROP COLUMN IF EXISTS age;

ALTER TABLE users
  ADD CONSTRAINT users_birth_date_range
    CHECK (birth_date IS NULL OR birth_date >= DATE '1900-01-01');
