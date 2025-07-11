'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface AuthContextType {
  isAuthenticated: boolean;
  userRole: string | null;
  userId: number | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userRole: null,
  userId: null,
  isLoading: true,
  login: async () => ({ success: false, message: 'Context not ready' }),
  logout: () => {},
  refreshToken: async () => '',
});

// localStorage'a güvenli erişim için yardımcı fonksiyonlar
const getLocalStorage = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setLocalStorage = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage erişimi reddedildi
  }
};

const removeLocalStorage = (key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage erişimi reddedildi
  }
};

const clearLocalStorage = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.clear();
  } catch {
    // localStorage erişimi reddedildi
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Axios interceptor - otomatik token yenileme
  useEffect(() => {
    let requestInterceptor: number;
    let responseInterceptor: number;

    try {
      requestInterceptor = axios.interceptors.request.use(
        (config) => {
          const token = getLocalStorage('token');
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          return config;
        },
        (error) => {
          return Promise.reject(error);
        }
      );

      responseInterceptor = axios.interceptors.response.use(
        (response) => response,
        async (error) => {
          const originalRequest = error.config;

          if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
              const newToken = await refreshToken();
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
              return axios(originalRequest);
            } catch (refreshError) {
              // Refresh token da geçersizse logout yap
              logout();
              return Promise.reject(refreshError);
            }
          }

          return Promise.reject(error);
        }
      );
    } catch (error) {
      console.error('Axios interceptor kurulum hatası:', error);
    }

    return () => {
      try {
        if (requestInterceptor !== undefined) {
          axios.interceptors.request.eject(requestInterceptor);
        }
        if (responseInterceptor !== undefined) {
          axios.interceptors.response.eject(responseInterceptor);
        }
      } catch (error) {
        console.error('Axios interceptor temizleme hatası:', error);
      }
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post('http://localhost:3001/api/auth/login', {
        email,
        password
      });

      const { token, refreshToken, role, id } = response.data;

      // Token'ları localStorage'a kaydet
      setLocalStorage('token', token);
      setLocalStorage('refreshToken', refreshToken);
      setLocalStorage('userRole', role);
      setLocalStorage('userId', id.toString());

      setIsAuthenticated(true);
      setUserRole(role);
      setUserId(id);

      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      
      return { 
        success: false, 
        message: error.response?.data?.message || 'Giriş yapılırken bir hata oluştu'
      };
    }
  };

  const logout = () => {
    clearLocalStorage();
    setIsAuthenticated(false);
    setUserRole(null);
    setUserId(null);
  };

  const refreshToken = async () => {
    try {
      const storedRefreshToken = getLocalStorage('refreshToken');
      
      if (!storedRefreshToken) {
        throw new Error('Refresh token bulunamadı');
      }

      const response = await axios.post('http://localhost:3001/api/auth/refresh', {}, {
        headers: {
          'Authorization': `Bearer ${storedRefreshToken}`
        }
      });

      const { token, refreshToken: newRefreshToken } = response.data;

      setLocalStorage('token', token);
      setLocalStorage('refreshToken', newRefreshToken);

      return token;
    } catch (error: any) {
      console.error('Token yenileme hatası:', error);
      throw error;
    }
  };

  // Token geçerliliğini kontrol et
  const validateToken = async () => {
    try {
      const token = getLocalStorage('token');
      if (!token) return false;

      // Token'ı backend'de doğrula
      const response = await axios.get('http://localhost:3001/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 200 && response.data.valid) {
        // Yeni token'ı kaydet
        if (response.data.token) {
          setLocalStorage('token', response.data.token);
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token doğrulama hatası:', error);
      return false;
    }
  };

  // Sayfa yüklendiğinde localStorage'dan token kontrolü
  useEffect(() => {
    const checkAuth = async () => {
      if (typeof window !== 'undefined') {
        setMounted(true);
        
        // localStorage'dan token ve kullanıcı bilgilerini kontrol et
        const token = getLocalStorage('token');
        const storedUserRole = getLocalStorage('userRole');
        const storedUserId = getLocalStorage('userId');
        
        if (token && storedUserRole && storedUserId) {
          // Token'ın geçerliliğini kontrol et
          const isValid = await validateToken();
          
          if (isValid) {
            // Token geçerliyse kullanıcıyı otomatik giriş yap
            setIsAuthenticated(true);
            setUserRole(storedUserRole);
            setUserId(parseInt(storedUserId));
          } else {
            // Token geçersizse localStorage'ı temizle
            clearLocalStorage();
            setIsAuthenticated(false);
            setUserRole(null);
            setUserId(null);
          }
        }
        
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const value = {
    isAuthenticated,
    userRole,
    userId,
    isLoading,
    login,
    logout,
    refreshToken,
  };

  // Hydration sorunlarını önlemek için
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context;
} 