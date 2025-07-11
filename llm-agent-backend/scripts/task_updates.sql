-- Migration: task_updates tablosu
CREATE TABLE IF NOT EXISTS task_updates (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT,
  progress INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT task_updates_progress_check CHECK (progress >= 0 AND progress <= 100)
); 