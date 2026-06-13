ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS age smallint;

ALTER TABLE users
  ADD CONSTRAINT users_display_name_length
    CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 2 AND 40),
  ADD CONSTRAINT users_age_range
    CHECK (age IS NULL OR age BETWEEN 4 AND 120);
