const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Kanal oluştur (sadece admin)
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Sadece admin kanal oluşturabilir.' });
    }
    const { name, description } = req.body;
    const created_by = req.user.id;
    const { rows } = await pool.query(
      'INSERT INTO channels (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, description, created_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Kanal oluşturulamadı', error: err.message });
  }
});

// Kanalları listele
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM channels ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Kanallar alınamadı', error: err.message });
  }
});

// Kanala üye ekle/rol ata (sadece admin veya kanal admini)
router.post('/:channelId/members', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { user_id, role } = req.body;
    // Kanal admini mi veya sistem admini mi kontrolü
    const isAdmin = req.user.role === 'admin';
    const isChannelAdmin = await pool.query(
      'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2 AND role = $3',
      [channelId, req.user.id, 'admin']
    );
    if (!isAdmin && isChannelAdmin.rows.length === 0) {
      return res.status(403).json({ message: 'Sadece admin veya kanal admini üye ekleyebilir.' });
    }
    // Üye ekle
    const { rows } = await pool.query(
      'INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (channel_id, user_id) DO UPDATE SET role = $3 RETURNING *',
      [channelId, user_id, role || 'member']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Kanal üyesi eklenemedi', error: err.message });
  }
});

// Kanal üyelerini listele
router.get('/:channelId/members', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { rows } = await pool.query(
      'SELECT cm.*, u.name, u.role as user_role FROM channel_members cm JOIN users u ON cm.user_id = u.id WHERE cm.channel_id = $1',
      [channelId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Kanal üyeleri alınamadı', error: err.message });
  }
});

module.exports = router; 