const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { 
  suggestTaskDescription, 
  suggestEmployeeForTask,
  updateEmployeeTaskHistory,
  markTaskAsCompleted 
} = require('../services/llm');

dayjs.extend(utc);
dayjs.extend(timezone);

// Rate limiting için basit bir cache
const requestCache = new Map();
const RATE_LIMIT = 5; // 5 istek
const RATE_WINDOW = 60000; // 1 dakika

// Rate limiting middleware
const rateLimiter = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const windowStart = now - RATE_WINDOW;

  // Eski istekleri temizle
  for (const [key, timestamp] of requestCache.entries()) {
    if (timestamp < windowStart) {
      requestCache.delete(key);
    }
  }

  // IP için istek sayısını kontrol et
  const requestCount = Array.from(requestCache.entries())
    .filter(([key, timestamp]) => key.startsWith(ip) && timestamp > windowStart)
    .length;

  if (requestCount >= RATE_LIMIT) {
    return res.status(429).json({
      message: 'Çok fazla istek gönderdiniz. Lütfen bir süre bekleyin.'
    });
  }

  // İsteği kaydet
  requestCache.set(`${ip}-${now}`, now);
  next();
};

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

// Tüm görevleri listele (admin için) veya kullanıcıya atanan görevleri listele (employee için)
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('Görev listeleme isteği:', {
      userId: req.user.id,
      userRole: req.user.role
    });

    let query = `
      SELECT tasks.*, users.name as assigned_to_name 
      FROM tasks 
      LEFT JOIN users ON tasks.assigned_to = users.id
      WHERE 1=1
    `;
    let params = [];

    // Artık tüm kullanıcılar tüm görevleri görebilir
    // Filtreleme kaldırıldı

    query += ' ORDER BY tasks.created_at DESC';

    const result = await pool.query(query, params);
    // labels alanını parse et
    const tasks = result.rows.map(task => {
      if (typeof task.labels === 'string') {
        try {
          task.labels = JSON.parse(task.labels);
        } catch (e) {
          task.labels = [];
        }
      }
      if (typeof task.checklist === 'string') {
        try {
          task.checklist = JSON.parse(task.checklist);
        } catch (e) {
          task.checklist = [];
        }
      }
      return task;
    });
    console.log('Görev listesi:', {
      count: tasks.length,
      tasks: tasks
    });

    res.json(tasks);
  } catch (err) {
    console.error('Görev listeleme sırasında hata:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  }
});

// Belirli bir görevi getir
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT tasks.*, users.name as assigned_to_name 
      FROM tasks 
      LEFT JOIN users ON tasks.assigned_to = users.id
      WHERE tasks.id = $1
    `;
    let params = [req.params.id];

    // Artık tüm kullanıcılar tüm görevleri görebilir
    // Filtreleme kaldırıldı

    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Görev bulunamadı!',
        id: req.params.id
      });
    }
    // labels alanını parse et
    let task = result.rows[0];
    if (typeof task.labels === 'string') {
      try {
        task.labels = JSON.parse(task.labels);
      } catch (e) {
        task.labels = [];
      }
    }
    if (typeof task.checklist === 'string') {
      try {
        task.checklist = JSON.parse(task.checklist);
      } catch (e) {
        task.checklist = [];
      }
    }
    res.json(task);
  } catch (err) {
    console.error('Görev getirme sırasında hata:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  }
});

// Görev oluşturma
router.post('/', authenticateToken, rateLimiter, async (req, res) => {
  // Sadece admin görev oluşturabilir
  if (!req.user.is_admin) {
    return res.status(403).json({
      message: 'Bu işlem için yetkiniz yok!'
    });
  }

  const { title, assigned_to, category = 'other', priority = 'medium', deadline = null, labels = [], checklist = [] } = req.body;
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const description = await suggestTaskDescription(title);

    const employeesResult = await client.query(`
      SELECT 
        u.id, 
        u.name, 
        u.role as role_name,
        u.position,
        CASE 
          WHEN u.position IS NOT NULL THEN u.position
          WHEN u.role = 'developer' THEN 'Yazılım Geliştirici'
          WHEN u.role = 'designer' THEN 'Tasarımcı'
          WHEN u.role = 'tester' THEN 'Test Uzmanı'
          ELSE u.role
        END as role_description
      FROM users u
      WHERE LOWER(u.role) NOT IN ('admin', 'manager', 'yönetici')
      ORDER BY u.name
    `);

    const suggestedEmployee = await suggestEmployeeForTask(
      title,
      description,
      employeesResult.rows,
      category
    );

    const userCheck = await client.query('SELECT * FROM users WHERE id = $1', [assigned_to]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'Atanacak kullanıcı bulunamadı!',
        userId: assigned_to
      });
    }

    // Görevi oluştur
    const result = await client.query(
      'INSERT INTO tasks (title, description, assigned_to, created_by, status, category, priority, deadline, labels, checklist) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [title, description, assigned_to, req.user.id, 'Yapılacaklar', category, priority, deadline, JSON.stringify(labels), JSON.stringify(checklist)]
    );

    // Görev atandığında çalışana bildirim gönder
    const creatorUser = await client.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const notificationMessage = `${creatorUser.rows[0].name} size yeni bir görev atadı: "${title}"`;
    
    await client.query(
      'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
      [assigned_to, notificationMessage]
    );

    // Görev geçmişine yeni kayıt ekle (ilk atama)
    await client.query(`
      INSERT INTO employee_task_history (employee_id, task_id, task_title, task_description, task_category)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (employee_id, task_id) DO NOTHING
    `, [assigned_to, result.rows[0].id, title, description, category]);

    // Görev oluşturulduğunda otomatik yorum ekle
    const creationComment = `${creatorUser.rows[0].name} tarafından ${dayjs().tz('Europe/Istanbul').format('DD.MM.YYYY HH:mm')} tarihinde oluşturuldu`;
    await client.query(
      'INSERT INTO task_updates (task_id, user_id, comment) VALUES ($1, $2, $3)',
      [result.rows[0].id, req.user.id, creationComment]
    );

    await client.query('COMMIT');

    res.status(201).json({
      task: result.rows[0],
      suggestedEmployee: suggestedEmployee ? {
        name: suggestedEmployee.name,
        position: suggestedEmployee.position,
        explanation: suggestedEmployee.explanation
      } : null
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Görev oluşturma sırasında hata:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Görevi güncelle
router.put('/:id', authenticateToken, async (req, res) => {
  const { title, description, status, assigned_to, category, priority, deadline, labels, checklist, completed } = req.body;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const taskCheck = await client.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (taskCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        message: 'Görev bulunamadı!',
        id: req.params.id
      });
    }

    // Admin için tüm alanları güncelleme
    // Kullanıcı varlığını kontrol et
    let newAssignedTo = assigned_to !== undefined ? assigned_to : taskCheck.rows[0].assigned_to;
    let newTitle = title !== undefined ? title : taskCheck.rows[0].title;
    let newDescription = description !== undefined ? description : taskCheck.rows[0].description;
    let newCategory = category !== undefined ? category : taskCheck.rows[0].category;
    let newStatus = status !== undefined ? status : taskCheck.rows[0].status;
    let newPriority = priority !== undefined ? priority : taskCheck.rows[0].priority;
    let newDeadline = deadline !== undefined ? deadline : taskCheck.rows[0].deadline;
    let newLabels = labels !== undefined ? labels : taskCheck.rows[0].labels;
    let newChecklist = checklist !== undefined ? checklist : taskCheck.rows[0].checklist;
    let newCompleted = completed !== undefined ? completed : taskCheck.rows[0].completed;

    if (assigned_to !== null && assigned_to !== undefined) {
      const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [assigned_to]);
      if (userCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: 'Atanacak kullanıcı bulunamadı!',
          userId: assigned_to
        });
      }
    }

    // Görev güncellendiğinde geçmişi de güncelle (yeni kayıt ekleme, sadece update)
    if (newAssignedTo) {
      await client.query(`
        UPDATE employee_task_history
        SET task_title = $1, task_description = $2, task_category = $3
        WHERE employee_id = $4 AND task_id = $5
      `, [newTitle, newDescription, newCategory, newAssignedTo, req.params.id]);
    }

    // Görevi güncelle - completed_at alanını da otomatik güncelle
    let updateQuery = `
      UPDATE tasks 
      SET title = $1, description = $2, status = $3, assigned_to = $4, category = $5, priority = $6, deadline = $7, labels = $8, checklist = $9, updated_at = NOW()
    `;
    
    let queryParams = [newTitle, newDescription, newStatus, newAssignedTo, newCategory, newPriority, newDeadline, JSON.stringify(newLabels), JSON.stringify(newChecklist)];
    
    // Completed alanını ve completed_at alanını ayrı ayrı yönet
    let completedValue = newCompleted;
    let completedAtValue = null;
    
    // Eğer status completed veya Tamamlandı ise
    if (newStatus === 'completed' || newStatus === 'Tamamlandı') {
      completedValue = true;
      completedAtValue = 'CURRENT_TIMESTAMP';
    } else if (newStatus !== 'completed' && newStatus !== 'Tamamlandı' && newCompleted === false) {
      // Eğer status completed değilse ve completed false ise
      completedValue = false;
      completedAtValue = 'NULL';
    } else if (newCompleted === false && (newStatus === taskCheck.rows[0].status || newStatus === undefined)) {
      // Sadece completed false yapıldıysa
      completedValue = false;
      completedAtValue = 'NULL';
    } else if (newCompleted === true && (newStatus === taskCheck.rows[0].status || newStatus === undefined)) {
      // Sadece completed true yapıldıysa
      completedValue = true;
      completedAtValue = 'CURRENT_TIMESTAMP';
    }
    
    // Completed alanını ekle
    updateQuery += `, completed = $${queryParams.length + 1}`;
    queryParams.push(completedValue);
    
    // Completed_at alanını ekle
    if (completedAtValue === 'CURRENT_TIMESTAMP') {
      updateQuery += `, completed_at = CURRENT_TIMESTAMP`;
    } else if (completedAtValue === 'NULL') {
      updateQuery += `, completed_at = NULL`;
    }
    
    updateQuery += ` WHERE id = $${queryParams.length + 1} RETURNING *`;
    queryParams.push(req.params.id);
    
    const result = await client.query(updateQuery, queryParams);

    // Görev güncellendiğinde bildirim gönder
    const updaterUser = await client.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const taskTitle = newTitle || taskCheck.rows[0].title;
    
    // Bildirimleri async olarak gönder (ana işlemi geciktirmemek için)
    setTimeout(async () => {
      try {
        // Eğer yeni bir kişiye atandıysa
        if (assigned_to && assigned_to !== taskCheck.rows[0].assigned_to) {
          const reassignMessage = `${updaterUser.rows[0].name} "${taskTitle}" görevini size atadı`;
          await client.query(
            'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
            [assigned_to, reassignMessage]
          );
        }
        
        // Eğer çalışan kendi görevini güncellediyse yöneticiye bildirim gönder
        if (req.user.role !== 'admin' && taskCheck.rows[0].assigned_to === req.user.id) {
          const employeeUpdateMessage = `${updaterUser.rows[0].name} "${taskTitle}" görevini güncelledi`;
          
          // Yöneticilere bildirim gönder
          const admins = await client.query('SELECT id FROM users WHERE role = $1', ['admin']);
          for (const admin of admins.rows) {
            await client.query(
              'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
              [admin.id, employeeUpdateMessage]
            );
          }
        }
        
        // Eğer yönetici görevi güncellediyse çalışana bildirim gönder
        if (req.user.role === 'admin' && taskCheck.rows[0].assigned_to && taskCheck.rows[0].assigned_to !== req.user.id) {
          const adminUpdateMessage = `${updaterUser.rows[0].name} "${taskTitle}" görevini güncelledi`;
          await client.query(
            'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
            [taskCheck.rows[0].assigned_to, adminUpdateMessage]
          );
        }
      } catch (error) {
        console.error('Bildirim gönderme hatası:', error);
      }
    }, 0);

    // Eğer görev tamamlandıysa geçmişi güncelle (async olarak çalıştır)
    if (newStatus === 'completed' || newStatus === 'Tamamlandı') {
      markTaskAsCompleted(req.params.id).then(completionResult => {
        if (completionResult.success) {
          console.log('✅ Görev tamamlandı olarak işaretlendi:', completionResult.task);
        } else {
          console.log('⚠️ Görev tamamlanma işlemi başarısız:', completionResult.message);
        }
      }).catch(err => {
        console.error('Görev tamamlanma işlemi hatası:', err);
      });
    }

    await client.query('COMMIT');

    res.json({
      message: 'Görev başarıyla güncellendi!',
      updatedTask: result.rows[0]
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Görev güncelleme sırasında hata:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Görev silme endpoint'i
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // Önce görevi bul
    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: 'Görev bulunamadı' });
    }

    // Sadece admin veya görevin sahibi silebilir
    if (userRole !== 'admin' && taskResult.rows[0].created_by !== userId) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz yok' });
    }

    // Görev silinmeden önce bildirim gönder
    const deleterUser = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
    const taskTitle = taskResult.rows[0].title;
    const assignedTo = taskResult.rows[0].assigned_to;
    
    // Görev atanan kişiye bildirim gönder
    if (assignedTo && assignedTo !== userId) {
      const deleteMessage = `${deleterUser.rows[0].name} "${taskTitle}" görevini sildi`;
      await pool.query(
        'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
        [assignedTo, deleteMessage]
      );
    }

    // Görevi sil
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    
    // İlgili güncelleme kayıtlarını da sil
    await pool.query('DELETE FROM task_updates WHERE task_id = $1', [id]);

    res.json({ message: 'Görev başarıyla silindi' });
  } catch (err) {
    console.error('Görev silinirken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Görevin güncelleme kayıtlarını listele
router.get('/:taskId/updates', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT tu.id, tu.task_id, tu.user_id, tu.comment, tu.progress, tu.updated_at, u.name as user_name
      FROM task_updates tu
      LEFT JOIN users u ON tu.user_id = u.id
      WHERE tu.task_id = $1
      ORDER BY tu.updated_at ASC
    `, [req.params.taskId]);

    console.log('Backend: Yorumlar listeleniyor:', {
      taskId: req.params.taskId,
      rowCount: result.rows.length,
      rows: result.rows
    });

    res.json(result.rows);
  } catch (err) {
    console.error('Güncelleme listeleme sırasında hata:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  }
});

// Yeni güncelleme ekle
router.post('/:taskId/updates', authenticateToken, async (req, res) => {
  const { progress, comment } = req.body;
  const user_id = req.user.id;
  try {
    // Görevin varlığını kontrol et
    const taskCheck = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.taskId]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({
        message: 'Görev bulunamadı!',
        id: req.params.taskId
      });
    }

    // Progress değeri kontrolü (sadece progress gönderilmişse)
    if (progress !== undefined && (progress < 0 || progress > 100)) {
      return res.status(400).json({
        message: 'Progress değeri 0-100 arasında olmalıdır!'
      });
    }

    const result = await pool.query(
      'INSERT INTO task_updates (task_id, user_id, progress, comment) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.taskId, user_id, progress || null, comment]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Güncelleme ekleme sırasında hata:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  }
});

// Yorum silme endpoint'i
router.delete('/:taskId/updates/:updateId', authenticateToken, async (req, res) => {
  const user_id = req.user.id;
  const { taskId, updateId } = req.params;
  
  try {
    // Yorumun varlığını ve sahibini kontrol et
    const updateCheck = await pool.query(
      'SELECT * FROM task_updates WHERE id = $1 AND task_id = $2',
      [updateId, taskId]
    );
    
    if (updateCheck.rows.length === 0) {
      return res.status(404).json({
        message: 'Yorum bulunamadı!'
      });
    }

    // Sadece yorumu yazan kişi silebilir
    if (updateCheck.rows[0].user_id !== user_id) {
      return res.status(403).json({
        message: 'Bu yorumu silme yetkiniz yok!'
      });
    }

    // Yorumu sil
    await pool.query(
      'DELETE FROM task_updates WHERE id = $1 AND task_id = $2',
      [updateId, taskId]
    );

    res.json({ message: 'Yorum başarıyla silindi' });
  } catch (err) {
    console.error('Yorum silme sırasında hata:', err);
    res.status(500).json({
      message: 'Sunucu hatası!',
      error: err.message
    });
  }
});

// Görev açıklaması önerisi endpoint'i
router.post('/suggest', async (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Başlık gereklidir' });
  }

  try {
    const suggestion = await suggestTaskDescription(title);
    res.json({ suggestion });
  } catch (error) {
    console.error('Görev açıklaması önerisi oluşturulurken hata:', error);
    res.status(500).json({ message: 'Görev açıklaması önerisi oluşturulurken bir hata oluştu' });
  }
});

// Görev açıklaması önerisi al
router.post('/suggest-description', authenticateToken, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({
        message: 'Görev başlığı gerekli!'
      });
    }
    // OpenAI yerine suggestTaskDescription fonksiyonu (Mistral/Ollama) kullanılıyor
    const description = await suggestTaskDescription(title);
    res.json({
      description
    });
  } catch (error) {
    console.error('Açıklama önerisi alınamadı:', error);
    res.status(500).json({
      message: 'Açıklama önerisi alınırken bir hata oluştu'
    });
  }
});

// Çalışan önerisi endpoint'i
router.post('/suggest-employee', authenticateToken, async (req, res) => {
  const { title, description, category } = req.body;
  const usedCategory = category || 'other';

  if (!title || !description) {
    return res.status(400).json({ message: 'Başlık ve açıklama gereklidir' });
  }

  const client = await pool.connect();
  try {
    // Tüm çalışanları ve pozisyonlarını getir (yöneticiler ve adminler hariç)
    const employeesResult = await client.query(`
      SELECT 
        u.id, 
        u.name, 
        u.role as role_name,
        u.position,
        CASE 
          WHEN u.position IS NOT NULL THEN u.position
          WHEN u.role = 'developer' THEN 'Yazılım Geliştirici'
          WHEN u.role = 'designer' THEN 'Tasarımcı'
          WHEN u.role = 'tester' THEN 'Test Uzmanı'
          ELSE u.role
        END as role_description
      FROM users u
      WHERE LOWER(u.role) NOT IN ('admin', 'manager', 'yönetici')
      ORDER BY u.name
    `);

    // Her çalışanın görev geçmişi istatistiklerini çek
    const employeeIds = employeesResult.rows.map(emp => emp.id);
    let historyMap = {};
    if (employeeIds.length > 0) {
      const historyResult = await client.query(`
        SELECT 
          employee_id,
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_tasks,
          COUNT(CASE WHEN task_category = $1 THEN 1 END) as category_tasks
        FROM employee_task_history
        WHERE employee_id = ANY($2)
        GROUP BY employee_id
      `, [usedCategory, employeeIds]);
      historyMap = Object.fromEntries(historyResult.rows.map(row => [row.employee_id, row]));
    }
    // Çalışanlara istatistikleri ekle
    const employeesWithStats = employeesResult.rows.map(emp => {
      const stats = historyMap[emp.id] || { total_tasks: 0, completed_tasks: 0, category_tasks: 0 };
      return {
        ...emp,
        total_tasks: Number(stats.total_tasks || 0),
        completed_tasks: Number(stats.completed_tasks || 0),
        category_tasks: Number(stats.category_tasks || 0)
      };
    });

    // En uygun çalışanı öner (artık istatistikli dizi gönderiyoruz)
    const suggestedEmployee = await suggestEmployeeForTask(
      title,
      description,
      employeesWithStats,
      usedCategory
    );

    console.log('AI önerisi:', suggestedEmployee);

    if (suggestedEmployee && suggestedEmployee.selectedEmployee) {
      const selectedEmp = suggestedEmployee.selectedEmployee;
      
      // ID'ye göre çalışanı bul
      const matched = employeesResult.rows.find(emp => emp.id === selectedEmp.id);
      if (matched) {
        res.json({ 
          suggestedEmployee: {
            id: matched.id,
            name: matched.name,
            position: matched.position || matched.role_name,
            explanation: selectedEmp.reason || 'AI tarafından önerildi',
            confidence: 'orta',
            alternativeEmployee: null
          }
        });
      } else {
        // Çalışan bulunamazsa yine de açıklamayı döndür
        res.json({ 
          suggestedEmployee: {
            id: selectedEmp.id,
            name: selectedEmp.name,
            position: null,
            explanation: selectedEmp.reason || 'AI tarafından önerildi',
            confidence: 'orta',
            alternativeEmployee: null
          }
        });
      }
    } else {
      res.status(404).json({ message: 'Uygun çalışan bulunamadı' });
    }
  } catch (error) {
    console.error('Çalışan önerisi oluşturulurken hata:', error);
    res.status(500).json({ message: 'Çalışan önerisi oluşturulurken bir hata oluştu' });
  } finally {
    client.release();
  }
});

module.exports = router;