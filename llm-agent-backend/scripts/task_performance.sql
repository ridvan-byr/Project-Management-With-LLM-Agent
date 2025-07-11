-- Migration: task_performance tablosu
CREATE TABLE IF NOT EXISTS task_performance (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMP DEFAULT now(),
  end_time TIMESTAMP,
  actual_hours NUMERIC(5,2),
  efficiency_score NUMERIC(3,2),
  created_at TIMESTAMP DEFAULT now()
); 