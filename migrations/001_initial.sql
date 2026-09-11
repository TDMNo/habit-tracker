CREATE TABLE users (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX user_sessions_expire_idx ON user_sessions (expire);

CREATE TABLE habits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  emoji TEXT NOT NULL DEFAULT '✨',
  type TEXT NOT NULL CHECK (type IN ('binary', 'count', 'duration')),
  color TEXT NOT NULL DEFAULT 'lime' CHECK (color IN ('lime', 'blue', 'violet', 'orange')),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  start_date DATE NOT NULL,
  archived_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (archived_on IS NULL OR archived_on >= start_date)
);
CREATE INDEX habits_user_active_idx ON habits (user_id, archived_on, position);

CREATE TABLE habit_targets (
  id BIGSERIAL PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  target INTEGER NOT NULL CHECK (target > 0),
  unit TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (habit_id, effective_from)
);
CREATE INDEX habit_targets_lookup_idx ON habit_targets (habit_id, effective_from DESC);

CREATE TABLE habit_entries (
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  value INTEGER NOT NULL CHECK (value >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (habit_id, entry_date)
);
CREATE INDEX habit_entries_date_idx ON habit_entries (entry_date, habit_id);
