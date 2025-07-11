-- Migration: ai_suggestions tablosu
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  suggestion_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20),
  estimated_hours INTEGER,
  category VARCHAR(50),
  is_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
); 