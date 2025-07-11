const express = require('express');
const router = express.Router();
const pool = require('../db');

// Tüm etiketleri getir
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM labels ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Etiketler alınamadı', error: err.message });
  }
});

// Yeni etiket ekle
router.post('/', async (req, res) => {
  const { id, name, color } = req.body;
  if (!id || !name || !color) {
    return res.status(400).json({ message: 'Eksik bilgi' });
  }
  try {
    await pool.query('INSERT INTO labels (id, name, color) VALUES ($1, $2, $3)', [id, name, color]);
    res.status(201).json({ message: 'Etiket eklendi' });
  } catch (err) {
    res.status(500).json({ message: 'Etiket eklenemedi', error: err.message });
  }
});

// Etiket sil
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM labels WHERE id = $1', [req.params.id]);
    res.json({ message: 'Etiket silindi' });
  } catch (err) {
    res.status(500).json({ message: 'Etiket silinemedi', error: err.message });
  }
});

module.exports = router; 