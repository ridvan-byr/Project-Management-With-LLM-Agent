const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../middleware/auth');

// Tüm kullanıcıları listele
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM users 
      WHERE role != 'ai_assistant'
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sunucu hatası!');
  }
});

// Yeni kullanıcı oluştur
router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    // Email'in benzersiz olup olmadığını kontrol et
    const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        message: 'Bu email adresi zaten kullanılıyor!',
        email: email
      });
    }

    // Role kontrolü
    if (!role || !['admin', 'employee'].includes(role.toLowerCase())) {
      return res.status(400).json({
        message: 'Geçersiz rol! Role sadece "admin" veya "employee" olabilir!',
        role: role
      });
    }

    // Şifre kontrolü
    if (!password || password.length < 6) {
      return res.status(400).json({
        message: 'Şifre en az 6 karakter olmalıdır!'
      });
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, hashedPassword, role.toLowerCase()]
    );
    
    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu!',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Kullanıcı oluşturma sırasında hata:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  }
});

// Kullanıcıyı sil
router.delete('/:id', async (req, res) => {
  try {
    // Önce kullanıcıyı kontrol et
    const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).send('Kullanıcı bulunamadı!');
    }

    // Önce kullanıcıya ait görevleri kontrol et
    const taskCheck = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = $1', [req.params.id]);
    if (taskCheck.rows[0].count > 0) {
      return res.status(400).json({
        message: 'Bu kullanıcıya ait görevler mevcut. Önce görevleri tamamlayın veya başka bir kullanıcıya aktarın!',
        taskCount: taskCheck.rows[0].count
      });
    }

    // Kullanıcıyı sil
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Kullanıcı bulunamadı!',
        id: req.params.id
      });
    }
    
    res.status(200).json({
      message: 'Kullanıcı başarıyla silindi!',
      deletedUser: result.rows[0]
    });
  } catch (err) {
    console.error('Silme işlemi sırasında hata:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  }
});

// Kullanıcıyı güncelle
router.put('/:id', async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    
    // Kullanıcının varlığını kontrol et
    const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        message: 'Kullanıcı bulunamadı!',
        id: req.params.id
      });
    }

    // Email varsa benzersiz olup olmadığını kontrol et
    if (email) {
      const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1 AND id != $2', [email, req.params.id]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          message: 'Bu email adresi zaten kullanılıyor!'
        });
      }
    }

    let updateQuery = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role)';
    let queryParams = [name, email, role];
    let paramCount = 3;

    // Şifre varsa güncelle
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery += `, password = $${paramCount + 1}, refresh_token = NULL`;
      queryParams.push(hashedPassword);
      paramCount++;
    }

    updateQuery += ` WHERE id = $${paramCount + 1} RETURNING *`;
    queryParams.push(req.params.id);

    const result = await pool.query(updateQuery, queryParams);

    // Şifre değiştiyse kullanıcıyı bilgilendir
    const responseMessage = password && password.trim() !== '' 
      ? 'Kullanıcı başarıyla güncellendi! Şifre değiştiği için tekrar giriş yapmanız gerekecek.'
      : 'Kullanıcı başarıyla güncellendi!';

    res.status(200).json({
      message: responseMessage,
      updatedUser: result.rows[0]
    });
  } catch (err) {
    console.error('Güncelleme işlemi sırasında hata:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı!' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Kendi bilgilerini getirirken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

module.exports = router;