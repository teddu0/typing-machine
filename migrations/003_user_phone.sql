ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE users
  ADD CONSTRAINT users_phone_format
    CHECK (phone IS NULL OR phone ~ '^\+[0-9]{7,15}$');
