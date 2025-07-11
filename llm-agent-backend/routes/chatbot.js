const express = require('express');
const router = express.Router();
const { 
  askLLM, 
  getProjectContext, 
  listTasks, 
  getSmartTaskSuggestions, 
  createTaskFromNaturalLanguage, 
  analyzeTaskPerformance,
  memorySystem,
  advancedMemorySystem
} = require('../services/llm');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// Token doğrulama middleware'i
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Yetkilendirme token\'ı bulunamadı!' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Geçersiz token!' });
    }
    req.user = user;
    next();
  });
};

// Chatbot mesajlarını işle
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Yönetici için tüm görevleri listeleme (ÖNCE KONTROL ET)
    if (userRole === 'admin' && (
        message.toLowerCase().includes('tüm görevleri listele') || 
        message.toLowerCase().includes('sistemdeki görevleri göster') ||
        message.toLowerCase().includes('tüm görevler'))) {
      
      try {
        const { rows: tasks } = await pool.query(`
          SELECT t.*, u.name as assigned_to_name, c.name as created_by_name
          FROM tasks t
          LEFT JOIN users u ON t.assigned_to = u.id
          LEFT JOIN users c ON t.created_by = c.id
          ORDER BY t.created_at DESC
        `);

        if (tasks.length === 0) {
          return res.json({
            response: 'Şu anda sistemde aktif görev bulunmuyor.'
          });
        }

        let taskList = 'İşte sistemdeki tüm görevler:\n\n';
        tasks.forEach((task, index) => {
          taskList += `${index + 1}. ${task.title}\n`;
          taskList += `   Durum: ${task.status}\n`;
          taskList += `   Açıklama: ${task.description || 'Açıklama yok'}\n`;
          taskList += `   Atanan: ${task.assigned_to_name || 'Atanmamış'}\n`;
          if (task.priority) {
            taskList += `   Öncelik: ${task.priority}\n`;
          }
          taskList += '\n';
        });

        return res.json({
          response: taskList
        });
      } catch (error) {
        console.error('Görev listesi hatası:', error);
        return res.json({
          response: 'Görev listesi alınırken bir hata oluştu.'
        });
      }
    }

    // Genel görev listesi isteği kontrolü (SONRA KONTROL ET)
    if (message.toLowerCase().includes('görevleri listele') || 
        message.toLowerCase().includes('görevlerimi göster') ||
        message.toLowerCase().includes('görevlerim neler') ||
        message.toLowerCase().includes('aktif görevler')) {
      
      // Yönetici için farklı yanıt
      if (userRole === 'admin') {
        return res.json({
          response: 'Yönetici olarak sistemdeki tüm görevleri görmek için "Tüm görevleri listele" veya "Sistemdeki görevleri göster" yazabilirsiniz. Kendi görevlerinizi görmek için "Görevlerimi listele" yazın.'
        });
      }
      
      // Çalışan için kendi görevlerini getir
      const tasks = await listTasks(userId, userRole);
      
      if (tasks.length === 0) {
        return res.json({
          response: 'Şu anda size atanmış aktif görev bulunmuyor.'
        });
      }

      let taskList = 'İşte görevleriniz:\n\n';
      tasks.forEach((task, index) => {
        taskList += `${index + 1}. ${task.title}\n`;
        taskList += `   Durum: ${task.status}\n`;
        taskList += `   Açıklama: ${task.description || 'Açıklama yok'}\n`;
        if (task.priority) {
          taskList += `   Öncelik: ${task.priority}\n`;
        }
        taskList += '\n';
      });

      return res.json({
        response: taskList
      });
    }

    // Çalışanları listeleme isteği kontrolü
    if (message.toLowerCase().includes('çalışanları listele') || 
        message.toLowerCase().includes('çalışanları göster') ||
        message.toLowerCase().includes('çalışan listesi') ||
        message.toLowerCase().includes('kullanıcıları listele') ||
        message.toLowerCase().includes('kullanıcıları göster') ||
        message.toLowerCase().includes('personel listesi') ||
        message.toLowerCase().includes('ekip üyeleri')) {
      
      // Sadece admin rolündeki kullanıcılar çalışanları listeleyebilir
      if (userRole !== 'admin') {
        return res.json({
          response: 'Üzgünüm, çalışan listesini görüntüleme yetkiniz bulunmuyor. Bu özellik sadece yöneticiler tarafından kullanılabilir.'
        });
      }
      
      try {
        // Sadece çalışanları (employee rolündeki kullanıcıları) getir
        const { rows: users } = await pool.query(`
          SELECT 
            id,
            name,
            email,
            role,
            created_at
          FROM users 
          WHERE role = 'employee'
          ORDER BY name ASC
        `);

        if (users.length === 0) {
          return res.json({
            response: 'Sistemde henüz çalışan bulunmuyor.'
          });
        }

        let userList = 'İşte sistemdeki çalışanlar:\n\n';
        users.forEach((user, index) => {
          const joinDate = new Date(user.created_at).toLocaleDateString('tr-TR');
          const firstName = user.name.split(' ')[0]; // Sadece ilk ismi al
          
          userList += `${index + 1}. ${firstName}\n`;
          userList += `   E-posta: ${user.email}\n`;
          userList += `   Katılım Tarihi: ${joinDate}\n`;
          userList += '\n';
        });

        return res.json({
          response: userList
        });
      } catch (error) {
        console.error('Çalışan listesi hatası:', error);
        return res.json({
          response: 'Çalışan listesi alınırken bir hata oluştu.'
        });
      }
    }

    // Toplantı sorgusu kontrolü
    if (message.toLowerCase().includes('toplantım var mı') || 
        message.toLowerCase().includes('toplantılarım') ||
        message.toLowerCase().includes('bugün toplantım') ||
        message.toLowerCase().includes('toplantılarım neler') ||
        message.toLowerCase().includes('toplantı listesi')) {
      
      try {
        // Bugünün tarihini al
        const today = new Date().toISOString().split('T')[0];
        console.log('Toplantı sorgusu - Bugünün tarihi:', today);
        console.log('Toplantı sorgusu - Kullanıcı ID:', userId);
        
        // Önce meetings_participants tablosunun var olup olmadığını kontrol et
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'meetings_participants'
          );
        `);
        
        console.log('meetings_participants tablosu var mı:', tableCheck.rows[0].exists);
        
        let meetingsQuery;
        let queryParams;
        
        if (tableCheck.rows[0].exists) {
          // meetings_participants tablosu varsa katılımcıları da kontrol et
          meetingsQuery = `
            SELECT m.*, u.name as created_by_name
            FROM meetings m
            LEFT JOIN users u ON m.created_by = u.id
            LEFT JOIN meetings_participants mp ON m.id = mp.meeting_id
            WHERE (m.created_by = $1 OR mp.user_id = $1)
            AND m.date >= $2
            AND m.is_cancelled = false
            ORDER BY m.date ASC, m.time ASC
          `;
          queryParams = [userId, today];
          console.log('Katılımcılı sorgu kullanılıyor');
        } else {
          // meetings_participants tablosu yoksa sadece oluşturduğu toplantıları getir
          meetingsQuery = `
            SELECT m.*, u.name as created_by_name
            FROM meetings m
            LEFT JOIN users u ON m.created_by = u.id
            WHERE m.created_by = $1
            AND m.date >= $2
            AND m.is_cancelled = false
            ORDER BY m.date ASC, m.time ASC
          `;
          queryParams = [userId, today];
          console.log('Sadece oluşturulan toplantılar sorgusu kullanılıyor');
        }
        
        console.log('SQL Sorgusu:', meetingsQuery);
        console.log('Parametreler:', queryParams);
        
        const meetingsResult = await pool.query(meetingsQuery, queryParams);
        const meetings = meetingsResult.rows;
        
        console.log('Bulunan toplantı sayısı:', meetings.length);
        
        if (meetings.length === 0) {
          return res.json({
            response: 'Bugün ve gelecekte planlanmış toplantınız bulunmuyor.'
          });
        }

        let meetingList = 'İşte toplantılarınız:\n\n';
        meetings.forEach((meeting, index) => {
          const meetingDate = new Date(meeting.date).toLocaleDateString('tr-TR');
          const meetingTime = meeting.time;
          
          meetingList += `${index + 1}. ${meeting.title}\n`;
          meetingList += `   Tarih: ${meetingDate}\n`;
          meetingList += `   Saat: ${meetingTime}\n`;
          if (meeting.description) {
            meetingList += `   Açıklama: ${meeting.description}\n`;
          }
          meetingList += `   Oluşturan: ${meeting.created_by_name}\n`;
          meetingList += '\n';
        });

        return res.json({
          response: meetingList
        });
      } catch (error) {
        console.error('Toplantı sorgusu hatası:', error);
        console.error('Hata detayı:', error.message);
        console.error('SQL State:', error.code);
        return res.json({
          response: 'Toplantı bilgileriniz alınırken bir hata oluştu.'
        });
      }
    }

    // AI Chat için özel kontrol
    if (req.body.role === 'ai_chat') {
      try {
        // Sohbet geçmişini al
        const conversationHistory = req.body.conversation_history || [];
        
        // Gelişmiş bellek sistemi kullan
        const userId = req.user.id;
        
        // Kullanıcı mesajını belleğe kaydet
        advancedMemorySystem.addUserMessage(userId, message, {
          role: req.user.role,
          name: req.user.name,
          timestamp: new Date()
        });
        
        // Son 10 mesajı eski belleğe de ekle (geriye uyumluluk)
        if (conversationHistory.length > 0) {
          conversationHistory.slice(-10).forEach(msg => {
            if (msg.role === 'user') {
              memorySystem.addMessage({
                role: 'user',
                content: msg.content,
                timestamp: Date.now()
              });
            }
          });
        }

        const response = await askLLM(message, { 
          user: req.user,
          conversation_history: conversationHistory
        });
        
        // AI yanıtını belleğe kaydet
        advancedMemorySystem.addAIResponse(userId, response, {
          role: req.user.role,
          name: req.user.name,
          timestamp: new Date()
        });
        
        return res.json({
          response: response
        });
      } catch (error) {
        console.error('AI Chat hatası:', error);
        return res.status(500).json({
          response: 'Üzgünüm, şu anda yanıt veremiyorum. Lütfen tekrar deneyin.'
        });
      }
    }

    // Diğer chatbot mesajları için normal işlem
    const context = await getProjectContext();
    const response = await askLLM(message, context);
    res.json({ response });
  } catch (error) {
    console.error('Chatbot hatası:', error);
    res.status(500).json({ message: 'Chatbot işlenirken bir hata oluştu' });
  }
});

// Akıllı görev önerileri endpoint'i
router.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const suggestions = await getSmartTaskSuggestions(userId, userRole);
    
    res.json({
      success: true,
      suggestions: suggestions.suggestions || []
    });
  } catch (error) {
    console.error('Görev önerisi hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Görev önerileri alınamadı.'
    });
  }
});

// Doğal dil görev oluşturma endpoint'i
router.post('/create-task', authenticateToken, async (req, res) => {
  try {
    const { naturalText } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    if (!naturalText) {
      return res.status(400).json({
        success: false,
        message: 'Görev açıklaması gerekli.'
      });
    }
    
    const result = await createTaskFromNaturalLanguage(naturalText, userId, userRole);
    
    res.json(result);
  } catch (error) {
    console.error('Görev oluşturma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Görev oluşturulamadı.'
    });
  }
});

// Performans analizi endpoint'i
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🔍 Performans analizi isteği - Kullanıcı ID:', userId);
    
    const analysis = await analyzeTaskPerformance(userId);
    console.log('📊 Analiz sonucu:', analysis);
    
    if (!analysis) {
      console.log('❌ Analiz null döndü');
      return res.status(500).json({
        success: false,
        message: 'Performans analizi yapılamadı.'
      });
    }
    
    console.log('✅ Analiz başarılı, istatistikler:', analysis.stats);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('❌ Performans analizi hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Performans analizi alınamadı.'
    });
  }
});

// Model durumu kontrolü
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const TogetherAIService = require('../services/together-ai-service');
    const togetherAIService = new TogetherAIService();
    const status = await togetherAIService.checkStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Model durumu kontrol hatası:', error);
    res.status(500).json({ 
      success: false,
      message: 'Model durumu kontrol edilemedi',
      error: error.message 
    });
  }
});

// Bellek yönetimi endpoint'leri
router.get('/memory', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userHistory = advancedMemorySystem.getUserHistory(userId);
    const userPreferences = advancedMemorySystem.getUserPreferences(userId);
    
    res.json({
      success: true,
      data: {
        history: userHistory,
        preferences: userPreferences
      }
    });
  } catch (error) {
    console.error('Bellek getirme hatası:', error);
    res.status(500).json({ message: 'Bellek bilgileri alınamadı' });
  }
});

// Belleği temizle
router.delete('/memory', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    advancedMemorySystem.clearUserMemory(userId);
    
    res.json({
      success: true,
      message: 'Bellek başarıyla temizlendi'
    });
  } catch (error) {
    console.error('Bellek temizleme hatası:', error);
    res.status(500).json({ message: 'Bellek temizlenemedi' });
  }
});

// Kullanıcı tercihlerini güncelle
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;
    
    const userMemory = advancedMemorySystem.getUserMemory(userId);
    userMemory.preferences = { ...userMemory.preferences, ...preferences };
    
    res.json({
      success: true,
      message: 'Tercihler güncellendi',
      data: userMemory.preferences
    });
  } catch (error) {
    console.error('Tercih güncelleme hatası:', error);
    res.status(500).json({ message: 'Tercihler güncellenemedi' });
  }
});

module.exports = router; 