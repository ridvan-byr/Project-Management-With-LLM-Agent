const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Token doğrulama middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Yetkilendirme başarısız!' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Geçersiz token!' });
    }
    req.user = user;
    next();
  });
};

// Admin kontrolü middleware
const isAdmin = (req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ message: 'Bu işlem için admin yetkisi gerekiyor!' });
  }
  next();
};

// Tüm rolleri getir
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Roller getirilirken hata:', error);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Yeni rol oluştur
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  const { name, description } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Rol oluşturulurken hata:', error);
    if (error.code === '23505') { // unique_violation
      res.status(400).json({ message: 'Bu rol adı zaten kullanılıyor!' });
    } else {
      res.status(500).json({ message: 'Sunucu hatası!' });
    }
  }
});

// Rol güncelle
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const result = await pool.query(
      'UPDATE roles SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rol bulunamadı!' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Rol güncellenirken hata:', error);
    if (error.code === '23505') { // unique_violation
      res.status(400).json({ message: 'Bu rol adı zaten kullanılıyor!' });
    } else {
      res.status(500).json({ message: 'Sunucu hatası!' });
    }
  }
});

// Rol sil
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Önce bu role sahip kullanıcı var mı kontrol et
    const roleCheck = await pool.query('SELECT name FROM roles WHERE id = $1', [id]);
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Rol bulunamadı!' });
    }

    const roleName = roleCheck.rows[0].name;
    const userCheck = await pool.query('SELECT id FROM users WHERE position = $1', [roleName]);
    
    // Eğer bu pozisyonda çalışanlar varsa, pozisyonlarını kaldır
    if (userCheck.rows.length > 0) {
      await pool.query('UPDATE users SET position = NULL WHERE position = $1', [roleName]);
      console.log(`${userCheck.rows.length} çalışanın pozisyonu kaldırıldı: ${roleName}`);
    }

    const result = await pool.query('DELETE FROM roles WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rol bulunamadı!' });
    }

    res.json({ 
      message: `Rol başarıyla silindi. ${userCheck.rows.length} çalışanın pozisyonu kaldırıldı.` 
    });
  } catch (error) {
    console.error('Rol silinirken hata:', error);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Rol atama endpoint'i
router.post('/assign', authenticateToken, isAdmin, async (req, res) => {
  const { userId, roleId } = req.body;

  try {
    // Kullanıcı ve rolün varlığını kontrol et
    const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const roleCheck = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı!' });
    }

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Rol bulunamadı!' });
    }

    // Kullanıcının position'ını güncelle
    await pool.query(
      'UPDATE users SET position = $1 WHERE id = $2',
      [roleCheck.rows[0].name, userId]
    );

    res.json({ message: 'Pozisyon başarıyla atandı' });
  } catch (error) {
    console.error('Pozisyon atama hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Kullanıcıları ve pozisyonlarını getir
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.position
      FROM users u 
      WHERE u.role = 'employee' AND u.name != 'AI Asistanı'
      ORDER BY u.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Kullanıcılar getirilirken hata:', error);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

module.exports = router; 