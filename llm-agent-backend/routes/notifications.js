const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Bildirimleri listele (kullanıcıya özel)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Bildirimleri listelerken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Bildirim ekle (herhangi bir olayda çağrılır)
router.post('/', authenticateToken, async (req, res) => {
  const { user_id, message } = req.body;
  if (!user_id || !message) {
    return res.status(400).json({ message: 'user_id ve message zorunludur.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO notifications (user_id, message) VALUES ($1, $2) RETURNING *',
      [user_id, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Bildirim eklerken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Bildirimi okundu yap
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Bildirim bulunamadı.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Bildirim okundu yapılırken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Bildirimi sil
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Bildirim bulunamadı.' });
    }
    res.json({ message: 'Bildirim silindi.' });
  } catch (err) {
    console.error('Bildirim silinirken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Toplantı ayarla (bildirim gönder)
router.post('/meeting', authenticateToken, async (req, res) => {
  const { user_ids, title, description, date, time } = req.body;
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0 || !title || !date || !time) {
    return res.status(400).json({ message: 'user_ids, title, date ve time zorunludur.' });
  }
  try {
    const meetingDateTime = `${date} ${time}`;
    const message = `Yeni toplantı: ${title}\n${description ? description + '\n' : ''}Tarih: ${date} Saat: ${time}`;
    // Her kullanıcıya bildirim ekle
    for (const user_id of user_ids) {
      await pool.query(
        'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
        [user_id, message]
      );
    }
    res.status(201).json({ message: 'Toplantı bildirimi gönderildi.' });
  } catch (err) {
    console.error('Toplantı bildirimi eklerken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Toplantı iptal et (bildirim gönder)
router.post('/meeting/cancel', authenticateToken, async (req, res) => {
  const { user_ids, title, date, time } = req.body;
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0 || !title || !date || !time) {
    return res.status(400).json({ message: 'user_ids, title, date ve time zorunludur.' });
  }
  try {
    const message = `Toplantı iptal edildi: ${title}\nTarih: ${date} Saat: ${time}`;
    for (const user_id of user_ids) {
      await pool.query(
        'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
        [user_id, message]
      );
    }
    res.status(201).json({ message: 'Toplantı iptal bildirimi gönderildi.' });
  } catch (err) {
    console.error('Toplantı iptal bildirimi eklerken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

module.exports = router; 