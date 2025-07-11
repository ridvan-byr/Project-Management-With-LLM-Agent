const { OpenAI } = require('openai');
const pool = require('../db');
const TogetherAIService = require('./together-ai-service');

// İsmi sadece ilk isim olarak döndüren yardımcı fonksiyon
function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return fullName;
  return fullName.split(' ')[0];
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const togetherAI = new TogetherAIService();

// AI yanıtını temizleme fonksiyonu
function cleanAIResponse(response) {
  let cleanResponse = response.trim();
  
  // ```json ile başlıyorsa kaldır
  if (cleanResponse.startsWith('```json')) {
    cleanResponse = cleanResponse.replace(/^```json\s*/, '');
  }
  if (cleanResponse.startsWith('```')) {
    cleanResponse = cleanResponse.replace(/^```\s*/, '');
  }
  
  // ``` ile bitiyorsa kaldır
  if (cleanResponse.endsWith('```')) {
    cleanResponse = cleanResponse.replace(/\s*```$/, '');
  }
  
  // Birden fazla satır sonu karakterini tek satır sonuna çevir
  cleanResponse = cleanResponse.replace(/\n\s*\n/g, '\n');
  
  // Başındaki ve sonundaki boşlukları temizle
  cleanResponse = cleanResponse.trim();
  
  return cleanResponse;
}

// Prompt şablonları
const PROMPT_TEMPLATES = {
  GENERAL: `Sen yardımcı bir AI asistanısın. Kullanıcıya nazik, bilgilendirici ve yararlı yanıtlar ver. Türkçe konuş. Kullanıcının adıyla hitap et.`,
  
  CHAT: `Sen bir proje yönetim sistemi asistanısın. Rol: {userRole}. 
  Son mesajlar: {recentMessages}
  Nazik ve yardımcı ol. Türkçe yanıt ver. Sadece selamlarken kullanıcının adını kullan.`,
  
  TASK_MANAGEMENT: `Sen bir proje yönetim sistemi asistanısın. 
  Mevcut görevler: {tasks}
  Kullanıcılar: {users}
  Görev yönetimi konularında uzmanlaşmış yanıtlar ver. Türkçe konuş. Kullanıcının adıyla hitap et.`,
  
  SUMMARY: `Sen bir proje yönetim sistemi asistanısın. 
  Son görevler: {recentTasks}
  Özet ve analiz yap. Türkçe yanıt ver. Kullanıcının adıyla hitap et.`,
  
  ADMIN: `Sen yardımcı bir AI asistanısın. Rol: {userRole}
  Son mesajlar: {recentMessages}
  Proje yönetimi konularında uzmanlaşmış olsan da, genel sohbet konularında da yardımcı olabilirsin.
  Konular: takım yönetimi, performans analizi, proje planlama, çalışan değerlendirme, genel sohbet, güncel konular, teknoloji, bilim, spor, sanat, eğlence
  Detaylı ve stratejik yanıtlar ver. Türkçe konuş. Sadece selamlarken kullanıcının adını kullan.`,
  
  EMPLOYEE: `Sen yardımcı bir AI asistanısın. Rol: {userRole}
  Son mesajlar: {recentMessages}
  Proje yönetimi konularında uzmanlaşmış olsan da, genel sohbet konularında da yardımcı olabilirsin.
  Konular: kişisel gelişim, görev optimizasyonu, zaman yönetimi, beceri geliştirme, genel sohbet, güncel konular, teknoloji, bilim, spor, sanat, eğlence
  Pratik ve motivasyonel yanıtlar ver. Türkçe konuş. Sadece selamlarken kullanıcının adını kullan.`
};

// Gelişmiş bellek sistemi için yapı
class AdvancedMemorySystem {
  constructor() {
    this.userMemories = new Map(); // Kullanıcı bazlı bellek
    this.globalMemory = []; // Genel sistem belleği
    this.learningPatterns = new Map(); // Öğrenme kalıpları
  }

  // Kullanıcı belleği oluştur/getir
  getUserMemory(userId) {
    if (!this.userMemories.has(userId)) {
      this.userMemories.set(userId, {
        conversations: [],
        preferences: {},
        context: {},
        lastInteraction: null,
        interactionCount: 0
      });
    }
    return this.userMemories.get(userId);
  }

  // Kullanıcı mesajını kaydet
  addUserMessage(userId, message, context = {}) {
    const userMemory = this.getUserMemory(userId);
    
    const messageEntry = {
      id: Date.now(),
      content: message,
      timestamp: new Date(),
      context: context,
      type: 'user'
    };

    userMemory.conversations.push(messageEntry);
    userMemory.lastInteraction = new Date();
    userMemory.interactionCount++;

    // Son 50 mesajı tut (performans için)
    if (userMemory.conversations.length > 50) {
      userMemory.conversations = userMemory.conversations.slice(-50);
    }

    // Kullanıcı tercihlerini öğren
    this.learnUserPreferences(userId, message, context);
  }

  // AI yanıtını kaydet
  addAIResponse(userId, response, context = {}) {
    const userMemory = this.getUserMemory(userId);
    
    const responseEntry = {
      id: Date.now(),
      content: response,
      timestamp: new Date(),
      context: context,
      type: 'assistant'
    };

    userMemory.conversations.push(responseEntry);
    userMemory.lastInteraction = new Date();
  }

  // Kullanıcı tercihlerini öğren
  learnUserPreferences(userId, message, context) {
    const userMemory = this.getUserMemory(userId);
    
    // Mesaj içeriğinden tercihleri çıkar
    const lowerMessage = message.toLowerCase();
    
    // Dil tercihi
    if (lowerMessage.includes('türkçe') || lowerMessage.includes('turkish')) {
      userMemory.preferences.language = 'turkish';
    } else if (lowerMessage.includes('english') || lowerMessage.includes('ingilizce')) {
      userMemory.preferences.language = 'english';
    }

    // Detay seviyesi
    if (lowerMessage.includes('detaylı') || lowerMessage.includes('uzun') || lowerMessage.includes('açıkla')) {
      userMemory.preferences.detailLevel = 'detailed';
    } else if (lowerMessage.includes('kısa') || lowerMessage.includes('özet') || lowerMessage.includes('kısaca')) {
      userMemory.preferences.detailLevel = 'brief';
    }

    // Rol bazlı tercihler
    if (context?.user?.role === 'admin') {
      // Yönetici tercihleri
      if (lowerMessage.includes('takım') || lowerMessage.includes('çalışan') || lowerMessage.includes('performans')) {
        if (!userMemory.preferences.interests) {
          userMemory.preferences.interests = [];
        }
        if (!userMemory.preferences.interests.includes('team_management')) {
          userMemory.preferences.interests.push('team_management');
        }
      }
      if (lowerMessage.includes('rapor') || lowerMessage.includes('analiz') || lowerMessage.includes('istatistik')) {
        if (!userMemory.preferences.interests) {
          userMemory.preferences.interests = [];
        }
        if (!userMemory.preferences.interests.includes('analytics')) {
          userMemory.preferences.interests.push('analytics');
        }
      }
    } else {
      // Çalışan tercihleri
      if (lowerMessage.includes('görev') || lowerMessage.includes('task') || lowerMessage.includes('çalışma')) {
        if (!userMemory.preferences.interests) {
          userMemory.preferences.interests = [];
        }
        if (!userMemory.preferences.interests.includes('task_management')) {
          userMemory.preferences.interests.push('task_management');
        }
      }
      if (lowerMessage.includes('gelişim') || lowerMessage.includes('beceri') || lowerMessage.includes('öğrenme')) {
        if (!userMemory.preferences.interests) {
          userMemory.preferences.interests = [];
        }
        if (!userMemory.preferences.interests.includes('personal_development')) {
          userMemory.preferences.interests.push('personal_development');
        }
      }
    }

    // Genel konu tercihleri
    const topics = ['görev', 'proje', 'toplantı', 'teknoloji', 'bilim', 'spor', 'sanat'];
    topics.forEach(topic => {
      if (lowerMessage.includes(topic)) {
        if (!userMemory.preferences.interests) {
          userMemory.preferences.interests = [];
        }
        if (!userMemory.preferences.interests.includes(topic)) {
          userMemory.preferences.interests.push(topic);
        }
      }
    });
  }

  // Kullanıcı için context oluştur
  getUserContext(userId, currentMessage) {
    const userMemory = this.getUserMemory(userId);
    const recentConversations = userMemory.conversations.slice(-10);
    
    let context = {
      userPreferences: userMemory.preferences,
      recentConversations: recentConversations,
      interactionCount: userMemory.interactionCount,
      lastInteraction: userMemory.lastInteraction
    };

    // Benzer geçmiş konuşmaları bul
    const similarConversations = this.findSimilarConversations(userId, currentMessage);
    if (similarConversations.length > 0) {
      context.similarConversations = similarConversations;
    }

    return context;
  }

  // Benzer konuşmaları bul
  findSimilarConversations(userId, currentMessage) {
    const userMemory = this.getUserMemory(userId);
    const keywords = currentMessage.toLowerCase().split(' ').filter(word => word.length > 3);
    
    return userMemory.conversations
      .filter(conv => conv.type === 'user')
      .filter(conv => {
        const convKeywords = conv.content.toLowerCase().split(' ').filter(word => word.length > 3);
        return keywords.some(keyword => convKeywords.some(convKeyword => 
          convKeyword.includes(keyword) || keyword.includes(convKeyword)
        ));
      })
      .slice(-3); // Son 3 benzer konuşma
  }

  // Kullanıcı geçmişini getir
  getUserHistory(userId, limit = 20) {
    const userMemory = this.getUserMemory(userId);
    return userMemory.conversations.slice(-limit);
  }

  // Kullanıcı tercihlerini getir
  getUserPreferences(userId) {
    const userMemory = this.getUserMemory(userId);
    return userMemory.preferences;
  }

  // Belleği temizle (kullanıcı isteği üzerine)
  clearUserMemory(userId) {
    this.userMemories.delete(userId);
  }

  // Tüm belleği getir (debug için)
  getAllMemories() {
    return {
      userMemories: Object.fromEntries(this.userMemories),
      globalMemory: this.globalMemory,
      learningPatterns: Object.fromEntries(this.learningPatterns)
    };
  }
}

// Global gelişmiş bellek sistemi
const advancedMemorySystem = new AdvancedMemorySystem();

// Eski bellek sistemi (geriye uyumluluk için)
class MemorySystem {
  constructor(maxSize = 10) {
    this.maxSize = maxSize;
    this.messages = [];
    this.tasks = [];
    this.lastUpdate = null;
  }

  addMessage(message) {
    this.messages = [message, ...this.messages].slice(0, this.maxSize);
    this.lastUpdate = Date.now();
  }

  addTask(task) {
    this.tasks = [task, ...this.tasks].slice(0, this.maxSize);
    this.lastUpdate = Date.now();
  }

  getRecentMessages() {
    return this.messages;
  }

  getRecentTasks() {
    return this.tasks;
  }

  clear() {
    this.messages = [];
    this.tasks = [];
    this.lastUpdate = null;
  }
}

// Global bellek sistemi (geriye uyumluluk için)
const memorySystem = new MemorySystem();

// Prompt oluşturucu
function createPrompt(template, context) {
  let prompt = template;
  for (const [key, value] of Object.entries(context)) {
    prompt = prompt.replace(`{${key}}`, JSON.stringify(value));
  }
  return prompt;
}

// Proje bağlamını al
async function getProjectContext() {
  try {
    const tasksResult = await pool.query(`
      SELECT t.*, u.name as assigned_to_name, c.name as created_by_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users c ON t.created_by = c.id
      ORDER BY t.created_at DESC
    `);

    const usersResult = await pool.query(`
      SELECT id, name, role, email
      FROM users
      WHERE role != 'admin'
    `);

    return {
      tasks: tasksResult.rows,
      users: usersResult.rows
    };
  } catch (error) {
    console.error('Proje bağlamı alınamadı:', error);
    return { tasks: [], users: [] };
  }
}

// LLM'e soru sor
async function askLLM(prompt, context = null) {
  try {
    const projectContext = context || await getProjectContext();
    const recentMessages = memorySystem.getRecentMessages();
    const recentTasks = memorySystem.getRecentTasks();
    
    // Sohbet geçmişini al
    const conversationHistory = context?.conversation_history || [];
    
    // Gelişmiş bellek sistemi kullan
    let userContext = {};
    if (context?.user?.id) {
      // Kullanıcı mesajını belleğe kaydet
      advancedMemorySystem.addUserMessage(context.user.id, prompt, context);
      
      // Kullanıcı context'ini al
      userContext = advancedMemorySystem.getUserContext(context.user.id, prompt);
    }
    
    // Önerilen soru kontrolü
    if (context?.user?.id && context?.user?.role) {
      const suggestedResponse = await handleSuggestedQuestion(prompt, context.user.id, context.user.role, context.user.name);
      if (suggestedResponse) {
        // Önerilen soru işlendiyse, belleğe kaydet ve yanıtı döndür
        if (context?.user?.id) {
          advancedMemorySystem.addUserMessage(context.user.id, prompt, context);
        }
        memorySystem.addMessage({ role: 'user', content: prompt });
        memorySystem.addMessage({ role: 'assistant', content: suggestedResponse });
        return suggestedResponse;
      }
    }
    
    // Prompt şablonunu seç ve bağlamı ekle
    let systemMessage;
    
    // Proje yönetimi ile ilgili anahtar kelimeler
    const projectKeywords = ['görev', 'task', 'proje', 'çalışan', 'toplantı', 'meeting', 'yönetici', 'admin', 'employee'];
    const isProjectRelated = projectKeywords.some(keyword => prompt.toLowerCase().includes(keyword));
    
    // Rol bazlı prompt seçimi (hem proje hem genel sohbet için)
    if (context?.user?.role === 'admin') {
      if (isProjectRelated && (prompt.includes('görev') || prompt.includes('task'))) {
        systemMessage = createPrompt(PROMPT_TEMPLATES.TASK_MANAGEMENT, {
          tasks: projectContext.tasks,
          users: projectContext.users
        });
      } else if (isProjectRelated && (prompt.includes('özet') || prompt.includes('rapor'))) {
        systemMessage = createPrompt(PROMPT_TEMPLATES.SUMMARY, {
          recentTasks: recentTasks
        });
      } else {
        systemMessage = createPrompt(PROMPT_TEMPLATES.ADMIN, {
          userRole: context?.user?.role || 'admin',
          recentMessages: recentMessages
        });
      }
    } else {
      if (isProjectRelated && (prompt.includes('görev') || prompt.includes('task'))) {
        systemMessage = createPrompt(PROMPT_TEMPLATES.TASK_MANAGEMENT, {
          tasks: projectContext.tasks,
          users: projectContext.users
        });
      } else if (isProjectRelated && (prompt.includes('özet') || prompt.includes('rapor'))) {
        systemMessage = createPrompt(PROMPT_TEMPLATES.SUMMARY, {
          recentTasks: recentTasks
        });
      } else {
        systemMessage = createPrompt(PROMPT_TEMPLATES.EMPLOYEE, {
          userRole: context?.user?.role || 'employee',
          recentMessages: recentMessages
        });
      }
    }

    // Gelişmiş context'i prompt'a ekle
    let fullPrompt = systemMessage + '\n\n';
    
    // Kullanıcı tercihlerini ekle
    if (userContext.userPreferences) {
      fullPrompt += 'Kullanıcı Tercihleri:\n';
      if (userContext.userPreferences.language) {
        fullPrompt += `- Dil: ${userContext.userPreferences.language}\n`;
      }
      if (userContext.userPreferences.detailLevel) {
        fullPrompt += `- Detay Seviyesi: ${userContext.userPreferences.detailLevel}\n`;
      }
      if (userContext.userPreferences.interests && userContext.userPreferences.interests.length > 0) {
        fullPrompt += `- İlgi Alanları: ${userContext.userPreferences.interests.join(', ')}\n`;
      }
      fullPrompt += '\n';
    }
    
    // Sohbet geçmişini ekle
    if (conversationHistory.length > 0) {
      fullPrompt += 'Sohbet Geçmişi:\n';
      conversationHistory.slice(-5).forEach(msg => {
        fullPrompt += `${msg.role === 'user' ? 'Kullanıcı' : 'AI'}: ${msg.content}\n`;
      });
      fullPrompt += '\n';
    }
    
    // Benzer geçmiş konuşmaları ekle
    if (userContext.similarConversations && userContext.similarConversations.length > 0) {
      fullPrompt += 'Benzer Geçmiş Konuşmalar:\n';
      userContext.similarConversations.forEach(conv => {
        fullPrompt += `Kullanıcı: ${conv.content}\n`;
      });
      fullPrompt += '\n';
    }
    
    // Selamlama kontrolü - sadece selamlama mesajlarında kullanıcı adını ekle
    const isGreeting = prompt.toLowerCase().includes('merhaba') || 
                      prompt.toLowerCase().includes('selam') || 
                      prompt.toLowerCase().includes('günaydın') || 
                      prompt.toLowerCase().includes('iyi günler') ||
                      prompt.toLowerCase().includes('nasılsın') ||
                      prompt.toLowerCase().includes('hello') ||
                      prompt.toLowerCase().includes('hi');
    
    if (isGreeting && context?.user?.name) {
      fullPrompt += `\nNot: Bu bir selamlama mesajı. Kullanıcının adı "${context.user.name}". Sadece selamlarken bu adı kullan.\n`;
    }
    
    fullPrompt += `Kullanıcı: ${prompt}\nAI:`;

            const answer = await togetherAI.generateResponse(fullPrompt, systemMessage, { max_tokens: 500, temperature: 0.7 });
    
    // AI yanıtını belleğe kaydet
    if (context?.user?.id) {
      advancedMemorySystem.addAIResponse(context.user.id, answer, context);
    }
    
    // Eski bellek sistemine de ekle (geriye uyumluluk)
    memorySystem.addMessage({
      role: 'assistant',
      content: answer,
      timestamp: Date.now()
    });

    return answer;
  } catch (error) {
    console.error('LLM hatası:', error);
    return 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
  }
}

// Görev oluştur
async function createTask(title, description, assignedTo, createdBy) {
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, description, assigned_to, created_by, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description, assignedTo, createdBy, 'pending']
    );
    
    // Yeni görevi belleğe ekle
    memorySystem.addTask(result.rows[0]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Görev oluşturma hatası:', error);
    throw error;
  }
}

// Görev güncelle
async function updateTask(taskId, updates) {
  try {
    const result = await pool.query(
      'UPDATE tasks SET title = $1, description = $2, status = $3 WHERE id = $4 RETURNING *',
      [updates.title, updates.description, updates.status, taskId]
    );
    
    // Güncellenmiş görevi belleğe ekle
    memorySystem.addTask(result.rows[0]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Görev güncelleme hatası:', error);
    throw error;
  }
}

// Kullanıcıya görev ata
async function assignTaskToUser(taskId, userId) {
  try {
    const result = await pool.query(
      'UPDATE tasks SET assigned_to = $1 WHERE id = $2 RETURNING *',
      [userId, taskId]
    );
    
    // Atanmış görevi belleğe ekle
    memorySystem.addTask(result.rows[0]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Görev atama hatası:', error);
    throw error;
  }
}

// Görev açıklaması önerisi
async function suggestTaskDescription(title) {
  try {
    // Başlığa göre dinamik şablonlar
    const templates = [
      `${title} ile ilgili gerekli adımları uygula ve sonuçları raporla.`,
      `${title} konusunda işlemleri gerçekleştir ve gerekli dokümantasyonu hazırla.`,
      `${title} için gerekli çalışmaları tamamla ve özet rapor hazırla.`,
      `${title} ile ilgili analizleri yap ve sonuçları değerlendir.`,
      `${title} işlemlerini başarıyla sonuçlandır ve raporlama yap.`
    ];
    
    // Rastgele bir şablon seç
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    
    // Eğer Together AI çalışıyorsa dene, yoksa şablon kullan
    try {
      const systemMessage = `Görev başlığına göre kısa ve doğal 2-3 cümlelik açıklama yaz. Başlığı tekrarlama, sadece ne yapılacağını açıkla.`;
      
      const prompt = `Başlık: ${title}
Açıklama:`;
      
      const response = await togetherAI.generateResponse(prompt, systemMessage, {
        max_tokens: 80,
        temperature: 0.5
      });
      
      // Eğer yanıt boşsa veya çok kısaysa şablon kullan
      if (response && response.trim().length > 20) {
        return response.trim();
      } else {
        return randomTemplate;
      }
    } catch (aiError) {
      console.log('AI yanıt alamadı, şablon kullanılıyor');
      return randomTemplate;
    }
  } catch (error) {
    console.error('Error suggesting task description:', error);
    return 'Görev açıklaması oluşturulamadı.';
  }
}

async function listTasks(userId, userRole) {
  try {
    let query = `
      SELECT tasks.*, users.name as assigned_to_name 
      FROM tasks 
      LEFT JOIN users ON tasks.assigned_to = users.id
      WHERE 1=1
    `;
    let params = [];

    // Eğer kullanıcı admin değilse, sadece kendisine atanan görevleri getir
    if (userRole !== 'admin') {
      query += ' AND tasks.assigned_to = $1';
      params.push(userId);
    }

    query += ' ORDER BY tasks.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error listing tasks:', error);
    throw new Error('Görevler listelenemedi');
  }
}

// Çalışan önerisi
async function suggestEmployeeForTask(taskTitle, taskDescription, employees, taskCategory = 'other') {
  try {
    // Gelişmiş çalışan analizi için ek veriler topla
    const enhancedEmployees = await Promise.all(employees.map(async (emp) => {
      // Mevcut aktif görevleri al
      const activeTasksResult = await pool.query(`
        SELECT COUNT(*) as active_count, 
               COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_count,
               AVG(CASE WHEN completed_at IS NOT NULL THEN 
                 EXTRACT(EPOCH FROM (completed_at - created_at))/3600 
               END) as avg_completion_hours
        FROM tasks 
        WHERE assigned_to = $1 AND status NOT IN ('completed', 'Tamamlandı')
      `, [emp.id]);

      // Kategori bazlı performans
      const categoryPerformanceResult = await pool.query(`
        SELECT 
          COUNT(*) as total_in_category,
          COUNT(CASE WHEN status IN ('completed', 'Tamamlandı') THEN 1 END) as completed_in_category
        FROM tasks 
        WHERE assigned_to = $1 AND category = $2
      `, [emp.id, taskCategory]);

      const activeTasks = activeTasksResult.rows[0];
      const categoryPerf = categoryPerformanceResult.rows[0];

      // Performans hesaplamaları
      const completionRate = emp.total_tasks > 0 ? (emp.completed_tasks / emp.total_tasks) * 100 : 0;
      const categorySuccessRate = categoryPerf.total_in_category > 0 ? 
        (categoryPerf.completed_in_category / categoryPerf.total_in_category) * 100 : 0;
      const workloadScore = activeTasks.active_count > 0 ? 
        Math.max(0, 100 - (activeTasks.active_count * 20)) : 100; // Her aktif görev -20 puan

      return {
        ...emp,
        activeTasks: activeTasks.active_count,
        highPriorityTasks: activeTasks.high_priority_count,
        avgCompletionHours: activeTasks.avg_completion_hours || 0,
        completionRate: Math.round(completionRate),
        categorySuccessRate: Math.round(categorySuccessRate),
        workloadScore: Math.round(workloadScore),
        totalInCategory: categoryPerf.total_in_category,
        completedInCategory: categoryPerf.completed_in_category
      };
    }));

    const systemMessage = `En uygun çalışanı seç ve nedenini 2 cümleyle açıkla. Sadece JSON formatında yanıt ver. Format: {"selectedEmployee": {"id": sayı, "name": "isim", "reason": "2 cümlelik açıklama"}}`;

    const employeeTable = enhancedEmployees.map(emp =>
      `${emp.name} (ID: ${emp.id}): ${emp.completionRate}% başarı oranı, ${emp.activeTasks} aktif görev, ${emp.categorySuccessRate}% kategori başarısı, ${emp.workloadScore} iş yükü puanı`
    ).join('\n');

    const prompt = `Görev: ${taskTitle}
Görev Açıklaması: ${taskDescription}
Kategori: ${taskCategory}

Mevcut Çalışanlar:
${employeeTable}

En uygun çalışanı seç ve nedenini 2 cümleyle açıkla. Görev türü, çalışanın deneyimi, mevcut iş yükü ve başarı oranını dikkate al.

JSON formatında döndür:
{"selectedEmployee": {"id": sayı, "name": "isim", "reason": "2 cümlelik detaylı açıklama"}}`;
    const response = await togetherAI.generateResponse(prompt, systemMessage, {
      max_tokens: 200,
      temperature: 0.1
    });
    try {
      const cleanResponse = cleanAIResponse(response);
      console.log('Temizlenmiş yanıt:', cleanResponse);
      
      // JSON parse hatası durumunda fallback
      try {
        return JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error('❌ JSON parse hatası:', parseError);
        console.error('AI yanıtı:', response);
        
        // Basit fallback: En iyi çalışanı öner
        if (enhancedEmployees.length > 0) {
          const bestEmployee = enhancedEmployees.reduce((best, current) => {
            return (current.completionRate > best.completionRate) ? current : best;
          });
          
          return {
            selectedEmployee: {
              id: bestEmployee.id,
              name: bestEmployee.name,
              reason: `${bestEmployee.name} en yüksek başarı oranına (%${bestEmployee.completionRate}) sahip çalışandır. Bu görev için en uygun aday olarak önerilmektedir.`
            }
          };
        }
        
        return null;
      }
    } catch (parseError) {
      console.error('❌ JSON parse hatası:', parseError);
      console.error('AI yanıtı:', response);
      return null;
    }
  } catch (error) {
    console.error('Çalışan önerisi oluşturulurken hata:', error);
    return null;
  }
}

// Görev geçmişini güncelle
async function updateEmployeeTaskHistory(taskId, employeeId, taskTitle, taskDescription, taskCategory) {
  try {
    await pool.query(`
      INSERT INTO employee_task_history 
      (employee_id, task_id, task_title, task_description, task_category)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (employee_id, task_id) DO NOTHING
    `, [employeeId, taskId, taskTitle, taskDescription, taskCategory]);
  } catch (error) {
    console.error('Görev geçmişi güncellenirken hata:', error);
  }
}

// Görev tamamlandığında geçmişi güncelle
async function markTaskAsCompleted(taskId) {
  try {
    console.log('🔧 Görev tamamlanma işlemi başlatılıyor - Task ID:', taskId);
    
    // Önce tasks tablosundaki completed_at alanını güncelle
    const taskUpdateResult = await pool.query(`
      UPDATE tasks 
      SET completed_at = CURRENT_TIMESTAMP,
          status = 'Tamamlandı',
          completed = true
      WHERE id = $1
      RETURNING id, title, completed_at, completed, status
    `, [taskId]);
    
    if (taskUpdateResult.rows.length > 0) {
      console.log('✅ Tasks tablosu güncellendi:', taskUpdateResult.rows[0]);
    } else {
      console.log('⚠️ Görev bulunamadı veya güncellenemedi');
    }
    
    // Sonra employee_task_history tablosunu güncelle
    const historyUpdateResult = await pool.query(`
      UPDATE employee_task_history 
      SET completed_at = CURRENT_TIMESTAMP
      WHERE task_id = $1
    `, [taskId]);
    
    console.log('✅ Employee task history güncellendi');
    
    return {
      success: true,
      task: taskUpdateResult.rows[0],
      message: 'Görev başarıyla tamamlandı olarak işaretlendi.'
    };
    
  } catch (error) {
    console.error('❌ Görev tamamlanma durumu güncellenirken hata:', error);
    return {
      success: false,
      message: 'Görev tamamlanma durumu güncellenirken hata oluştu.'
    };
  }
}

// Akıllı görev önerileri
async function getSmartTaskSuggestions(userId, userRole) {
  try {
    const context = await getProjectContext();
    const userTasks = context.tasks.filter(task => task.assigned_to === userId);
    const completedTasks = userTasks.filter(task => task.status === 'completed');
    
    let systemMessage;
    let prompt;
    
    if (userRole === 'admin') {
      systemMessage = `Sen bir proje yöneticisisin. Yönetici perspektifinden akıllı öneriler ver.
      
      Kullanıcı Bilgileri:
      - Rol: ${userRole}
      - Toplam Görev: ${userTasks.length}
      - Tamamlanan Görev: ${completedTasks.length}
      
      Son tamamlanan görevler: ${JSON.stringify(completedTasks.slice(0, 3))}
      
      Yönetici için 3 adet akıllı öneri ver. Her öneri için:
      - title: "Başlık (kısa ve net)"
      - description: "Açıklama (detaylı)"
      - priority: "yüksek/orta/düşük"
      - estimatedHours: sayı
      
      Yönetici odaklı konular: takım yönetimi, performans analizi, proje planlama, çalışan değerlendirme
      
      Sadece JSON formatında yanıt ver, başka metin ekleme. JSON'da tırnak işaretlerini düzgün kapat.`;
      
      prompt = `Yönetici için akıllı öneriler oluştur.`;
    } else {
      systemMessage = `Sen bir proje yöneticisisin. Çalışan perspektifinden akıllı öneriler ver.
      
      Kullanıcı Bilgileri:
      - Rol: ${userRole}
      - Toplam Görev: ${userTasks.length}
      - Tamamlanan Görev: ${completedTasks.length}
      
      Son tamamlanan görevler: ${JSON.stringify(completedTasks.slice(0, 3))}
      
      Çalışan için 3 adet akıllı öneri ver. Her öneri için:
      - title: "Başlık (kısa ve net)"
      - description: "Açıklama (detaylı)"
      - priority: "yüksek/orta/düşük"
      - estimatedHours: sayı
      
      Çalışan odaklı konular: kişisel gelişim, görev optimizasyonu, zaman yönetimi, beceri geliştirme
      
      Sadece JSON formatında yanıt ver, başka metin ekleme. JSON'da tırnak işaretlerini düzgün kapat.`;
      
      prompt = `Çalışan için akıllı öneriler oluştur.`;
    }
    
    const response = await togetherAI.generateResponse(prompt, systemMessage, {
      max_tokens: 500,
      temperature: 0.3
    });
    
    try {
      const cleanResponse = cleanAIResponse(response);
      console.log('Temizlenmiş yanıt:', cleanResponse);
      
      return JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('JSON parse hatası:', parseError);
      console.error('Ham yanıt:', response);
      return {
        suggestions: [
          {
            title: userRole === 'admin' ? 'Takım performans raporu hazırla' : 'Günlük rapor hazırla',
            description: userRole === 'admin' ? 'Takımın genel performansını analiz eden rapor hazırla' : 'Bugünkü çalışmaları özetleyen rapor hazırla',
            priority: 'orta',
            estimatedHours: 1
          }
        ]
      };
    }
  } catch (error) {
    console.error('Akıllı öneri hatası:', error);
    return { suggestions: [] };
  }
}

// Otomatik görev oluşturma
async function createTaskFromNaturalLanguage(naturalText, userId, userRole) {
  try {
    const systemMessage = `Sen bir görev yönetim sistemi asistanısın. Doğal dildeki metni görev formatına çevir.
    
    Çıktı formatı:
    {
      "title": "Görev başlığı",
      "description": "Detaylı açıklama",
      "priority": "yüksek/orta/düşük",
      "estimatedHours": sayı,
      "category": "kategori"
    }
    
    Sadece JSON döndür, başka metin ekleme.`;
    
    const prompt = `Bu metni görev formatına çevir: ${naturalText}`;
    
    const response = await togetherAI.generateResponse(prompt, systemMessage, {
      max_tokens: 300,
      temperature: 0.2
    });
    
    try {
      const cleanResponse = cleanAIResponse(response);
      console.log('Temizlenmiş yanıt:', cleanResponse);
      
      const taskData = JSON.parse(cleanResponse);
      
      // Görevi veritabanına kaydet
      const result = await pool.query(
        'INSERT INTO tasks (title, description, assigned_to, created_by, status, priority) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [taskData.title, taskData.description, userId, userId, 'pending', taskData.priority]
      );
      
      memorySystem.addTask(result.rows[0]);
      
      return {
        success: true,
        task: result.rows[0],
        message: `"${taskData.title}" görevi başarıyla oluşturuldu.`
      };
    } catch (parseError) {
      console.error('Görev oluşturma parse hatası:', parseError);
      console.error('Ham yanıt:', response);
      return {
        success: false,
        message: 'Görev oluşturulamadı. Lütfen daha net bir açıklama verin.'
      };
    }
  } catch (error) {
    console.error('Doğal dil görev oluşturma hatası:', error);
    return {
      success: false,
      message: 'Bir hata oluştu. Lütfen tekrar deneyin.'
    };
  }
}

// Görev analizi ve öneriler
async function analyzeTaskPerformance(userId) {
  try {
    console.log('🔍 Görev analizi başlatılıyor - Kullanıcı ID:', userId);
    
    const { rows: tasks } = await pool.query(`
      SELECT * FROM tasks 
      WHERE assigned_to = $1 
      ORDER BY created_at DESC
    `, [userId]);
    
    console.log('📋 Bulunan görev sayısı:', tasks.length);
    console.log('📋 Görevler:', tasks.map(t => ({ id: t.id, title: t.title, status: t.status })));
    
    // Status değerlerini kontrol et
    const statusCounts = {};
    tasks.forEach(task => {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    });
    console.log('📊 Status dağılımı:', statusCounts);
    
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const otherTasks = tasks.filter(t => !['Tamamlandı', 'completed', 'Beklemede', 'pending', 'Yapılacaklar', 'Devam Ediyor', 'in_progress', 'Yapılıyor'].includes(t.status)).length;
    
    console.log('✅ Tamamlanan görevler:', completedTasks.length);
    console.log('⏳ Bekleyen görevler:', pendingTasks.length);
    console.log('🔄 Devam eden görevler:', inProgressTasks.length);
    console.log('🔄 Diğer görevler:', otherTasks);
    
    const systemMessage = `Sen bir performans analisti. Kullanıcının görev verilerini analiz et ve öneriler ver.
    
    Veriler:
    - Toplam görev: ${tasks.length}
    - Tamamlanan: ${completedTasks.length}
    - Bekleyen: ${pendingTasks.length}
    - Devam eden: ${inProgressTasks.length}
    - Diğer: ${otherTasks}
    
    Analiz ve öneriler ver.`;
    
    const prompt = `Bu verileri analiz et ve performans önerileri ver.`;
    
    console.log('🤖 LLM\'e gönderilen prompt:', prompt);
    
    const analysis = await togetherAI.generateResponse(prompt, systemMessage, {
      max_tokens: 400,
      temperature: 0.3
    });
    
    console.log('🤖 LLM yanıtı:', analysis);
    
    const result = {
      stats: {
        total: tasks.length,
        completed: completedTasks.length,
        pending: pendingTasks.length,
        inProgress: inProgressTasks.length,
        other: otherTasks,
        completionRate: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0
      },
      analysis: analysis
    };
    
    console.log('📊 Analiz sonucu:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Performans analizi hatası:', error);
    return null;
  }
}

// Önerilen sorular için özel işleyiciler
async function handleSuggestedQuestion(question, userId, userRole, userName = null) {
  const lowerQuestion = question.toLowerCase();
  
  try {
    // Eğer userName verilmemişse, veritabanından al
    let displayName = userName;
    if (!displayName || displayName.trim() === '') {
      try {
        const { rows } = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        if (rows.length > 0) {
          displayName = rows[0].name;
        }
      } catch (error) {
        console.error('Kullanıcı adı alınamadı:', error);
      }
    }
    // Admin soruları
    if (userRole === 'admin') {
      if (lowerQuestion.includes('bugünkü görev durumunu özetle')) {
        return await getTodayTaskSummary();
      }
      if (lowerQuestion.includes('en çok görev alan çalışan')) {
        return await getMostTaskedEmployee();
      }
      if (lowerQuestion.includes('bu hafta tamamlanan projeleri')) {
        return await getWeeklyCompletedProjects();
      }
      if (lowerQuestion.includes('performans analizi')) {
        return await getTeamPerformanceAnalysis();
      }
      if (lowerQuestion.includes('çalışan verimliliğini analiz')) {
        return await getEmployeeEfficiencyAnalysis();
      }
      if (lowerQuestion.includes('proje ilerleme raporu')) {
        return await getProjectProgressReport();
      }
      if (lowerQuestion.includes('toplantı planlaması')) {
        return await getMeetingPlanningSuggestions();
      }
      if (lowerQuestion.includes('takım motivasyonu')) {
        return await getTeamMotivationAnalysis();
      }
      if (lowerQuestion.includes('bütçe durumu')) {
        return await getBudgetStatus();
      }
    }
    
    // Çalışan soruları
    if (userRole === 'employee') {
      if (lowerQuestion.includes('bugünkü görevlerimi göster')) {
        return await getUserTodayTasks(userId, userName);
      }
      if (lowerQuestion.includes('yarın için plan önerisi')) {
        return await getTomorrowPlanSuggestion(userId);
      }
      if (lowerQuestion.includes('görev önceliklerini düzenle')) {
        return await getTaskPrioritySuggestions(userId);
      }
      if (lowerQuestion.includes('çalışma performansımı analiz')) {
        return await getUserPerformanceAnalysis(userId);
      }
      if (lowerQuestion.includes('yeni beceri önerileri')) {
        return await getSkillRecommendations(userId);
      }
      if (lowerQuestion.includes('görev tamamlama sürelerimi hesapla')) {
        return await getTaskCompletionTimes(userId);
      }
      if (lowerQuestion.includes('iş yükü dengeleme önerisi')) {
        return await getWorkloadBalanceSuggestions(userId);
      }
      if (lowerQuestion.includes('kariyer gelişim tavsiyesi')) {
        return await getCareerDevelopmentAdvice(userId);
      }
      if (lowerQuestion.includes('stres yönetimi önerileri')) {
        return await getStressManagementTips();
      }
      if (lowerQuestion.includes('zaman yönetimi ipuçları')) {
        return await getTimeManagementTips();
      }
    }
    
    // Genel sorular
    if (lowerQuestion.includes('merhaba') || lowerQuestion.includes('nasılsın')) {
      return getGreetingResponse(userRole, displayName);
    }
    if (lowerQuestion.includes('hava durumu')) {
      return getWeatherInfo();
    }
    if (lowerQuestion.includes('günün tarihi')) {
      return getCurrentDate();
    }
    if (lowerQuestion.includes('matematik hesaplaması')) {
      return getMathCalculationHelp();
    }
    if (lowerQuestion.includes('kod örneği')) {
      return getCodeExample();
    }
    if (lowerQuestion.includes('teknoloji haberleri')) {
      return getTechNews();
    }
    if (lowerQuestion.includes('kitap önerisi')) {
      return getBookRecommendations();
    }
    if (lowerQuestion.includes('spor sonuçları')) {
      return getSportsResults();
    }
    if (lowerQuestion.includes('şarkı önerisi')) {
      return getMusicRecommendations();
    }
    if (lowerQuestion.includes('film tavsiyesi')) {
      return getMovieRecommendations();
    }
    
    // Eğer özel işleyici bulunamazsa, genel LLM'e yönlendir
    return null;
    
  } catch (error) {
    console.error('Önerilen soru işleme hatası:', error);
    return null;
  }
}

// Admin soruları için özel fonksiyonlar
async function getTodayTaskSummary() {
  try {
    // Tüm aktif görevleri getir (tamamlanan, devam eden, bekleyen, yapılacaklar)
    const { rows: tasks } = await pool.query(`
      SELECT 
        t.*,
        u.name as assigned_user_name,
        u.role as user_role
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE (
        -- Bugün tamamlanan görevler
        (t.status = 'Tamamlandı' OR t.status = 'completed') AND DATE(t.completed_at) = CURRENT_DATE
      ) OR (
        -- Tüm aktif görevler (devam eden, bekleyen, yapılacaklar, yapılıyor)
        t.status IN ('Devam Ediyor', 'in_progress', 'Beklemede', 'pending', 'Yapılacaklar', 'Yapılıyor')
      ) OR (
        -- Status null olmayan tüm görevler (güvenlik için)
        t.status IS NOT NULL AND t.status NOT IN ('cancelled', 'rejected')
      )
      ORDER BY t.created_at DESC
    `);
    
    const completed = tasks.filter(t => t.status === 'Tamamlandı' || t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'Beklemede' || t.status === 'pending' || t.status === 'Yapılacaklar').length;
    const inProgress = tasks.filter(t => t.status === 'Devam Ediyor' || t.status === 'in_progress' || t.status === 'Yapılıyor').length;
    const other = tasks.filter(t => !['Tamamlandı', 'completed', 'Beklemede', 'pending', 'Yapılacaklar', 'Devam Ediyor', 'in_progress', 'Yapılıyor'].includes(t.status)).length;
    
    // Çalışan dağılımını hesapla
    const userDistribution = {};
    tasks.forEach(task => {
      const user = task.assigned_user_name || 'Atanmamış';
      userDistribution[user] = (userDistribution[user] || 0) + 1;
    });
    
    const userDistributionText = Object.entries(userDistribution)
      .map(([user, count]) => `• ${user}: ${count} görev`)
      .join('\n');
    
    const summary = `📊 **Bugünkü Görev Durumu Özeti**
    
    📅 Tarih: ${new Date().toLocaleDateString('tr-TR')}
    
    📋 **Genel Durum:**
    • Toplam Görev: ${tasks.length}
    • Tamamlanan: ${completed} ✅
    • Devam Eden: ${inProgress} 🔄
    • Bekleyen: ${pending} ⏳
    • Diğer: ${other} 🔄
    
    📈 **Tamamlanma Oranı:** ${tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0}%
    
    👥 **Çalışan Dağılımı:**
    ${userDistributionText}
    
    🎯 **Öneriler:**
    ${inProgress > 0 ? '• Devam eden görevlerin tamamlanmasına odaklanın' : ''}
    ${pending > completed ? '• Bekleyen görevlerin önceliklerini gözden geçirin' : ''}
    ${completed === 0 ? '• Bugün henüz tamamlanan görev yok, motivasyonu artırın' : ''}`;
    
    return summary;
  } catch (error) {
    console.error('Günlük görev özeti hatası:', error);
    return 'Günlük görev özeti alınamadı.';
  }
}

async function getMostTaskedEmployee() {
  try {
    const { rows: employees } = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.role,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' OR t.status = 'Tamamlandı' THEN 1 END) as completed_tasks,
        AVG(CASE WHEN t.completed_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/3600 
        END) as avg_completion_hours
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assigned_to
      WHERE LOWER(u.role) NOT IN ('admin', 'manager')
      GROUP BY u.id, u.name, u.role
      ORDER BY completed_tasks DESC
      LIMIT 5
    `);
    
    if (employees.length === 0) {
      return 'Henüz görev atanmış çalışan bulunmuyor.';
    }
    
    const topEmployee = employees[0];
    const analysis = `👑 **En Çok Görev Alan Çalışanlar**
    
    🥇 **1. ${topEmployee.name}** (${topEmployee.role})
    • Toplam Görev: ${topEmployee.total_tasks}
    • Tamamlanan: ${topEmployee.completed_tasks} ✅
    • Devam Eden: ${topEmployee.avg_completion_hours ? Math.round(topEmployee.avg_completion_hours) : 'N/A'} saat
    • Tamamlanma Oranı: ${topEmployee.total_tasks > 0 ? Math.round((topEmployee.completed_tasks / topEmployee.total_tasks) * 100) : 0}%
    
    📊 **İlk 5 Çalışan:**
    ${employees.map((emp, index) => 
      `${index + 1}. ${getFirstName(emp.name)} - ${emp.total_tasks} görev (${emp.completed_tasks} tamamlandı)`
    ).join('\n')}
    
    💡 **Öneriler:**
    • ${topEmployee.name} en yoğun çalışan, iş yükünü dengelemeyi düşünün
    • Düşük görev alan çalışanlara daha fazla sorumluluk verin
    • Tamamlanma oranı düşük olanlara destek sağlayın`;
    
    return analysis;
  } catch (error) {
    console.error('En çok görev alan çalışan analizi hatası:', error);
    return 'Çalışan analizi alınamadı.';
  }
}

async function getWeeklyCompletedProjects() {
  try {
    const { rows: tasks } = await pool.query(`
      SELECT 
        t.*,
        u.name as assigned_user_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE (t.status = 'completed' OR t.status = 'Tamamlandı')
      AND t.completed_at >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY t.completed_at DESC
    `);
    
    // Proje gruplarını hesapla
    const projectGroups = {};
    tasks.forEach(task => {
      const project = task.category || 'Genel';
      if (!projectGroups[project]) projectGroups[project] = [];
      projectGroups[project].push(task);
    });
    
    // En aktif çalışanları hesapla
    const userActivity = {};
    tasks.forEach(task => {
      const user = task.assigned_user_name || 'Bilinmeyen';
      userActivity[user] = (userActivity[user] || 0) + 1;
    });
    
    const topUsers = Object.entries(userActivity)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([user, count]) => `• ${user}: ${count} görev tamamladı`)
      .join('\n');
    
    const projectSummary = Object.entries(projectGroups)
      .map(([project, projectTasks]) => `**${project}:** ${projectTasks.length} görev tamamlandı`)
      .join('\n');
    
    const summary = `📅 **Bu Hafta Tamamlanan Projeler**
    
    🗓️ Tarih Aralığı: ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')} - ${new Date().toLocaleDateString('tr-TR')}
    
    📊 **Genel İstatistikler:**
    • Toplam Tamamlanan Görev: ${tasks.length}
    • Proje Sayısı: ${Object.keys(projectGroups).length}
    
    📋 **Proje Bazlı Tamamlananlar:**
    ${projectSummary}
    
    👥 **En Aktif Çalışanlar:**
    ${topUsers}
    
    🎉 **Başarılar:**
    • Haftalık hedefler ${tasks.length > 10 ? 'aşıldı' : 'karşılandı'}
    • Takım performansı ${tasks.length > 15 ? 'mükemmel' : 'iyi'} seviyede`;
    
    return summary;
  } catch (error) {
    console.error('Haftalık proje özeti hatası:', error);
    return 'Haftalık proje özeti alınamadı.';
  }
}

async function getTeamPerformanceAnalysis() {
  try {
    const { rows: performance } = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.role,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' OR t.status = 'Tamamlandı' THEN 1 END) as completed_tasks,
        AVG(CASE WHEN t.completed_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/3600 
        END) as avg_completion_hours
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assigned_to
      WHERE LOWER(u.role) NOT IN ('admin', 'manager')
      GROUP BY u.id, u.name, u.role
      ORDER BY completed_tasks DESC
    `);
    

    

    
    const totalTasks = performance.reduce((sum, p) => sum + Number(p.total_tasks), 0);
    const totalCompleted = performance.reduce((sum, p) => sum + Number(p.completed_tasks), 0);
    const avgCompletionRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;
    
    const analysis = `📈 **Takım Performans Analizi**
    
    📊 **Genel Takım Metrikleri:**
    • Toplam Görev: ${totalTasks}
    • Tamamlanan: ${totalCompleted}
    • Genel Tamamlanma Oranı: ${Math.round(avgCompletionRate)}%
    
    🏆 **En Performanslı Çalışanlar:**
    ${performance.slice(0, 3).map((p, index) => 
      `${index + 1}. ${getFirstName(p.name)} (${p.role})
       • Tamamlanan: ${p.completed_tasks}/${p.total_tasks} (${p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0}%)
       • Ortalama Tamamlama Süresi: ${p.avg_completion_hours ? (p.avg_completion_hours < 1 ? Math.round(p.avg_completion_hours * 60) + ' dakika' : Math.round(p.avg_completion_hours) + ' saat') : 'N/A'}`
    ).join('\n\n')}
    
    📋 **Detaylı Performans:**
    ${performance.map(p => 
      `• ${getFirstName(p.name)}: ${p.completed_tasks}/${p.total_tasks} görev (${p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0}%)`
    ).join('\n')}
    
    💡 **Öneriler:**
    ${avgCompletionRate < 70 ? '• Takım motivasyonunu artırın' : '• Mükemmel performans, devam edin!'}
    ${performance.some(p => p.total_tasks > 0 && (p.completed_tasks / p.total_tasks) < 0.5) ? '• Düşük performanslı çalışanlara destek sağlayın' : ''}`;
    
    return analysis;
  } catch (error) {
    console.error('Takım performans analizi hatası:', error);
    return 'Takım performans analizi alınamadı.';
  }
}

// Çalışan soruları için özel fonksiyonlar
async function getUserTodayTasks(userId, userName = null) {
  try {
    // Eğer userName verilmemişse, veritabanından al
    let displayName = userName;
    if (!displayName || displayName.trim() === '') {
      try {
        const { rows } = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        if (rows.length > 0) {
          displayName = rows[0].name;
        }
      } catch (error) {
        console.error('Kullanıcı adı alınamadı:', error);
      }
    }
    const { rows: tasks } = await pool.query(`
      SELECT * FROM tasks 
      WHERE assigned_to = $1 
      AND (
        -- Bugün tamamlanan görevler
        (status = 'Tamamlandı' OR status = 'completed') AND DATE(completed_at) = CURRENT_DATE
      ) OR (
        -- Aktif görevler (devam eden, bekleyen, yapılacaklar)
        status IN ('Devam Ediyor', 'in_progress', 'Beklemede', 'pending', 'Yapılacaklar')
      )
      ORDER BY priority DESC, created_at ASC
    `, [userId]);
    
    if (tasks.length === 0) {
      const userDisplayName = displayName || 'Kullanıcı';
      return `📅 **${userDisplayName}, Bugünkü Görevleriniz**
      
      🎉 Bugün size atanmış görev bulunmuyor!
      
      💡 **Öneriler:**
      • Yeni görev talep edebilirsiniz
      • Geçmiş görevlerinizi gözden geçirebilirsiniz
      • Beceri geliştirme aktivitelerine odaklanabilirsiniz`;
    }
    
    const completed = tasks.filter(t => t.status === 'Tamamlandı' || t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'Beklemede' || t.status === 'pending' || t.status === 'Yapılacaklar').length;
    const inProgress = tasks.filter(t => t.status === 'Devam Ediyor' || t.status === 'in_progress').length;
    
    const userDisplayName = displayName || 'Kullanıcı';
    const summary = `📅 **${userDisplayName}, Bugünkü Görevleriniz**
    
    📊 **Genel Durum:**
    • Toplam Görev: ${tasks.length}
    • Tamamlanan: ${completed} ✅
    • Devam Eden: ${inProgress} 🔄
    • Bekleyen: ${pending} ⏳
    
    📋 **Görev Listesi:**
    ${tasks.map((task, index) => {
      const statusIcon = (task.status === 'Tamamlandı' || task.status === 'completed') ? '✅' : 
                        (task.status === 'Devam Ediyor' || task.status === 'in_progress') ? '🔄' : '⏳';
      const priorityIcon = task.priority === 'high' ? '🔴' : 
                          task.priority === 'medium' ? '🟡' : '🟢';
      return `${index + 1}. ${statusIcon} ${priorityIcon} **${task.title}**
         📝 ${task.description || 'Açıklama yok'}
         ⏰ Tahmini Süre: ${task.estimated_hours || 1} saat
         🏷️ Kategori: ${task.category || 'Genel'}`;
    }).join('\n\n')}
    
    🎯 **Öncelik Sırası:**
    ${tasks.filter(t => t.status !== 'Tamamlandı' && t.status !== 'completed').map((task, index) => 
      `${index + 1}. ${task.title} (${task.priority} öncelik)`
    ).join('\n')}
    
    💪 **Motivasyon:** Bugün ${tasks.length} görev var, hepsini başarıyla tamamlayabilirsiniz!`;
    
    return summary;
  } catch (error) {
    console.error('Kullanıcı günlük görevleri hatası:', error);
    return 'Günlük görevleriniz alınamadı.';
  }
}

async function getTomorrowPlanSuggestion(userId) {
  try {
    const { rows: tasks } = await pool.query(`
      SELECT * FROM tasks 
      WHERE assigned_to = $1 
      AND status IN ('pending', 'in_progress')
      ORDER BY priority DESC, created_at ASC
    `, [userId]);
    
    const highPriority = tasks.filter(t => t.priority === 'yüksek');
    const mediumPriority = tasks.filter(t => t.priority === 'orta');
    const lowPriority = tasks.filter(t => t.priority === 'düşük');
    
    const plan = `📅 **Yarın İçin Plan Önerisi**
    
    🎯 **Öncelik Sırası:**
    
    🔴 **Yüksek Öncelik (${highPriority.length} görev):**
    ${highPriority.map((task, index) => 
      `${index + 1}. ${task.title} - ${task.estimated_hours || 1} saat`
    ).join('\n')}
    
    🟡 **Orta Öncelik (${mediumPriority.length} görev):**
    ${mediumPriority.map((task, index) => 
      `${index + 1}. ${task.title} - ${task.estimated_hours || 1} saat`
    ).join('\n')}
    
    🟢 **Düşük Öncelik (${lowPriority.length} görev):**
    ${lowPriority.map((task, index) => 
      `${index + 1}. ${task.title} - ${task.estimated_hours || 1} saat`
    ).join('\n')}
    
    ⏰ **Tahmini Toplam Süre:** ${tasks.reduce((sum, task) => sum + (task.estimated_hours || 1), 0)} saat
    
    💡 **Planlama İpuçları:**
    • Sabah en zor görevlerle başlayın
    • 2-3 saatlik bloklar halinde çalışın
    • Mola zamanlarını planlayın
    • Esnek zaman bırakın (acil durumlar için)
    
    🎯 **Hedef:** Yarın ${highPriority.length} yüksek öncelikli görevi tamamlamayı hedefleyin!`;
    
    return plan;
  } catch (error) {
    console.error('Yarın plan önerisi hatası:', error);
    return 'Yarın plan önerisi alınamadı.';
  }
}

async function getUserPerformanceAnalysis(userId) {
  try {
    const { rows: tasks } = await pool.query(`
      SELECT * FROM tasks 
      WHERE assigned_to = $1 
      ORDER BY created_at DESC
    `, [userId]);
    
    const completed = tasks.filter(t => t.status === 'completed' || t.status === 'Tamamlandı');
    const pending = tasks.filter(t => t.status === 'pending' || t.status === 'Beklemede' || t.status === 'Yapılacaklar');
    const inProgress = tasks.filter(t => t.status === 'in_progress' || t.status === 'Devam Ediyor' || t.status === 'Yapılıyor');
    
    const completionRate = tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0;
    const avgCompletionTime = completed.length > 0 ? 
      completed.reduce((sum, task) => {
        if (task.completed_at && task.created_at) {
          const hours = (new Date(task.completed_at) - new Date(task.created_at)) / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0) / completed.length : 0;
    
    // Kategori bazlı performans hesapla
    const categoryStats = {};
    tasks.forEach(task => {
      const category = task.category || 'Genel';
      if (!categoryStats[category]) {
        categoryStats[category] = { total: 0, completed: 0 };
      }
      categoryStats[category].total++;
      if (task.status === 'completed' || task.status === 'Tamamlandı') categoryStats[category].completed++;
    });
    
    const categoryPerformance = Object.entries(categoryStats)
      .map(([category, stats]) => 
        `• ${category}: ${stats.completed}/${stats.total} (${Math.round((stats.completed / stats.total) * 100)}%)`
      )
      .join('\n');
    
    const analysis = `📊 **Kişisel Performans Analiziniz**
    
    📈 **Genel İstatistikler:**
    • Toplam Görev: ${tasks.length}
    • Tamamlanan: ${completed.length} ✅
    • Devam Eden: ${inProgress.length} 🔄
    • Bekleyen: ${pending.length} ⏳
    • Tamamlanma Oranı: ${Math.round(completionRate)}%
    • Ortalama Tamamlama Süresi: ${Math.round(avgCompletionTime)} saat
    
    🏆 **Güçlü Yönleriniz:**
    ${completionRate > 80 ? '• Yüksek tamamlanma oranı - mükemmel!' : ''}
    ${avgCompletionTime < 24 ? '• Hızlı görev tamamlama - etkili çalışıyorsunuz!' : ''}
    ${inProgress.length < 3 ? '• Odaklanmış çalışma - çok görevli çalışmıyorsunuz!' : ''}
    
    📋 **Kategori Bazlı Performans:**
    ${categoryPerformance}
    
    💡 **Gelişim Önerileri:**
    ${completionRate < 70 ? '• Görev önceliklerini gözden geçirin' : ''}
    ${avgCompletionTime > 48 ? '• Zaman yönetimi tekniklerini öğrenin' : ''}
    ${pending.length > 5 ? '• Bekleyen görevleri azaltın' : ''}
    
    🎯 **Hedef:** Tamamlanma oranınızı %${Math.min(100, Math.round(completionRate) + 10)}'a çıkarın!`;
    
    return analysis;
  } catch (error) {
    console.error('Kullanıcı performans analizi hatası:', error);
    return 'Performans analiziniz alınamadı.';
  }
}

// Genel sorular için fonksiyonlar
function getGreetingResponse(userRole, userName = null) {
  const userDisplayName = userName && userName.trim() !== '' ? userName : (userRole === 'admin' ? 'Yönetici' : 'Kullanıcı');
  
  const greetings = {
    admin: `👋 Merhaba ${userDisplayName}! 
    
    Bugün size nasıl yardımcı olabilirim? 
    
    📊 **Hızlı Erişim:**
    • Takım performansını analiz etmek için "Performans analizi yap"
    • Günlük görev durumunu görmek için "Bugünkü görev durumunu özetle"
    • Çalışan verimliliğini kontrol etmek için "Çalışan verimliliğini analiz et"
    
    🎯 **Önerilen İşlemler:**
    • Proje ilerleme raporu hazırla
    • Toplantı planlaması yap
    • Takım motivasyonu kontrol et`,
    
    employee: `👋 Merhaba ${userDisplayName}! 
    
    Bugün size nasıl yardımcı olabilirim? 
    
    📋 **Hızlı Erişim:**
    • Bugünkü görevlerinizi görmek için "Bugünkü görevlerimi göster"
    • Yarın planı için "Yarın için plan önerisi ver"
    • Performansınızı analiz etmek için "Çalışma performansımı analiz et"
    
    🎯 **Önerilen İşlemler:**
    • Görev önceliklerini düzenle
    • Yeni beceri önerileri al
    • Zaman yönetimi ipuçları öğren`,
    
    default: `👋 Merhaba ${userDisplayName}! 
    
    Ben proje yönetim sisteminizin AI asistanıyım. Size nasıl yardımcı olabilirim?
    
    💡 **Yapabileceklerim:**
    • Görev yönetimi ve analizi
    • Performans değerlendirmesi
    • Planlama ve öneriler
    • Genel sorularınızı yanıtlama`
  };
  
  return greetings[userRole] || greetings.default;
}

function getCurrentDate() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return `📅 **Günün Tarihi ve Saati**
  
  🗓️ ${now.toLocaleDateString('tr-TR', options)}
  
  ⏰ Saat: ${now.toLocaleTimeString('tr-TR')}
  
  📊 **Hafta Bilgisi:**
  • Haftanın ${now.getDay() === 0 ? 7 : now.getDay()}. günü
  • ${now.getMonth() + 1}. ayın ${now.getDate()}. günü
  • ${now.getFullYear()} yılı
  
  🎯 **Bugünün Önemi:**
  ${now.getDay() === 1 ? '• Haftanın başlangıcı - yeni hedefler için mükemmel zaman!' : ''}
  ${now.getDay() === 5 ? '• Hafta sonu yaklaşıyor - haftalık hedefleri gözden geçirin!' : ''}
  ${now.getHours() < 12 ? '• Günün başlangıcı - enerjinizi koruyun!' : ''}
  ${now.getHours() >= 17 ? '• Günün sonu yaklaşıyor - yarın için plan yapın!' : ''}`;
}

function getMathCalculationHelp() {
  return `🧮 **Matematik Hesaplama Yardımı**
  
  Size matematik hesaplamalarında yardımcı olabilirim!
  
  📝 **Desteklenen İşlemler:**
  • Toplama, çıkarma, çarpma, bölme
  • Yüzde hesaplamaları
  • Karekök, üs alma
  • Geometrik formüller
  • İstatistiksel hesaplamalar
  
  💡 **Örnek Kullanımlar:**
  • "25 + 17 hesapla"
  • "100'ün %15'i kaç?"
  • "Dairenin alanını hesapla (r=5)"
  • "Ortalama hesapla: 85, 92, 78, 96"
  
  🎯 **Nasıl Kullanılır:**
  Hesaplama yapmak istediğiniz işlemi yazın, ben size sonucu vereyim!`;
}

function getCodeExample() {
  return `💻 **Kod Örneği Yardımı**
  
  Size çeşitli programlama dillerinde kod örnekleri verebilirim!
  
  🚀 **Desteklenen Diller:**
  • JavaScript/TypeScript
  • Python
  • Java
  • C#
  • SQL
  • HTML/CSS
  • React/Next.js
  
  📝 **Örnek İstekler:**
  • "React component örneği ver"
  • "Python ile dosya okuma kodu"
  • "SQL sorgu örnekleri"
  • "JavaScript async/await kullanımı"
  • "CSS Grid layout örneği"
  
  🎯 **Nasıl Kullanılır:**
  Hangi dilde ve ne tür bir kod örneği istediğinizi belirtin!`;
}

function getTechNews() {
  return `📱 **Teknoloji Haberleri**
  
  Güncel teknoloji haberlerini paylaşabilirim!
  
  🔥 **Popüler Konular:**
  • Yapay Zeka ve Makine Öğrenmesi
  • Web Geliştirme Trendleri
  • Mobil Uygulama Teknolojileri
  • Bulut Bilişim
  • Siber Güvenlik
  • Blockchain ve Kripto
  • IoT (Nesnelerin İnterneti)
  
  📰 **Haber Kategorileri:**
  • Yeni teknolojiler
  • Şirket güncellemeleri
  • Geliştirici araçları
  • Eğitim ve öğrenme kaynakları
  
  🎯 **Nasıl Kullanılır:**
  "Son AI haberleri", "Web geliştirme trendleri" gibi spesifik konular sorabilirsiniz!`;
}

function getBookRecommendations() {
  return `📚 **Kitap Önerileri**
  
  Size ilgi alanlarınıza göre kitap önerileri verebilirim!
  
  🎯 **Kategori Bazlı Öneriler:**
  
  💼 **İş ve Kariyer:**
  • "Deep Work" - Cal Newport
  • "Atomic Habits" - James Clear
  • "The 7 Habits of Highly Effective People" - Stephen Covey
  
  💻 **Teknoloji ve Programlama:**
  • "Clean Code" - Robert C. Martin
  • "The Pragmatic Programmer" - Andrew Hunt
  • "Design Patterns" - Gang of Four
  
  🧠 **Kişisel Gelişim:**
  • "Mindset" - Carol S. Dweck
  • "Grit" - Angela Duckworth
  • "The Power of Habit" - Charles Duhigg
  
  📊 **Proje Yönetimi:**
  • "The Phoenix Project" - Gene Kim
  • "Scrum: The Art of Doing Twice the Work" - Jeff Sutherland
  
  🎯 **Nasıl Kullanılır:**
  "Teknoloji kitabı önerisi", "Kişisel gelişim kitabı" gibi spesifik kategoriler sorabilirsiniz!`;
}

function getSportsResults() {
  return `⚽ **Spor Sonuçları**
  
  Güncel spor haberleri ve sonuçları hakkında bilgi verebilirim!
  
  🏆 **Popüler Sporlar:**
  • Futbol (Türkiye Süper Lig, Premier Lig, La Liga)
  • Basketbol (Türkiye Basketbol Ligi, NBA)
  • Voleybol
  • Tenis
  • Formula 1
  • Olimpiyat Oyunları
  
  📊 **Bilgi Türleri:**
  • Maç sonuçları
  • Lig tabloları
  • Oyuncu istatistikleri
  • Transfer haberleri
  • Şampiyonluk durumları
  
  🎯 **Nasıl Kullanılır:**
  "Fenerbahçe son maç sonucu", "Premier Lig tablosu", "NBA playoff durumu" gibi spesifik sorular sorabilirsiniz!`;
}

function getMusicRecommendations() {
  return `🎵 **Müzik Önerileri**
  
  Size müzik önerileri verebilirim!
  
  🎶 **Müzik Türleri:**
  • Pop
  • Rock
  • Jazz
  • Klasik
  • Elektronik
  • Türk Sanat Müziği
  • Türk Halk Müziği
  • Rap/Hip-Hop
  
  🎯 **Öneri Kategorileri:**
  • Çalışma müzikleri
  • Motivasyon şarkıları
  • Rahatlama müzikleri
  • Enerji veren şarkılar
  • Nostaljik parçalar
  
  📝 **Örnek İstekler:**
  • "Çalışırken dinleyebileceğim müzikler"
  • "Motivasyon şarkıları"
  • "Rahatlatıcı müzik önerileri"
  • "Rock müzik önerileri"
  
  🎯 **Nasıl Kullanılır:**
  Hangi türde veya hangi amaçla müzik istediğinizi belirtin!`;
}

function getMovieRecommendations() {
  return `🎬 **Film Tavsiyeleri**
  
  Size film önerileri verebilirim!
  
  🎭 **Film Türleri:**
  • Aksiyon
  • Komedi
  • Dram
  • Bilim Kurgu
  • Gerilim
  • Romantik
  • Belgesel
  • Animasyon
  
  🌟 **Öneri Kategorileri:**
  • Klasik filmler
  • Yeni çıkan filmler
  • Oscar ödüllü filmler
  • Netflix önerileri
  • Aile filmleri
  • Eğitici belgeseller
  
  📝 **Örnek İstekler:**
  • "Aksiyon film önerileri"
  • "Netflix'te izleyebileceğim filmler"
  • "Oscar ödüllü filmler"
  • "Aile ile izleyebileceğim filmler"
  
  🎯 **Nasıl Kullanılır:**
  Hangi türde veya platformda film istediğinizi belirtin!`;
}

// Eksik admin fonksiyonları
async function getEmployeeEfficiencyAnalysis() {
  try {
    const { rows: employees } = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.role,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' OR t.status = 'Tamamlandı' THEN 1 END) as completed_tasks,
        AVG(CASE WHEN t.completed_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/3600 
        END) as avg_completion_hours,
        COUNT(CASE WHEN t.status = 'in_progress' OR t.status = 'Yapılıyor' OR t.status = 'Devam Ediyor' THEN 1 END) as in_progress_tasks
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assigned_to
      WHERE LOWER(u.role) NOT IN ('admin', 'manager')
      GROUP BY u.id, u.name, u.role
      ORDER BY completed_tasks DESC
    `);
    
    const analysis = `📊 **Çalışan Verimlilik Analizi**
    
    🏆 **En Verimli Çalışanlar:**
    ${employees.slice(0, 3).map((emp, index) => 
      `${index + 1}. ${getFirstName(emp.name)} (${emp.role})
       • Tamamlanan: ${emp.completed_tasks}/${emp.total_tasks} (${emp.total_tasks > 0 ? Math.round((emp.completed_tasks / emp.total_tasks) * 100) : 0}%)
       • Ortalama Süre: ${emp.avg_completion_hours ? (emp.avg_completion_hours < 1 ? Math.round(emp.avg_completion_hours * 60) + ' dakika' : Math.round(emp.avg_completion_hours) + ' saat') : 'N/A'}
       • Devam Eden: ${emp.in_progress_tasks} görev`
    ).join('\n\n')}
    
    📈 **Verimlilik Metrikleri:**
    ${employees.map(emp => {
      const efficiency = emp.total_tasks > 0 ? (emp.completed_tasks / emp.total_tasks) * 100 : 0;
      const status = efficiency > 80 ? '🟢 Mükemmel' : efficiency > 60 ? '🟡 İyi' : '🔴 Geliştirilmeli';
      return `• ${getFirstName(emp.name)}: ${Math.round(efficiency)}% ${status}`;
    }).join('\n')}
    
    💡 **Öneriler:**
    • Düşük verimlilikli çalışanlara ek eğitim verin
    • Yüksek verimlilikli çalışanları ödüllendirin
    • İş yükü dağılımını optimize edin`;
    
    return analysis;
  } catch (error) {
    console.error('Çalışan verimlilik analizi hatası:', error);
    return 'Çalışan verimlilik analizi alınamadı.';
  }
}

async function getProjectProgressReport() {
  try {
    const { rows: tasks } = await pool.query(`
      SELECT 
        t.*,
        u.name as assigned_user_name,
        u.role as user_role
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      ORDER BY t.created_at DESC
    `);
    
    // Proje gruplarını hesapla
    const projectGroups = {};
    tasks.forEach(task => {
      const project = task.category || 'Genel';
      if (!projectGroups[project]) {
        projectGroups[project] = { total: 0, completed: 0, inProgress: 0, pending: 0 };
      }
      projectGroups[project].total++;
      if (task.status === 'completed' || task.status === 'Tamamlandı') projectGroups[project].completed++;
      else if (task.status === 'in_progress' || task.status === 'Yapılıyor' || task.status === 'Devam Ediyor') projectGroups[project].inProgress++;
      else projectGroups[project].pending++;
    });
    
    const projectProgress = Object.entries(projectGroups)
      .map(([project, stats]) => {
        const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        const status = progress > 80 ? '🟢' : progress > 50 ? '🟡' : '🔴';
        return `${status} **${project}:** ${stats.completed}/${stats.total} tamamlandı (${progress}%)
       • Devam Eden: ${stats.inProgress} | Bekleyen: ${stats.pending}`;
      })
      .join('\n\n');
    
    const priorityActions = Object.entries(projectGroups)
      .filter(([, stats]) => stats.pending > stats.completed)
      .map(([project]) => `• ${project} projesinde bekleyen görevlerin önceliğini artırın`)
      .join('\n');
    
    const report = `📋 **Proje İlerleme Raporu**
    
    📊 **Genel Durum:**
    • Toplam Proje: ${Object.keys(projectGroups).length}
    • Toplam Görev: ${tasks.length}
    • Tamamlanan: ${tasks.filter(t => t.status === 'completed' || t.status === 'Tamamlandı').length}
    • Devam Eden: ${tasks.filter(t => t.status === 'in_progress' || t.status === 'Yapılıyor' || t.status === 'Devam Ediyor').length}
    • Bekleyen: ${tasks.filter(t => t.status === 'pending' || t.status === 'Beklemede' || t.status === 'Yapılacaklar').length}
    
    📈 **Proje Bazlı İlerleme:**
    ${projectProgress}
    
    🎯 **Öncelikli Aksiyonlar:**
    ${priorityActions}
    
    💡 **Öneriler:**
    • Düşük ilerleme gösteren projelere daha fazla kaynak ayırın
    • Tamamlanma oranı yüksek projeleri hızlandırın
    • Haftalık proje toplantıları planlayın`;
    
    return report;
  } catch (error) {
    console.error('Proje ilerleme raporu hatası:', error);
    return 'Proje ilerleme raporu alınamadı.';
  }
}

async function getMeetingPlanningSuggestions() {
  try {
    const { rows: tasks } = await pool.query(`
      SELECT 
        t.*,
        u.name as assigned_user_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.status IN ('pending', 'in_progress', 'Beklemede', 'Yapılacaklar', 'Yapılıyor', 'Devam Ediyor')
      ORDER BY t.priority DESC, t.created_at ASC
    `);
    
    const urgentTasks = tasks.filter(t => t.priority === 'yüksek');
    const blockedTasks = tasks.filter(t => (t.status === 'pending' || t.status === 'Beklemede' || t.status === 'Yapılacaklar') && t.created_at < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    
    const suggestions = `📅 **Toplantı Planlaması Önerileri**
    
    🚨 **Acil Toplantı Gerektiren Durumlar:**
    ${urgentTasks.length > 0 ? 
      `• ${urgentTasks.length} yüksek öncelikli görev var
       • Bu görevlerin durumunu değerlendirmek için toplantı gerekli` : 
      '• Acil toplantı gerektiren durum yok'
    }
    
    ⏰ **Bloke Olmuş Görevler:**
    ${blockedTasks.length > 0 ? 
      `• ${blockedTasks.length} görev 1 haftadan fazla bekliyor
       • Bu görevlerin neden bloke olduğunu anlamak için toplantı gerekli` : 
      '• Bloke olmuş görev yok'
    }
    
    📋 **Önerilen Toplantı Konuları:**
    ${urgentTasks.length > 0 ? '• Yüksek öncelikli görevlerin durumu' : ''}
    ${blockedTasks.length > 0 ? '• Bloke olmuş görevlerin çözümü' : ''}
    • Haftalık proje durumu değerlendirmesi
    • Gelecek hafta planlaması
    • Takım performansı değerlendirmesi
    
    ⏰ **Önerilen Toplantı Süresi:** ${urgentTasks.length + blockedTasks.length > 5 ? '90 dakika' : '60 dakika'}
    
    👥 **Katılımcılar:** Proje yöneticisi, takım liderleri, ilgili çalışanlar
    
    📝 **Toplantı Gündemi:**
    1. Açılış ve güncel durum (10 dk)
    2. Yüksek öncelikli görevler (20 dk)
    3. Bloke olmuş görevler (15 dk)
    4. Haftalık planlama (10 dk)
    5. Sorular ve kapanış (5 dk)`;
    
    return suggestions;
  } catch (error) {
    console.error('Toplantı planlaması hatası:', error);
    return 'Toplantı planlaması önerileri alınamadı.';
  }
}

async function getTeamMotivationAnalysis() {
  try {
    const { rows: employees } = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.role,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' OR t.status = 'Tamamlandı' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.status = 'in_progress' OR t.status = 'Yapılıyor' OR t.status = 'Devam Ediyor' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN t.status = 'pending' OR t.status = 'Beklemede' OR t.status = 'Yapılacaklar' THEN 1 END) as pending_tasks,
        AVG(CASE WHEN t.completed_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/3600 
        END) as avg_completion_hours
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assigned_to
      WHERE LOWER(u.role) NOT IN ('admin', 'manager')
      GROUP BY u.id, u.name, u.role
      ORDER BY completed_tasks DESC
    `);
    
    const totalEmployees = employees.length;
    const highPerformers = employees.filter(emp => emp.total_tasks > 0 && (emp.completed_tasks / emp.total_tasks) > 0.8).length;
    const lowPerformers = employees.filter(emp => emp.total_tasks > 0 && (emp.completed_tasks / emp.total_tasks) < 0.5).length;
    
    const analysis = `💪 **Takım Motivasyon Analizi**
    
    📊 **Genel Motivasyon Durumu:**
    • Toplam Çalışan: ${totalEmployees}
    • Yüksek Performanslı: ${highPerformers} (${Math.round((highPerformers / totalEmployees) * 100)}%)
    • Düşük Performanslı: ${lowPerformers} (${Math.round((lowPerformers / totalEmployees) * 100)}%)
    
    🏆 **En Motive Çalışanlar:**
    ${employees.slice(0, 3).map((emp, index) => {
      const motivation = emp.total_tasks > 0 ? (emp.completed_tasks / emp.total_tasks) * 100 : 0;
      return `${index + 1}. ${getFirstName(emp.name)} - ${Math.round(motivation)}% motivasyon`;
    }).join('\n')}
    
    📈 **Motivasyon Faktörleri:**
    ${employees.map(emp => {
      const motivation = emp.total_tasks > 0 ? (emp.completed_tasks / emp.total_tasks) * 100 : 0;
      const status = motivation > 80 ? '🟢 Yüksek' : motivation > 60 ? '🟡 Orta' : '🔴 Düşük';
      return `• ${getFirstName(emp.name)}: ${status} (${Math.round(motivation)}%)`;
    }).join('\n')}
    
    💡 **Motivasyon Artırma Önerileri:**
    ${lowPerformers > 0 ? '• Düşük motivasyonlu çalışanlarla birebir görüşmeler yapın' : ''}
    ${highPerformers > 0 ? '• Yüksek performanslı çalışanları ödüllendirin' : ''}
    • Haftalık takım toplantıları düzenleyin
    • Başarı hikayelerini paylaşın
    • Esnek çalışma saatleri sunun
    • Eğitim ve gelişim fırsatları sağlayın
    
    🎯 **Hedef:** Tüm takımın motivasyon seviyesini %80'in üzerine çıkarın!`;
    
    return analysis;
  } catch (error) {
    console.error('Takım motivasyon analizi hatası:', error);
    return 'Takım motivasyon analizi alınamadı.';
  }
}

async function getBudgetStatus() {
  try {
    // Bu fonksiyon için örnek bütçe verisi kullanıyoruz
    // Gerçek uygulamada bütçe tablosu olmalı
    const budgetData = {
      totalBudget: 100000,
      spentBudget: 65000,
      remainingBudget: 35000,
      projects: [
        { name: 'Web Geliştirme', budget: 40000, spent: 28000 },
        { name: 'Mobil Uygulama', budget: 35000, spent: 22000 },
        { name: 'Sistem Entegrasyonu', budget: 25000, spent: 15000 }
      ]
    };
    
    const spentPercentage = (budgetData.spentBudget / budgetData.totalBudget) * 100;
    
    const status = `💰 **Bütçe Durumu Raporu**
    
    📊 **Genel Bütçe Durumu:**
    • Toplam Bütçe: ${budgetData.totalBudget.toLocaleString()} ₺
    • Harcanan: ${budgetData.spentBudget.toLocaleString()} ₺
    • Kalan: ${budgetData.remainingBudget.toLocaleString()} ₺
    • Harcama Oranı: ${Math.round(spentPercentage)}%
    
    📈 **Proje Bazlı Harcamalar:**
    ${budgetData.projects.map(project => {
      const projectSpentPercentage = (project.spent / project.budget) * 100;
      const status = projectSpentPercentage > 90 ? '🔴' : projectSpentPercentage > 70 ? '🟡' : '🟢';
      return `${status} **${project.name}:**
       • Bütçe: ${project.budget.toLocaleString()} ₺
       • Harcanan: ${project.spent.toLocaleString()} ₺
       • Kalan: ${(project.budget - project.spent).toLocaleString()} ₺
       • Oran: ${Math.round(projectSpentPercentage)}%`;
    }).join('\n\n')}
    
    ⚠️ **Uyarılar:**
    ${budgetData.projects.filter(p => (p.spent / p.budget) > 0.9).map(p => 
      `• ${getFirstName(p.name)} projesi bütçesinin %90'ını harcadı`
    ).join('\n')}
    
    💡 **Öneriler:**
    ${spentPercentage > 80 ? '• Bütçe aşımı riski var, harcamaları kontrol edin' : ''}
    • Aylık bütçe raporları hazırlayın
    • Proje maliyetlerini optimize edin
    • Gereksiz harcamaları azaltın
    
    🎯 **Hedef:** Bütçeyi %95'in altında tutun!`;
    
    return status;
  } catch (error) {
    console.error('Bütçe durumu hatası:', error);
    return 'Bütçe durumu alınamadı.';
  }
}

// Eksik çalışan fonksiyonları
async function getTaskPrioritySuggestions(userId) {
  try {
    const { rows: tasks } = await pool.query(`
      SELECT * FROM tasks 
      WHERE assigned_to = $1 
      AND status IN ('pending', 'in_progress')
      ORDER BY created_at ASC
    `, [userId]);
    
    if (tasks.length === 0) {
      return `📋 **Görev Öncelik Düzenleme**
      
      🎉 Şu anda düzenlenebilir görev bulunmuyor!
      
      💡 **Öneriler:**
      • Yeni görevler atandığında önceliklerini düzenleyebilirsiniz
      • Tamamlanan görevlerin önceliklerini gözden geçirebilirsiniz`;
    }
    
    const suggestions = `📋 **Görev Öncelik Düzenleme Önerileri**
    
    🎯 **Mevcut Görevleriniz:**
    ${tasks.map((task, index) => {
      const priorityIcon = task.priority === 'yüksek' ? '🔴' : 
                          task.priority === 'orta' ? '🟡' : '🟢';
      const daysSinceCreation = Math.floor((new Date() - new Date(task.created_at)) / (1000 * 60 * 60 * 24));
      return `${index + 1}. ${priorityIcon} **${task.title}**
         • Mevcut Öncelik: ${task.priority}
         • Oluşturulma: ${daysSinceCreation} gün önce
         • Tahmini Süre: ${task.estimated_hours || 1} saat`;
    }).join('\n\n')}
    
    💡 **Öncelik Düzenleme İpuçları:**
    • **Yüksek Öncelik:** Acil, kritik, müşteri beklentisi olan görevler
    • **Orta Öncelik:** Önemli ama acil olmayan görevler
    • **Düşük Öncelik:** Uzun vadeli, geliştirme görevleri
    
    📊 **Önerilen Düzenleme:**
    ${tasks.slice(0, 3).map((task, index) => {
      const suggestedPriority = index === 0 ? 'yüksek' : index === 1 ? 'orta' : 'düşük';
      return `• ${task.title}: ${task.priority} → ${suggestedPriority}`;
    }).join('\n')}
    
    🎯 **Hedef:** En önemli 3 görevi yüksek önceliğe alın!`;
    
    return suggestions;
  } catch (error) {
    console.error('Görev öncelik önerisi hatası:', error);
    return 'Görev öncelik önerileri alınamadı.';
  }
}

async function getSkillRecommendations(userId) {
  try {
    const { rows: tasks } = await pool.query(`
      SELECT * FROM tasks 
      WHERE assigned_to = $1 
      AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 20
    `, [userId]);
    
    // Kategori istatistiklerini hesapla
    const skillCategories = {};
    tasks.forEach(task => {
      const category = task.category || 'Genel';
      skillCategories[category] = (skillCategories[category] || 0) + 1;
    });
    
    const topSkills = Object.entries(skillCategories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([skill]) => skill);
    
    const topSkillsList = topSkills.map((skill, index) => 
      `${index + 1}. ${skill} (${skillCategories[skill]} görev)`
    ).join('\n');
    
    const advice = `🚀 **Kariyer Gelişim Tavsiyeleri**
    
    📊 **Mevcut Uzmanlık Alanlarınız:**
    ${topSkillsList}
    
    🎯 **Kısa Vadeli Hedefler (3-6 ay):**
    • ${topSkills[0]} alanında uzmanlaşın
    • Sertifika programlarına katılın
    • Mentorluk alın veya verin
    • Takım projelerinde liderlik yapın
    
    🌟 **Orta Vadeli Hedefler (6-12 ay):**
    • Yeni teknolojiler öğrenin
    • Konferanslarda sunum yapın
    • Açık kaynak projelere katkıda bulunun
    • Networking etkinliklerine katılın
    
    🏆 **Uzun Vadeli Hedefler (1-3 yıl):**
    • Teknik lider pozisyonuna geçin
    • Kendi projelerinizi başlatın
    • Eğitmenlik yapın
    • Endüstri uzmanı olun
    
    📚 **Önerilen Gelişim Yolları:**
    
    💻 **Teknik Gelişim:**
    • Sürekli öğrenme alışkanlığı edinin
    • Kod kalitesini artırın
    • Test yazma becerilerinizi geliştirin
    • DevOps pratiklerini öğrenin
    
    👥 **Liderlik Gelişimi:**
    • İletişim becerilerinizi geliştirin
    • Problem çözme yeteneklerinizi artırın
    • Takım çalışmasına odaklanın
    • Stratejik düşünme becerisi kazanın
    
    📈 **İş Gelişimi:**
    • Proje yönetimi becerilerinizi geliştirin
    • Müşteri iletişimi pratiği yapın
    • Analitik düşünme yeteneklerinizi artırın
    • İnovasyon odaklı çalışın
    
    🎯 **Aksiyon Planı:**
    1. Haftalık öğrenme hedefleri belirleyin
    2. Aylık kariyer değerlendirmesi yapın
    3. 3 ayda bir yeni beceri öğrenin
    4. Yıllık kariyer planınızı gözden geçirin
    
    💪 **Motivasyon:** Her gün küçük bir adım atarak büyük hedeflere ulaşabilirsiniz!`;
    
    return advice;
  } catch (error) {
    console.error('Beceri önerisi hatası:', error);
    return 'Beceri önerileri alınamadı.';
  }
}

async function getTaskCompletionTimes(userId) {
  try {
    const { rows: tasks } = await pool.query(`
      SELECT * FROM tasks 
      WHERE assigned_to = $1 
      AND status = 'completed'
      AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 30
    `, [userId]);
    
    if (tasks.length === 0) {
      return `⏰ **Görev Tamamlama Süreleri**
      
      📊 Henüz tamamlanmış görev bulunmuyor.
      
      💡 **İlk görevlerinizi tamamladıktan sonra süre analizi yapabiliriz!**`;
    }
    
    const completionTimes = tasks.map(task => {
      const created = new Date(task.created_at);
      const completed = new Date(task.completed_at);
      const hours = (completed - created) / (1000 * 60 * 60);
      return {
        title: task.title,
        estimated: task.estimated_hours || 1,
        actual: hours,
        difference: hours - (task.estimated_hours || 1),
        category: task.category || 'Genel'
      };
    });
    
    const avgActual = completionTimes.reduce((sum, t) => sum + t.actual, 0) / completionTimes.length;
    const avgEstimated = completionTimes.reduce((sum, t) => sum + t.estimated, 0) / completionTimes.length;
    const onTimeTasks = completionTimes.filter(t => t.actual <= t.estimated).length;
    const onTimePercentage = (onTimeTasks / completionTimes.length) * 100;
    
    // Kategori bazlı performans hesapla
    const categoryStats = {};
    completionTimes.forEach(task => {
      const category = task.category;
      if (!categoryStats[category]) {
        categoryStats[category] = { tasks: [], totalActual: 0, totalEstimated: 0 };
      }
      categoryStats[category].tasks.push(task);
      categoryStats[category].totalActual += task.actual;
      categoryStats[category].totalEstimated += task.estimated;
    });
    
    const categoryPerformance = Object.entries(categoryStats)
      .map(([category, data]) => {
        const avgActual = data.totalActual / data.tasks.length;
        const avgEstimated = data.totalEstimated / data.tasks.length;
        const efficiency = avgEstimated > 0 ? (avgEstimated / avgActual) * 100 : 0;
        return `• ${category}: ${Math.round(avgActual)}h gerçek / ${Math.round(avgEstimated)}h tahmin (${Math.round(efficiency)}% verimlilik)`;
      })
      .join('\n');
    
    const analysis = `⏰ **Görev Tamamlama Süreleri Analizi**
    
    📊 **Genel İstatistikler:**
    • Analiz Edilen Görev: ${tasks.length}
    • Ortalama Tahmini Süre: ${Math.round(avgEstimated)} saat
    • Ortalama Gerçek Süre: ${Math.round(avgActual)} saat
    • Zamanında Tamamlanan: ${onTimeTasks}/${tasks.length} (${Math.round(onTimePercentage)}%)
    
    📈 **Kategori Bazlı Performans:**
    ${categoryPerformance}
    
    🏆 **En Hızlı Tamamlanan Görevler:**
    ${completionTimes
      .sort((a, b) => a.actual - b.actual)
      .slice(0, 3)
      .map((task, index) => 
        `${index + 1}. ${task.title}: ${Math.round(task.actual)} saat (${Math.round(task.estimated)}h tahmin)`
      ).join('\n')}
    
    💡 **İyileştirme Önerileri:**
    ${onTimePercentage < 70 ? '• Tahmin sürelerinizi daha gerçekçi yapın' : ''}
    ${avgActual > avgEstimated * 1.5 ? '• Görevleri daha küçük parçalara bölün' : ''}
    • Benzer görevlerin sürelerini karşılaştırın
    • Engelleri önceden tespit edin
    
    🎯 **Hedef:** Zamanında tamamlama oranınızı %${Math.min(100, Math.round(onTimePercentage) + 10)}'a çıkarın!`;
    
    return analysis;
  } catch (error) {
    console.error('Görev tamamlama süreleri hatası:', error);
    return 'Görev tamamlama süreleri analizi alınamadı.';
  }
}

async function getWorkloadBalanceSuggestions(userId) {
  try {
    const { rows: tasks } = await pool.query(`
      SELECT * FROM tasks 
      WHERE assigned_to = $1 
      AND status IN ('pending', 'in_progress')
      ORDER BY priority DESC, created_at ASC
    `, [userId]);
    
    const totalHours = tasks.reduce((sum, task) => sum + (task.estimated_hours || 1), 0);
    const highPriorityHours = tasks.filter(t => t.priority === 'yüksek').reduce((sum, t) => sum + (t.estimated_hours || 1), 0);
    const workDays = 5; // Hafta içi
    const dailyHours = 8; // Günlük çalışma saati
    
    const suggestions = `⚖️ **İş Yükü Dengeleme Önerileri**
    
    📊 **Mevcut İş Yükü:**
    • Toplam Bekleyen Görev: ${tasks.length}
    • Toplam Tahmini Süre: ${totalHours} saat
    • Yüksek Öncelikli: ${highPriorityHours} saat
    • Günlük Ortalama: ${Math.round(totalHours / workDays)} saat
    
    ⚠️ **Dengeleme Gerektiren Durumlar:**
    ${totalHours > workDays * dailyHours ? '• Haftalık iş yükü çok yüksek' : ''}
    ${highPriorityHours > workDays * dailyHours * 0.6 ? '• Yüksek öncelikli görevler fazla' : ''}
    ${tasks.length > 10 ? '• Çok fazla görev var' : ''}
    
    💡 **Dengeleme Önerileri:**
    
    📅 **Zaman Yönetimi:**
    • Günlük maksimum ${Math.min(8, Math.round(totalHours / workDays))} saat planlayın
    • Yüksek öncelikli görevleri sabah yapın
    • Mola zamanlarını planlayın
    • Esnek zaman bırakın
    
    🎯 **Öncelik Düzenleme:**
    ${tasks.filter(t => t.priority === 'yüksek').length > 3 ? '• Yüksek öncelikli görevleri azaltın' : ''}
    • Düşük öncelikli görevleri erteliyin
    • Benzer görevleri gruplandırın
    
    🤝 **Delegasyon Önerileri:**
    ${totalHours > workDays * dailyHours * 1.2 ? '• Bazı görevleri takım arkadaşlarınıza devredin' : ''}
    • Uzmanlık gerektirmeyen görevleri paylaşın
    • Ortak projelerde işbirliği yapın
    
    📋 **Haftalık Plan:**
    ${Array.from({length: workDays}, (_, i) => {
      const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
      const dailyTasks = Math.ceil(tasks.length / workDays);
      return `• ${dayNames[i]}: ${dailyTasks} görev (${Math.round(totalHours / workDays)} saat)`;
    }).join('\n')}
    
    🎯 **Hedef:** Günlük iş yükünüzü ${Math.round(totalHours / workDays)} saatin altına düşürün!`;
    
    return suggestions;
  } catch (error) {
    console.error('İş yükü dengeleme hatası:', error);
    return 'İş yükü dengeleme önerileri alınamadı.';
  }
}

async function getCareerDevelopmentAdvice(userId) {
  try {
    const { rows: tasks } = await pool.query(`
      SELECT * FROM tasks 
      WHERE assigned_to = $1 
      AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 50
    `, [userId]);
    
    // Kategori istatistiklerini hesapla
    const skillCategories = {};
    tasks.forEach(task => {
      const category = task.category || 'Genel';
      skillCategories[category] = (skillCategories[category] || 0) + 1;
    });
    
    const topSkills = Object.entries(skillCategories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([skill]) => skill);
    
    const topSkillsList = topSkills.map((skill, index) => 
      `${index + 1}. ${skill} (${skillCategories[skill]} görev)`
    ).join('\n');
    
    const advice = `🚀 **Kariyer Gelişim Tavsiyeleri**
    
    📊 **Mevcut Uzmanlık Alanlarınız:**
    ${topSkillsList}
    
    🎯 **Kısa Vadeli Hedefler (3-6 ay):**
    • ${topSkills[0]} alanında uzmanlaşın
    • Sertifika programlarına katılın
    • Mentorluk alın veya verin
    • Takım projelerinde liderlik yapın
    
    🌟 **Orta Vadeli Hedefler (6-12 ay):**
    • Yeni teknolojiler öğrenin
    • Konferanslarda sunum yapın
    • Açık kaynak projelere katkıda bulunun
    • Networking etkinliklerine katılın
    
    🏆 **Uzun Vadeli Hedefler (1-3 yıl):**
    • Teknik lider pozisyonuna geçin
    • Kendi projelerinizi başlatın
    • Eğitmenlik yapın
    • Endüstri uzmanı olun
    
    📚 **Önerilen Gelişim Yolları:**
    
    💻 **Teknik Gelişim:**
    • Sürekli öğrenme alışkanlığı edinin
    • Kod kalitesini artırın
    • Test yazma becerilerinizi geliştirin
    • DevOps pratiklerini öğrenin
    
    👥 **Liderlik Gelişimi:**
    • İletişim becerilerinizi geliştirin
    • Problem çözme yeteneklerinizi artırın
    • Takım çalışmasına odaklanın
    • Stratejik düşünme becerisi kazanın
    
    📈 **İş Gelişimi:**
    • Proje yönetimi becerilerinizi geliştirin
    • Müşteri iletişimi pratiği yapın
    • Analitik düşünme yeteneklerinizi artırın
    • İnovasyon odaklı çalışın
    
    🎯 **Aksiyon Planı:**
    1. Haftalık öğrenme hedefleri belirleyin
    2. Aylık kariyer değerlendirmesi yapın
    3. 3 ayda bir yeni beceri öğrenin
    4. Yıllık kariyer planınızı gözden geçirin
    
    💪 **Motivasyon:** Her gün küçük bir adım atarak büyük hedeflere ulaşabilirsiniz!`;
    
    return advice;
  } catch (error) {
    console.error('Kariyer gelişim tavsiyesi hatası:', error);
    return 'Kariyer gelişim tavsiyesi alınamadı.';
  }
}

function getStressManagementTips() {
  return `😌 **Stres Yönetimi Önerileri**
  
  💡 **Günlük Stres Yönetimi:**
  
  ⏰ **Zaman Yönetimi:**
  • Pomodoro tekniği kullanın (25 dk çalışma + 5 dk mola)
  • Görevleri küçük parçalara bölün
  • Gerçekçi hedefler belirleyin
  • Öncelikleri netleştirin
  
  🧘 **Fiziksel Rahatlama:**
  • Derin nefes egzersizleri yapın
  • Düzenli egzersiz yapın
  • Yeterli uyku alın
  • Sağlıklı beslenin
  
  🧠 **Zihinsel Stratejiler:**
  • Mindfulness pratiği yapın
  • Olumlu düşünme alıştırmaları
  • Problem çözme yaklaşımınızı geliştirin
  • Mükemmeliyetçilikten kaçının
  
  👥 **Sosyal Destek:**
  • Takım arkadaşlarınızla iletişim kurun
  • Mentorluk alın
  • Aile ve arkadaşlarınızla zaman geçirin
  • Profesyonel destek almayı düşünün
  
  🎯 **İş Yerinde Stres Yönetimi:**
  • Düzenli molalar verin
  • Çalışma ortamınızı düzenleyin
  • Zor görevleri sabah yapın
  • "Hayır" demeyi öğrenin
  
  🚨 **Acil Stres Durumları:**
  • 10 derin nefes alın
  • 5 dakika yürüyüş yapın
  • Müzik dinleyin
  • Su için
  
  💪 **Uzun Vadeli Stratejiler:**
  • Hobi edinin
  • Düzenli tatil planlayın
  • İş-yaşam dengesini koruyun
  • Kişisel gelişime odaklanın
  
  🎯 **Hedef:** Her gün en az 30 dakika stres azaltıcı aktivite yapın!`;
}

function getTimeManagementTips() {
  return `⏰ **Zaman Yönetimi İpuçları**
  
  📋 **Temel Prensipler:**
  
  🎯 **Hedef Belirleme:**
  • SMART hedefler koyun (Spesifik, Ölçülebilir, Ulaşılabilir, Gerçekçi, Zamanlı)
  • Günlük, haftalık, aylık hedefler belirleyin
  • Öncelikleri netleştirin
  • Hedeflerinizi yazıya dökün
  
  📅 **Planlama Teknikleri:**
  • Günlük plan yapın (gece öncesi veya sabah)
  • Haftalık gözden geçirme yapın
  • Aylık hedef kontrolü yapın
  • Esnek planlama yapın
  
  ⏱️ **Zaman Bloklama:**
  • Benzer görevleri gruplandırın
  • 90 dakikalık odaklanma blokları yapın
  • Mola zamanlarını planlayın
  • Acil durumlar için tampon zaman bırakın
  
  🚫 **Zaman Tuzakları:**
  • Çok görevlilikten kaçının
  • Sosyal medya kullanımını sınırlayın
  • Gereksiz toplantılardan kaçının
  • Mükemmeliyetçilikten kaçının
  
  🛠️ **Verimlilik Araçları:**
  • Pomodoro tekniği (25 dk çalışma + 5 dk mola)
  • Eisenhower matrisi (Acil/Önemli)
  • Pareto prensibi (80/20 kuralı)
  • Zaman takip uygulamaları
  
  📊 **Günlük Rutin:**
  • Sabah 6-8: En zor görevler
  • Öğle 10-12: Orta zorlukta görevler
  • Öğleden sonra 2-4: Kolay görevler
  • Akşam 4-6: Planlama ve değerlendirme
  
  💡 **Pratik İpuçları:**
  • "Hayır" demeyi öğrenin
  • Delegasyon yapın
  • Otomasyon kullanın
  • Düzenli temizlik yapın
  
  🎯 **Ölçüm ve İyileştirme:**
  • Zamanınızı takip edin
  • Haftalık değerlendirme yapın
  • Verimsiz aktiviteleri tespit edin
  • Sürekli iyileştirme yapın
  
  🏆 **Hedef:** Günlük verimliliğinizi %20 artırın!`;
}

module.exports = { 
  askLLM,
  suggestTaskDescription,
  createTask,
  updateTask,
  assignTaskToUser,
  memorySystem,
  advancedMemorySystem,
  getProjectContext,
  listTasks,
  suggestEmployeeForTask,
  updateEmployeeTaskHistory,
  markTaskAsCompleted,
  getSmartTaskSuggestions,
  createTaskFromNaturalLanguage,
  analyzeTaskPerformance,
  handleSuggestedQuestion,
  // Admin fonksiyonları
  getTodayTaskSummary,
  getMostTaskedEmployee,
  getWeeklyCompletedProjects,
  getTeamPerformanceAnalysis,
  getEmployeeEfficiencyAnalysis,
  getProjectProgressReport,
  getMeetingPlanningSuggestions,
  getTeamMotivationAnalysis,
  getBudgetStatus,
  // Çalışan fonksiyonları
  getUserTodayTasks,
  getTomorrowPlanSuggestion,
  getUserPerformanceAnalysis,
  getTaskPrioritySuggestions,
  getSkillRecommendations,
  getTaskCompletionTimes,
  getWorkloadBalanceSuggestions,
  getCareerDevelopmentAdvice,
  getStressManagementTips,
  getTimeManagementTips,
  // Genel fonksiyonlar
  getGreetingResponse,
  getCurrentDate,
  getMathCalculationHelp,
  getCodeExample,
  getTechNews,
  getBookRecommendations,
  getSportsResults,
  getMusicRecommendations,
  getMovieRecommendations
}; 