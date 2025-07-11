require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const cron = require('node-cron');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// CORS ayarları
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));
app.use(express.json());

// API prefix'i
const apiRouter = express.Router();

// Route'lar
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const chatbotRoutes = require('./routes/chatbot');
const rolesRoutes = require('./routes/roles');
const chatRoutes = require('./routes/chat');
const notificationsRouter = require('./routes/notifications');
const meetingsRouter = require('./routes/meetings');
const channelsRoutes = require('./routes/channels');
const labelsRouter = require('./routes/labels');

// Route'ları /api altına taşı
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/messages', messageRoutes);
apiRouter.use('/chatbot', chatbotRoutes);
apiRouter.use('/roles', rolesRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/meetings', meetingsRouter);
apiRouter.use('/channels', channelsRoutes);
apiRouter.use('/labels', labelsRouter);

// Ana route'u kullan
app.use('/api', apiRouter);

// WebSocket sunucusu oluştur
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  verifyClient: (info, callback) => {
    try {
      const url = new URL(info.req.url, 'ws://localhost:3001');
      const token = url.searchParams.get('token');
      
      if (!token) {
        console.error('Token bulunamadı');
        callback(false, 401, 'Token bulunamadı');
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      info.req.userId = decoded.id;
      callback(true);
    } catch (error) {
      console.error('Token doğrulama hatası:', error);
      callback(false, 401, 'Geçersiz token');
    }
  }
});

// WebSocket bağlantılarını saklamak için Map
const clients = new Map();

// WebSocket bağlantı yönetimi
wss.on('connection', (ws, req) => {
  const userId = req.userId;
  console.log('Kullanıcı bağlandı:', userId);

  // Kullanıcıyı clients Map'ine ekle
  clients.set(userId, ws);

  // Bağlantı koptuğunda
  ws.on('close', () => {
    console.log('Kullanıcı bağlantısı kapandı:', userId);
    clients.delete(userId);
  });

  // Hata durumunda
  ws.on('error', (error) => {
    console.error('WebSocket hatası:', error);
    clients.delete(userId);
  });

  // Mesaj geldiğinde
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Yeni mesaj:', data);
      
      // Mesajı veritabanına kaydet
      const result = await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, message, type) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, data.receiver_id, data.message, data.type || 'general']
      );
      
      const newMessage = result.rows[0];
      console.log('Mesaj kaydedildi:', newMessage);
      
      // Mesaj detaylarını getir
      const messageDetails = await pool.query(
        `SELECT m.*, 
          s.name as sender_name,
          s.role as sender_role,
          r.name as receiver_name,
          CASE 
            WHEN m.sender_id = $1 THEN true
            ELSE false
          END as is_sender
        FROM messages m
        LEFT JOIN users s ON m.sender_id = s.id
        LEFT JOIN users r ON m.receiver_id = r.id
        WHERE m.id = $2`,
        [userId, newMessage.id]
      );
      
      const messageWithDetails = messageDetails.rows[0];
      
      // Alıcıya mesajı gönder
      if (data.receiver_id) {
        const receiverWs = clients.get(data.receiver_id);
        if (receiverWs) {
          receiverWs.send(JSON.stringify({
            type: 'new_message',
            message: messageWithDetails
          }));
        }
      } else {
        // Genel sohbet mesajı ise tüm kullanıcılara gönder
        clients.forEach((clientWs) => {
          clientWs.send(JSON.stringify({
            type: 'new_message',
            message: messageWithDetails
          }));
        });
      }
    } catch (error) {
      console.error('WebSocket mesaj işleme hatası:', error);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Backend çalışıyor'
  });
});

// HTTP isteklerini yönet
app.get('/', (req, res) => {
  res.send('WebSocket sunucusu aktif');
});

// 404 Handler
app.use((req, res) => {
  console.log('404 - Endpoint bulunamadı:', req.method, req.url);
  res.status(404).json({
    message: 'Endpoint bulunamadı!',
    path: req.url,
    method: req.method
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Hata detayları:', {
    error: err,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    user: req.user
  });

  // Veritabanı hataları için özel mesaj
  if (err.code === '23505') { // Unique violation
    return res.status(400).json({
      message: 'Bu kayıt zaten mevcut!',
      error: err.message
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      message: 'İlişkili kayıt bulunamadı!',
      error: err.message
    });
  }

  // JWT hataları için özel mesaj
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Geçersiz token!',
      error: err.message
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token süresi doldu!',
      error: err.message
    });
  }

  // Genel hata mesajı
  res.status(500).json({
    message: 'Sunucu hatası!',
    error: err.message
  });
});

// Toplantı zamanı yaklaşınca otomatik bildirim gönderme
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 16).replace('T', ' '); // yyyy-MM-dd HH:mm
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const oneHourLaterStr = oneHourLater.toISOString().slice(0, 16).replace('T', ' ');

    // 1 saat kala bildirim
    const meetings1h = await pool.query(
      `SELECT m.*, array_agg(mp.user_id) as participant_ids FROM meetings m
       LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
       WHERE to_char(m.meeting_time, 'YYYY-MM-DD HH24:MI') = $1 GROUP BY m.id`,
      [oneHourLaterStr]
    );
    for (const meeting of meetings1h.rows) {
      const msg = `Toplantı yaklaşıyor: ${meeting.title}\nTarih: ${meeting.date} Saat: ${meeting.time}`;
      for (const user_id of meeting.participant_ids) {
        await pool.query('INSERT INTO notifications (user_id, message) VALUES ($1, $2)', [user_id, msg]);
      }
    }

    // Tam saatinde bildirim
    const meetingsNow = await pool.query(
      `SELECT m.*, array_agg(mp.user_id) as participant_ids FROM meetings m
       LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
       WHERE to_char(m.meeting_time, 'YYYY-MM-DD HH24:MI') = $1 GROUP BY m.id`,
      [nowStr]
    );
    for (const meeting of meetingsNow.rows) {
      const msg = `Toplantı zamanı geldi: ${meeting.title}\nTarih: ${meeting.date} Saat: ${meeting.time}`;
      for (const user_id of meeting.participant_ids) {
        await pool.query('INSERT INTO notifications (user_id, message) VALUES ($1, $2)', [user_id, msg]);
      }
    }
  } catch (e) {
    console.error('Toplantı zamanlayıcı hatası:', e);
  }
});

// --- WebRTC Signaling (socket.io) ---
io.on('connection', (socket) => {
  socket.on('join-room', (roomId, userId, userName) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;

    // Yönetici bilgisini odada tut
    if (!io.sockets.adapter.rooms.get(roomId).hostId) {
      io.sockets.adapter.rooms.get(roomId).hostId = socket.id;
    }
    // Odaya katılan kullanıcıya, odadaki diğer kullanıcıların bilgilerini gönder
    const clientsInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const otherClients = clientsInRoom.filter(id => id !== socket.id).map(id => {
      const clientSocket = io.sockets.sockets.get(id);
      return { id, name: clientSocket?.userName || 'Anonim' };
    });
    socket.emit('all-users', otherClients, io.sockets.adapter.rooms.get(roomId).hostId);
    socket.to(roomId).emit('user-connected', { id: socket.id, name: userName });

    // Chat mesajı gönderme
    socket.on('chat-message', (message) => {
      socket.to(roomId).emit('chat-message', { name: userName, message });
    });

    // Toplantı bitirme
    socket.on('end-meeting', () => {
      io.to(roomId).emit('meeting-ended');
      // Oda boşaltılacak
      io.sockets.adapter.rooms.get(roomId).hostId = null;
    });

    // Yönetici devri
    socket.on('change-host', (newHostId) => {
      io.sockets.adapter.rooms.get(roomId).hostId = newHostId;
      io.to(roomId).emit('host-changed', newHostId);
    });

    socket.on('signal', (data) => {
      io.to(data.to).emit('signal', data);
    });

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', socket.id);
      // Eğer yönetici ayrılırsa, yeni yönetici belirle
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room && room.hostId === socket.id) {
        const remaining = Array.from(room).filter(id => id !== socket.id);
        if (remaining.length > 0) {
          room.hostId = remaining[0];
          io.to(roomId).emit('host-changed', remaining[0]);
        } else {
          room.hostId = null;
        }
      }
    });
  });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
  console.log(`WebSocket server is running on ws://localhost:${PORT}/ws`);
  console.log(`Socket.io signaling server is running on http://localhost:${PORT}`);
}); 