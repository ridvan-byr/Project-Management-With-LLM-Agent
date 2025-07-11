const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Toplantıları listele (tarihe göre)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ message: 'Tarih parametresi gereklidir.' });
    }

    const result = await pool.query(
      'SELECT * FROM meetings WHERE date = $1 ORDER BY time ASC',
      [date]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Toplantıları listelerken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Yeni toplantı oluştur
router.post('/', authenticateToken, async (req, res) => {
  const { title, description, date, time, user_ids } = req.body;
  
  if (!title || !date || !time || !user_ids || !Array.isArray(user_ids)) {
    return res.status(400).json({ message: 'title, date, time ve user_ids zorunludur.' });
  }

  try {
    // date ve time'i birleştirerek meeting_time oluştur
    const meetingDateTime = `${date} ${time}`;
    
    // Toplantıyı veritabanına kaydet
    const result = await pool.query(
      'INSERT INTO meetings (title, description, date, time, meeting_time, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, description || '', date, time, meetingDateTime, req.user.id]
    );

    const meeting = result.rows[0];

    // Katılımcıları meetings_participants tablosuna ekle
    try {
      for (const user_id of user_ids) {
        await pool.query(
          'INSERT INTO meeting_participants (meeting_id, user_id) VALUES ($1, $2)',
          [meeting.id, user_id]
        );
      }
    } catch (participantError) {
      console.log('Katılımcı ekleme hatası (geçici olarak atlandı):', participantError.message);
      // Katılımcı ekleme hatası toplantı oluşturmayı engellemez
    }

    // Katılımcılara bildirim gönder
    try {
      const message = `Yeni toplantı: ${title}\n${description ? description + '\n' : ''}Tarih: ${date} Saat: ${time}`;
      for (const user_id of user_ids) {
        await pool.query(
          'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
          [user_id, message]
        );
      }
    } catch (notifyError) {
      console.log('Toplantı bildirimi eklenirken hata:', notifyError.message);
    }

    res.status(201).json(meeting);
  } catch (err) {
    console.error('Toplantı oluştururken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Toplantı detayını getir
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, 
        u.name as created_by_name,
        array_agg(mp.user_id) as participant_ids
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
      WHERE m.id = $1
      GROUP BY m.id, u.name`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Toplantı bulunamadı.' });
    }

    const meeting = result.rows[0];
    let users = [];
    if (meeting.participant_ids && meeting.participant_ids.length > 0 && meeting.participant_ids[0] !== null) {
      // Katılımcı user objelerini çek
      const userResult = await pool.query(
        `SELECT id, name, email, role FROM users WHERE id = ANY($1::int[])`,
        [meeting.participant_ids]
      );
      users = userResult.rows;
    }
    meeting.users = users;
    res.json(meeting);
  } catch (err) {
    console.error('Toplantı detayı getirirken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Toplantıyı güncelle
router.put('/:id', authenticateToken, async (req, res) => {
  const { title, description, date, time, user_ids } = req.body;
  const meetingId = req.params.id;

  try {
    // Toplantının var olduğunu ve kullanıcının yetkisi olduğunu kontrol et
    const checkResult = await pool.query(
      'SELECT * FROM meetings WHERE id = $1 AND created_by = $2',
      [meetingId, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Toplantı bulunamadı veya yetkiniz yok.' });
    }

    // Toplantıyı güncelle
    await pool.query(
      'UPDATE meetings SET title = $1, description = $2, date = $3, time = $4 WHERE id = $5',
      [title, description || '', date, time, meetingId]
    );

    // Eğer user_ids verilmişse katılımcıları güncelle
    if (user_ids && Array.isArray(user_ids)) {
      // Mevcut katılımcıları sil
      await pool.query('DELETE FROM meeting_participants WHERE meeting_id = $1', [meetingId]);
      
      // Yeni katılımcıları ekle
      for (const user_id of user_ids) {
        await pool.query(
          'INSERT INTO meeting_participants (meeting_id, user_id) VALUES ($1, $2)',
          [meetingId, user_id]
        );
      }
    }

    res.json({ message: 'Toplantı başarıyla güncellendi.' });
  } catch (err) {
    console.error('Toplantı güncellenirken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Toplantıyı başlığa göre sil (iptal işlemi için)
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const { date, title } = req.query;
    
    if (!date || !title) {
      return res.status(400).json({ message: 'date ve title parametreleri gereklidir.' });
    }

    // Toplantının var olduğunu ve kullanıcının yetkisi olduğunu kontrol et
    const checkResult = await pool.query(
      'SELECT * FROM meetings WHERE date = $1 AND title = $2 AND created_by = $3',
      [date, title, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Toplantı bulunamadı veya yetkiniz yok.' });
    }

    const meetingId = checkResult.rows[0].id;

    // Katılımcıları sil (eğer tablo varsa)
    try {
      await pool.query('DELETE FROM meeting_participants WHERE meeting_id = $1', [meetingId]);
    } catch (participantError) {
      console.log('meetings_participants tablosu bulunamadı, katılımcı silme atlandı:', participantError.message);
      // Tablo yoksa katılımcı silme işlemini atla
    }
    
    // Toplantıyı sil
    await pool.query('DELETE FROM meetings WHERE id = $1', [meetingId]);

    res.json({ message: 'Toplantı başarıyla silindi.' });
  } catch (err) {
    console.error('Toplantı silinirken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

// Toplantıyı sil
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Toplantının var olduğunu ve kullanıcının yetkisi olduğunu kontrol et
    const checkResult = await pool.query(
      'SELECT * FROM meetings WHERE id = $1 AND created_by = $2',
      [req.params.id, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Toplantı bulunamadı veya yetkiniz yok.' });
    }

    // Katılımcıları sil (eğer tablo varsa)
    try {
      await pool.query('DELETE FROM meeting_participants WHERE meeting_id = $1', [req.params.id]);
    } catch (participantError) {
      console.log('meetings_participants tablosu bulunamadı, katılımcı silme atlandı:', participantError.message);
      // Tablo yoksa katılımcı silme işlemini atla
    }
    
    // Toplantıyı sil
    await pool.query('DELETE FROM meetings WHERE id = $1', [req.params.id]);

    res.json({ message: 'Toplantı başarıyla silindi.' });
  } catch (err) {
    console.error('Toplantı silinirken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası!' });
  }
});

module.exports = router; 