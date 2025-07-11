-- Migration: employee_task_history tablosu
CREATE TABLE IF NOT EXISTS employee_task_history (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  task_title TEXT NOT NULL,
  task_description TEXT,
  task_category TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT employee_task_history_employee_id_task_id_key UNIQUE (employee_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_task_history_employee_id ON employee_task_history(employee_id); 