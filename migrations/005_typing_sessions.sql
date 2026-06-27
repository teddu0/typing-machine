CREATE TABLE IF NOT EXISTS typing_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  level_id integer NOT NULL CHECK (level_id > 0),
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 3),
  accuracy smallint NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  attempts integer NOT NULL CHECK (attempts > 0),
  mistakes integer NOT NULL CHECK (mistakes >= 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 0),
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS typing_sessions_user_completed_index
  ON typing_sessions(user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS typing_sessions_completed_index
  ON typing_sessions(completed_at DESC);
