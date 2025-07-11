-- Migration: channel_members tablosu
CREATE TABLE IF NOT EXISTS channel_members (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  CONSTRAINT channel_members_channel_id_user_id_key UNIQUE (channel_id, user_id)
); 