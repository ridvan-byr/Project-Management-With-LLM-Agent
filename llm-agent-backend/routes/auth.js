const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../middleware/auth');

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const TOKEN_EXPIRY = '2h'; // 2 saat
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 gün

// Login endpoint'i
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      message: 'Email ve şifre gereklidir!'
    });
  }
  
  try {
    // Kullanıcıyı email'e göre bul
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        message: 'Geçersiz email veya şifre!'
      });
    }

    const user = result.rows[0];
    
    // Şifre kontrolü
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        message: 'Geçersiz email veya şifre!'
      });
    }

    // Access token oluştur
    const accessToken = jwt.sign(
      { 
        id: user.id, 
        name: user.name,
        role: user.role,
        is_admin: user.role === 'admin'
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // Refresh token oluştur
    const refreshToken = jwt.sign(
      { 
        id: user.id, 
        name: user.name,
        role: user.role,
        is_admin: user.role === 'admin'
      },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    // Refresh token'ı veritabanına kaydet
    await pool.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [refreshToken, user.id]
    );

    res.json({
      token: accessToken,
      refreshToken,
      role: user.role,
      id: user.id
    });
  } catch (err) {
    console.error('Login sırasında hata:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  }
});

// Token yenileme endpoint'i
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token bulunamadı!' });
    }

    // Token'ı doğrula
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Kullanıcıyı bul
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Kullanıcı bulunamadı!' });
    }

    const user = result.rows[0];

    // Yeni access token oluştur
    const newAccessToken = jwt.sign(
      { 
        id: user.id, 
        name: user.name,
        role: user.role,
        is_admin: user.role === 'admin'
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // Yeni refresh token oluştur
    const newRefreshToken = jwt.sign(
      { 
        id: user.id, 
        name: user.name,
        role: user.role,
        is_admin: user.role === 'admin'
      },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    // Yeni refresh token'ı veritabanına kaydet
    await pool.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [newRefreshToken, user.id]
    );

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      role: user.role,
      id: user.id
    });
  } catch (error) {
    console.error('Token yenileme hatası:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token süresi doldu!' });
    }
    res.status(500).json({ message: 'Token yenilenirken bir hata oluştu' });
  }
});

// Token doğrulama endpoint'i
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ valid: false });
    }

    const user = result.rows[0];
    
    // Yeni token oluştur
    const newToken = jwt.sign(
      { 
        id: user.id, 
        name: user.name,
        role: user.role,
        is_admin: user.role === 'admin'
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
      valid: true,
      token: newToken,
      role: user.role,
      id: user.id
    });
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    res.status(500).json({ message: 'Token doğrulanırken bir hata oluştu' });
  }
});

// Çıkış yapma endpoint'i
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Refresh token'ı temizle
    await pool.query(
      'UPDATE users SET refresh_token = NULL WHERE id = $1',
      [userId]
    );

    res.json({ message: 'Başarıyla çıkış yapıldı' });
  } catch (error) {
    console.error('Çıkış yapma hatası:', error);
    res.status(500).json({ message: 'Çıkış yapılırken bir hata oluştu' });
  }
});

module.exports = router; 