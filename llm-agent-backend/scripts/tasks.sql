-- Migration: tasks tablosu
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(50) DEFAULT 'other',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  priority VARCHAR(20) DEFAULT NULL,
  deadline TIMESTAMP,
  labels JSONB DEFAULT '[]',
  checklist JSONB DEFAULT '[]',
  completed BOOLEAN DEFAULT false,
  estimated_hours INTEGER DEFAULT 1,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by); 