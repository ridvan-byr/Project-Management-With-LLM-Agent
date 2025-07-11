-- Migration: meetings tablosu
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  meeting_time TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_cancelled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date DATE,
  time TIME
); 