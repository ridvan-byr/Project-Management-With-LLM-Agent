"use client";

import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

// Bildirim tipi
interface Notification {
  id: number;
  user_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Okunmamış bildirim sayısı
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Bildirimleri çek
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('Token bulunamadı, bildirimler temizleniyor');
        setNotifications([]);
        setLoading(false);
        return;
      }
      
      console.log('Bildirimler çekiliyor...');
      const res = await fetch('http://localhost:3001/api/notifications', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        console.error('Bildirimler çekilirken hata:', res.status, res.statusText);
        setNotifications([]);
        return;
      }
      
      const data = await res.json();
      console.log('Çekilen bildirimler:', data);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Bildirimler çekilirken hata:', e);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  // Buton pozisyonunu hesapla
  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const notificationWidth = 320; // w-80 = 320px
      
      // Butonun sağ kenarından pencere genişliğini çıkar ve biraz sağa kaydır
      let right = windowWidth - rect.right - 120; // 20px sağa kaydır
      
      // Eğer pencere sağ kenardan taşarsa, sağ kenara yasla
      if (right < 0) {
        right = 16; // 16px margin
      }
      
      setPosition({
        top: rect.bottom + 8, // Butonun altından 8px aşağıda
        right: right
      });
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Polling ile 30 sn'de bir güncelle
    const interval = setInterval(fetchNotifications, 30000);
    
    // Cleanup function
    return () => {
      clearInterval(interval);
      // Portal'ı kapat
      setOpen(false);
    };
  }, []);

  // Menü açılınca tümünü okundu yap
  const handleOpen = async () => {
    try {
      if (!open) {
        calculatePosition(); // Pozisyonu hesapla
      }
      setOpen(!open);
      if (!open) {
        try {
          // Okunmamışları okundu yap
          const token = localStorage.getItem('token');
          if (!token) {
            console.error('Token bulunamadı');
            return;
          }
          
          const unread = notifications.filter(n => !n.is_read);
          if (unread.length === 0) {
            return;
          }
          
          console.log(`${unread.length} okunmamış bildirim işaretleniyor...`);
          
          await Promise.all(unread.map(async (n) => {
            try {
              const response = await fetch('http://localhost:3001/api/notifications/' + n.id + '/read', {
                method: 'PATCH',
                headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (!response.ok) {
                console.error(`Bildirim ${n.id} işaretlenirken hata:`, response.status, response.statusText);
              } else {
                console.log(`Bildirim ${n.id} başarıyla işaretlendi`);
              }
            } catch (error) {
              console.error(`Bildirim ${n.id} işaretlenirken hata:`, error);
            }
          }));
          
          // Bildirimleri yeniden çek
          await fetchNotifications();
        } catch (error) {
          console.error('Bildirim işaretleme hatası:', error);
        }
      }
    } catch (error) {
      console.error('handleOpen hatası:', error);
    }
  };

  // Bildirimi sil
  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Token bulunamadı');
        return;
      }
      
      const response = await fetch('http://localhost:3001/api/notifications/' + id, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Bildirim silinirken hata:', response.status, response.statusText);
        return;
      }
      
      console.log(`Bildirim ${id} başarıyla silindi`);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Bildirim silinirken hata:', error);
    }
  };

  // Tüm bildirimleri sil
  const handleDeleteAll = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await Promise.all(notifications.map(async (n) => {
        await fetch('http://localhost:3001/api/notifications/' + n.id, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }));
      setNotifications([]);
    } catch (e) {
      // hata yönetimi
    }
  };

  // Dışarı tıklayınca kapat
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className="relative p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        onClick={handleOpen}
        aria-label="Bildirimler"
      >
        <svg className="w-6 h-6 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>
      {open && typeof window !== 'undefined' && document && document.body && document.body.parentNode && (
        <div className="notification-portal-wrapper">
          {ReactDOM.createPortal(
            <div 
              ref={panelRef}
              className="absolute z-50 w-80 max-w-xs right-0 mt-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl shadow-xl dark:shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 backdrop-blur-sm"
              style={{ top: position.top, right: position.right }}
            >
              <div className="p-4 font-semibold border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white flex items-center justify-between">
                <span>Bildirimler</span>
                <button
                  onClick={handleDeleteAll}
                  className="ml-2 px-2 py-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                  title="Tümünü Sil"
                  disabled={notifications.length === 0}
                >
                  Tümünü Sil
                </button>
              </div>
              {loading ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                    <span>Yükleniyor...</span>
                  </div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center space-y-2">
                    <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span>Bildirim yok</span>
                  </div>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
                  {notifications.map(n => (
                    <div key={n.id} className={`flex items-start justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!n.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm break-words text-gray-900 dark:text-gray-100 whitespace-pre-line leading-relaxed">{n.message}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">{dayjs.utc(n.created_at).tz('Europe/Istanbul').format('YYYY-MM-DD HH:mm')}</div>
                      </div>
                      <button
                        className="ml-3 flex-shrink-0 text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1 rounded transition-colors"
                        onClick={() => handleDelete(n.id)}
                        aria-label="Sil"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell; 