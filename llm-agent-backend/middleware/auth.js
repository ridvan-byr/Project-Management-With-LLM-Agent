const jwt = require('jsonwebtoken');

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
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ message: 'Token süresi doldu!' });
        }
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

module.exports = {
  authenticateToken
}; 