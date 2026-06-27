CREATE TABLE IF NOT EXISTS challenge_results (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id text NOT NULL,
  challenge_title text NOT NULL,
  difficulty text NOT NULL,
  text_hash text NOT NULL,
  characters_count integer NOT NULL CHECK (characters_count > 0),
  accuracy smallint NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  attempts integer NOT NULL CHECK (attempts > 0),
  mistakes integer NOT NULL CHECK (mistakes >= 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  chars_per_minute integer NOT NULL CHECK (chars_per_minute >= 0),
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS challenge_results_challenge_rank_index
  ON challenge_results(challenge_id, accuracy DESC, duration_seconds ASC, chars_per_minute DESC);

CREATE INDEX IF NOT EXISTS challenge_results_user_completed_index
  ON challenge_results(user_id, completed_at DESC);
