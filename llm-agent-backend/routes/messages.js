const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const { askLLM } = require('../services/llm');

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Token doğrulama middleware'i
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Yetkilendirme token\'ı bulunamadı!' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('Token doğrulama hatası:', err);
        return res.status(403).json({ message: 'Geçersiz token!' });
      }
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    return res.status(403).json({ message: 'Token doğrulama hatası!' });
  }
};

// Kanal, DM ve bot mesajlarını getir
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(403).json({ message: 'Geçersiz kullanıcı bilgisi!' });
    }

    const { channel_id, user_id } = req.query;
    let messages = [];

    if (channel_id) {
      // Kanal mesajlarını getir
      const { rows } = await pool.query(`
        SELECT m.*, sender.name as sender_name, sender.role as sender_role,
          CASE WHEN m.sender_id = $1 THEN true ELSE false END as is_sender
        FROM messages m
        LEFT JOIN users sender ON m.sender_id = sender.id
        WHERE m.channel_id = $2
        ORDER BY m.created_at ASC
      `, [req.user.id, channel_id]);
      messages = rows;
      return res.json({ channel: messages });
    }

    // Eğer user_id varsa, sadece iki kullanıcı arasındaki DM mesajlarını getir
    if (user_id) {
      const { rows } = await pool.query(`
        SELECT m.*, sender.name as sender_name, sender.role as sender_role, receiver.name as receiver_name,
          CASE WHEN m.sender_id = $1 THEN true ELSE false END as is_sender
        FROM messages m
        LEFT JOIN users sender ON m.sender_id = sender.id
        LEFT JOIN users receiver ON m.receiver_id = receiver.id
        WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
          AND m.type = 'dm'
        ORDER BY m.created_at ASC
      `, [req.user.id, user_id]);
      return res.json({ messages: rows });
    }

    // DM ve bot mesajları eski şekilde
    // Özel mesajları getir
    const { rows: privateMessages } = await pool.query(`
      SELECT m.*, sender.name as sender_name, sender.role as sender_role, receiver.name as receiver_name,
        CASE WHEN m.sender_id = $1 THEN true ELSE false END as is_sender
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users receiver ON m.receiver_id = receiver.id
      WHERE (m.sender_id = $1 OR m.receiver_id = $1) AND m.receiver_id IS NOT NULL AND m.type = 'dm'
      ORDER BY m.created_at ASC
    `, [req.user.id]);

    // AI mesajlarını getir
    const { rows: aiMessages } = await pool.query(`
      SELECT m.*, sender.name as sender_name, sender.role as sender_role,
        CASE WHEN m.sender_id = $1 THEN true ELSE false END as is_sender
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
      WHERE (m.sender_id = $1 OR m.receiver_id = $1) AND m.type = 'chatbot'
      ORDER BY m.created_at ASC
    `, [req.user.id]);

    // Özel mesajları grupla
    const privateMessagesGrouped = privateMessages.reduce((acc, message) => {
      const otherUserId = message.sender_id === req.user.id ? message.receiver_id : message.sender_id;
      if (!acc[otherUserId]) {
        acc[otherUserId] = [];
      }
      acc[otherUserId].push(message);
      return acc;
    }, {});

    res.json({ private: privateMessagesGrouped, ai: aiMessages });
  } catch (err) {
    console.error('Mesajları getirme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası!', error: err.message });
  }
});

// Yeni mesaj gönder (kanal, DM veya bot)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { receiver_id, user_id, message, type, channel_id } = req.body;
    const actualReceiverId = receiver_id || user_id || null;
    const sender_id = req.user?.id;

    let insertQuery, insertParams;
    if (channel_id) {
      // Kanal mesajı
      insertQuery = 'INSERT INTO messages (sender_id, message, type, channel_id) VALUES ($1, $2, $3, $4) RETURNING *';
      insertParams = [sender_id, message, 'channel', channel_id];
    } else {
      // DM veya bot
      insertQuery = 'INSERT INTO messages (sender_id, receiver_id, message, type) VALUES ($1, $2, $3, $4) RETURNING *';
      insertParams = [sender_id, actualReceiverId, message, type || 'dm'];
    }

    const { rows } = await pool.query(insertQuery, insertParams);

    // Mesaj detaylarını getir
    const { rows: messageDetails } = await pool.query(
      `SELECT m.*, s.name as sender_name, s.role as sender_role, r.name as receiver_name,
        CASE WHEN m.sender_id = $1 THEN true ELSE false END as is_sender
      FROM messages m
      LEFT JOIN users s ON m.sender_id = s.id
      LEFT JOIN users r ON m.receiver_id = r.id
      WHERE m.id = $2`,
      [sender_id, rows[0].id]
    );

    // Bildirimler (sadece DM ve kanal için)
    if (channel_id) {
      // Kanal mesajı: kanaldaki diğer üyelere bildirim
      try {
        const { rows: channelMembers } = await pool.query(
          'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id != $2',
          [channel_id, sender_id]
        );
        const { rows: senderInfo } = await pool.query('SELECT name FROM users WHERE id = $1', [sender_id]);
        const senderName = senderInfo[0]?.name || 'Bilinmeyen Kullanıcı';
        const notificationMessage = `${senderName} kanala mesaj gönderdi: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`;
        for (const member of channelMembers) {
          await pool.query('INSERT INTO notifications (user_id, message) VALUES ($1, $2)', [member.user_id, notificationMessage]);
        }
      } catch (notificationError) {
        console.error('Kanal bildirimi oluşturma hatası:', notificationError);
      }
    } else if (receiver_id && type === 'dm') {
      // DM bildirimi
      try {
        const { rows: senderInfo } = await pool.query('SELECT name FROM users WHERE id = $1', [sender_id]);
        const senderName = senderInfo[0]?.name || 'Bilinmeyen Kullanıcı';
        const notificationMessage = `${senderName} size özel mesaj gönderdi: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`;
        await pool.query('INSERT INTO notifications (user_id, message) VALUES ($1, $2)', [receiver_id, notificationMessage]);
      } catch (notificationError) {
        console.error('DM bildirimi oluşturma hatası:', notificationError);
      }
    }

    res.status(201).json(messageDetails[0]);
  } catch (error) {
    console.error('Mesaj gönderilirken hata:', error);
    res.status(500).json({ error: 'Mesaj gönderilirken bir hata oluştu' });
  }
});

// Tüm mesajları sil
router.delete('/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { type } = req.query; // 'general' veya 'dm'

    // Sadece yöneticiler genel mesajları silebilir
    if (type === 'general' && userRole !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz yok!' });
    }

    if (type === 'general') {
      await pool.query(
        'DELETE FROM messages WHERE receiver_id IS NULL',
        []
      );
      res.json({ message: 'Tüm genel mesajlar başarıyla silindi' });
    } else if (type === 'dm') {
      await pool.query(
        'DELETE FROM messages WHERE (sender_id = $1 OR receiver_id = $1) AND receiver_id IS NOT NULL',
        [userId]
      );
      res.json({ message: 'Tüm özel mesajlar başarıyla silindi' });
    } else {
      res.status(400).json({ message: 'Geçersiz mesaj tipi!' });
    }
  } catch (err) {
    console.error('Tüm mesajları silme hatası:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  }
});

// Tek bir mesajı sil
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Mesajın var olduğunu kontrol et
    const checkResult = await pool.query(
      'SELECT * FROM messages WHERE id = $1',
      [messageId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Mesaj bulunamadı!'
      });
    }

    const message = checkResult.rows[0];

    // Genel mesaj ise sadece yönetici silebilir
    if (message.receiver_id === null && userRole !== 'admin') {
      return res.status(403).json({
        message: 'Genel mesajları sadece yöneticiler silebilir!'
      });
    }

    // Özel mesaj ise sadece gönderen veya alıcı silebilir
    if (message.receiver_id !== null && message.sender_id !== userId && message.receiver_id !== userId) {
      return res.status(403).json({
        message: 'Bu mesajı silme yetkiniz yok!'
      });
    }

    // Mesajı sil
    await pool.query(
      'DELETE FROM messages WHERE id = $1',
      [messageId]
    );

    res.json({ message: 'Mesaj başarıyla silindi' });
  } catch (err) {
    console.error('Mesaj silme hatası:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  }
});

// Sohbet ve destek botu: @asistan ile başlayan mesajlara yanıt
router.post('/ask-bot', authenticateToken, async (req, res) => {
  const { message } = req.body;
  try {
    const prompt = `Bir görev yönetim sisteminde asistan botsun. Kullanıcıdan gelen soru: "${message}". Kısa ve faydalı bir yanıt ver.`;
    const answer = await askLLM(prompt);
    res.json({ answer });
  } catch (err) {
    console.error('Bot yanıt hatası:', err);
    res.status(500).json({ message: 'Bot yanıt hatası', error: err.message });
  }
});

// Haftalık özet/rapor endpointi
router.post('/summary', authenticateToken, async (req, res) => {
  try {
    // Son 7 günün görevlerini çek
    const result = await pool.query(
      `SELECT * FROM tasks WHERE created_at > NOW() - INTERVAL '7 days'`
    );
    const prompt = `Aşağıda bir görev yönetim sisteminin son 1 haftadaki görevleri var. Bunları özetle ve önemli noktaları belirt:\n${JSON.stringify(result.rows)}`;
    const summary = await askLLM(prompt);
    res.json({ summary });
  } catch (err) {
    console.error('LLM özet hatası:', err);
    res.status(500).json({ message: 'LLM özet hatası', error: err.message });
  }
});

module.exports = router; 