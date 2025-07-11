const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Chat endpoint'i
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { message, role } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ message: 'Mesaj gereklidir!' });
    }

    // Burada LLM entegrasyonu yapılacak
    // Şimdilik basit bir yanıt döndürelim
    let response = '';
    
    if (role === 'admin') {
      response = `Admin olarak giriş yapmışsınız. Size nasıl yardımcı olabilirim? Mesajınız: ${message}`;
    } else if (role === 'employee') {
      response = `Çalışan olarak giriş yapmışsınız. Size nasıl yardımcı olabilirim? Mesajınız: ${message}`;
    } else {
      response = 'Üzgünüm, rolünüzü tanımlayamadım.';
    }

    res.json({ response });
  } catch (error) {
    console.error('Chat hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

module.exports = router; 