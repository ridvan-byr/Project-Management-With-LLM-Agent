"use client";

import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import styles from './MeetingModal.module.css';
import { useTheme } from 'next-themes';

interface User {
  id: number;
  name: string;
}

interface Meeting {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  created_by: number;
  created_at: string;
}

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MeetingModal: React.FC<MeetingModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showMeetingList, setShowMeetingList] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [meetingDates, setMeetingDates] = useState<Set<string>>(new Set());
  const { theme } = useTheme ? useTheme() : { theme: 'light' };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchAllMeetingDates();
      setSuccess('');
      setError('');
      
      // Portal hatalarını tamamen engelle
      const originalOnError = window.onerror;
      const originalAddEventListener = window.addEventListener;
      const originalRemoveEventListener = window.removeEventListener;
      
      // Error handler'ı override et
      window.onerror = function(message, source, lineno, colno, error) {
        if (typeof message === 'string' && (
          message.includes('removeChild') || 
          message.includes('appendChild') ||
          message.includes('insertBefore') ||
          message.includes('replaceChild')
        )) {
          console.log('Portal hatası engellendi:', message);
          return true; // Hatayı görmezden gel
        }
        if (originalOnError) {
          return originalOnError(message, source, lineno, colno, error);
        }
        return false;
      };
      
      // Unhandled promise rejection'ları da engelle
      const originalUnhandledRejection = window.onunhandledrejection;
      window.onunhandledrejection = function(event: PromiseRejectionEvent) {
        if (event.reason && typeof event.reason === 'string' && 
            event.reason.includes('removeChild')) {
          console.log('Unhandled rejection engellendi:', event.reason);
          event.preventDefault();
          return;
        }
        if (originalUnhandledRejection) {
          originalUnhandledRejection.call(window, event);
        }
      };
      
      return () => {
        window.onerror = originalOnError;
        window.onunhandledrejection = originalUnhandledRejection;
      };
    }
  }, [isOpen]);

  // Ayrı bir useEffect sadece modal kapandığında cleanup için
  useEffect(() => {
    if (!isOpen) {
      // Modal kapandığında state'leri temizle
      const timer = setTimeout(() => {
        setSelectedDate(null);
        setSelectedTime('');
        setSelectedUsers([]);
        setShowMeetingList(false);
        setMeetings([]);
        setSelectedMeeting(null);
        setTitle('');
        setDescription('');
        setSuccess('');
        setError('');
      }, 300); // 300ms bekle

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data.filter((u: any) => u.role === 'employee') : []);
    } catch (e) {
      setError('Kullanıcılar yüklenemedi');
    }
  };

  const fetchAllMeetingDates = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/meetings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        const dates = new Set<string>();
        if (Array.isArray(data)) {
          data.forEach((meeting: any) => {
            if (meeting.date) {
              dates.add(meeting.date);
            }
          });
        }
        setMeetingDates(dates);
        console.log('Toplantı tarihleri:', Array.from(dates));
      }
    } catch (e) {
      console.error('Toplantı tarihleri yüklenirken hata:', e);
    }
  };

  const fetchMeetingsForDate = async (date: Date) => {
    try {
      const token = localStorage.getItem('token');
      const dateStr = format(date, 'yyyy-MM-dd');
      const res = await fetch(`http://localhost:3001/api/meetings?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setMeetings(Array.isArray(data) ? data : []);
        setShowMeetingList(true);
      } else {
        setMeetings([]);
        setShowMeetingList(true);
      }
    } catch (e) {
      console.error('Toplantılar yüklenirken hata:', e);
      setMeetings([]);
      setShowMeetingList(true);
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    fetchMeetingsForDate(date);
  };

  const handleUserToggle = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || selectedUsers.length === 0 || !title.trim()) {
      setError('Lütfen tüm alanları doldurun ve en az bir kullanıcı seçin');
      return;
    }

    setLoading(true);
    setSuccess('');
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Önce toplantıyı meetings tablosuna kaydet
      const meetingRes = await fetch('http://localhost:3001/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          title, 
          description, 
          date: dateStr, 
          time: selectedTime,
          user_ids: selectedUsers
        })
      });
      
      if (!meetingRes.ok) {
        const errorData = await meetingRes.json();
        throw new Error(errorData.message || 'Toplantı oluşturulamadı');
      }
      
      // Sonra bildirim gönder
      const notificationRes = await fetch('http://localhost:3001/api/notifications/meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          user_ids: selectedUsers, 
          title, 
          description, 
          date: dateStr, 
          time: selectedTime 
        })
      });
      
      if (meetingRes.ok) {
        setSuccess('Toplantı başarıyla oluşturuldu ve bildirim gönderildi!');
        setTitle('');
        setDescription('');
        setSelectedDate(null);
        setSelectedTime('');
        setSelectedUsers([]);
        setShowMeetingList(false);
        setMeetings([]);
        
        // Eğer tarih seçiliyse toplantıları yeniden yükle
        if (selectedDate) {
          await fetchMeetingsForDate(selectedDate);
        }
      } else {
        setError('Toplantı oluşturulamadı');
      }
    } catch (e: any) {
      console.error('Toplantı oluşturma hatası:', e);
      setError(e.message || 'Sunucu hatası');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedDate || !selectedTime || selectedUsers.length === 0 || !title.trim()) {
      setError('Lütfen tüm alanları doldurun ve en az bir kullanıcı seçin');
      return;
    }

    setLoading(true);
    setSuccess('');
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Önce toplantıyı meetings tablosundan sil (eğer varsa)
      const meetingRes = await fetch(`http://localhost:3001/api/meetings?date=${dateStr}&title=${encodeURIComponent(title)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      
      // Sonra iptal bildirimi gönder
      const notificationRes = await fetch('http://localhost:3001/api/notifications/meeting/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          user_ids: selectedUsers, 
          title, 
          date: dateStr, 
          time: selectedTime 
        })
      });
      
      if (notificationRes.ok) {
        setSuccess('Toplantı iptal bildirimi gönderildi!');
        setTitle('');
        setDescription('');
        setSelectedDate(null);
        setSelectedTime('');
        setSelectedUsers([]);
        setShowMeetingList(false);
        setMeetings([]);
        
        // Eğer tarih seçiliyse toplantıları yeniden yükle
        if (selectedDate) {
          await fetchMeetingsForDate(selectedDate);
        }
      } else {
        setError('Toplantı iptal bildirimi gönderilemedi');
      }
    } catch (e: any) {
      console.error('Toplantı iptal hatası:', e);
      setError(e.message || 'Sunucu hatası');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedUserNames = () => {
    return users
      .filter(user => selectedUsers.includes(user.id))
      .map(user => user.name)
      .join(', ');
  };

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
  };

  const closeMeetingDetail = () => {
    setSelectedMeeting(null);
  };

  const handleClose = () => {
    try {
      // Modal kapanırken state'leri temizle
      setSelectedDate(null);
      setSelectedTime('');
      setSelectedUsers([]);
      setShowMeetingList(false);
      setMeetings([]);
      setSelectedMeeting(null);
      setTitle('');
      setDescription('');
      setSuccess('');
      setError('');
      onClose();
    } catch (error) {
      console.error('Modal kapatma hatası:', error);
      // Hata durumunda sadece onClose çağır
      onClose();
    }
  };

  // Güvenli render kontrolü
  if (!isOpen || typeof window === 'undefined') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-y-auto p-8 relative border border-gray-300 dark:border-gray-700 transition-colors duration-300">
        <button 
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-2xl font-bold transition-colors" 
          onClick={handleClose}
        >
          ×
        </button>
        
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white text-center">
          Toplantı Yönetimi
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sol Taraf - Takvim */}
          <div className="space-y-6">
            <div className="rounded-2xl p-6 shadow-xl transition-colors duration-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
              <h3 className="text-xl font-bold mb-6 text-gray-900 dark:text-white flex items-center">
                <span className="text-2xl mr-3">📅</span>
                Tarih Seçin
              </h3>
              <div className="flex justify-center">
                {typeof window !== 'undefined' && document && document.body && isOpen && (
                  <div className="datepicker-wrapper">
                    <DatePicker
                      selected={selectedDate}
                      onChange={(date: Date | null) => {
                        if (date) handleDateClick(date);
                      }}
                      inline
                      minDate={new Date()}
                      locale={tr}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="Tarih seçin"
                      calendarClassName={styles['custom-datepicker'] + ' bg-white border border-gray-300 text-gray-900 dark:bg-gray-900 dark:border-gray-700 dark:text-white'}
                      dayClassName={(date) => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        let className = '';
                        
                        if (meetingDates.has(dateStr)) {
                          className = styles['has-meeting'];
                          console.log('Toplantı olan gün:', dateStr, 'Class:', className);
                        }
                        
                        return className;
                      }}
                      renderCustomHeader={({ monthDate, decreaseMonth, increaseMonth }) => (
                        <div className={styles['custom-header']}>
                          <button onClick={decreaseMonth}>&lt;</button>
                          <span>{monthDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })}</span>
                          <button onClick={increaseMonth}>&gt;</button>
                        </div>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center">
                <span className="text-2xl mr-3">🕐</span>
                Saat Seçin
              </h3>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg font-medium focus:ring-4 focus:ring-blue-200 focus:border-blue-400 transition-all"
              />
            </div>
          </div>

          {/* Orta Taraf - Toplantı Listesi */}
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
                📋 {selectedDate ? `${format(selectedDate, 'dd MMMM yyyy', { locale: tr })} Toplantıları` : 'Toplantı Listesi'}
              </h3>
              
              {showMeetingList && selectedDate ? (
                <div className="space-y-2">
                  {meetings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <div className="text-4xl mb-2">📅</div>
                      <p>Bu tarihte toplantı bulunmuyor</p>
                    </div>
                  ) : (
                    meetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        onClick={() => handleMeetingClick(meeting)}
                        className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                              {meeting.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              🕐 {meeting.time}
                            </p>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Detay →
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">📅</div>
                  <p>Tarih seçin</p>
                </div>
              )}
            </div>
          </div>

          {/* Sağ Taraf - Form veya Detay */}
          <div className="space-y-4">
            {selectedMeeting ? (
              // Toplantı Detay Görünümü
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    📋 Toplantı Detayı
                  </h3>
                  <button
                    onClick={closeMeetingDetail}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Başlık
                    </label>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {selectedMeeting.title}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tarih & Saat
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {format(new Date(selectedMeeting.date), 'dd MMMM yyyy', { locale: tr })} - {selectedMeeting.time}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Açıklama
                    </label>
                    <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {selectedMeeting.description || 'Açıklama yok'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Oluşturulma Tarihi
                    </label>
                    <p className="text-gray-900 dark:text-gray-100">
                      {format(new Date(selectedMeeting.created_at), 'dd MMMM yyyy HH:mm', { locale: tr })}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // Toplantı Oluşturma Formu
              <>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    📝 Toplantı Başlığı
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Toplantı başlığını girin"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    📄 Açıklama
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Toplantı açıklamasını girin"
                    rows={3}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    👥 Katılımcılar
                  </label>
                  <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                    {users.map(user => (
                      <label key={user.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => handleUserToggle(user.id)}
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-gray-900 dark:text-gray-100">{user.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Seçilen Kullanıcılar */}
                {selectedUsers.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-2 text-blue-800 dark:text-blue-200">
                      ✅ Seçilen Katılımcılar:
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {getSelectedUserNames()}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Hata ve Başarı Mesajları */}
        {success && (
          <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/20 border border-green-400 text-green-700 dark:text-green-300 rounded-lg">
            {success}
          </div>
        )}
        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}

        {/* Butonlar */}
        <div className="flex gap-3 mt-6">
          {!selectedMeeting ? (
            // Toplantı oluşturma butonları
            <>
              <button
                onClick={handleSubmit}
                disabled={loading || !selectedDate || !selectedTime || selectedUsers.length === 0 || !title.trim()}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {loading ? 'Gönderiliyor...' : '📅 Toplantı Ayarla'}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading || !selectedDate || !selectedTime || selectedUsers.length === 0 || !title.trim()}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {loading ? 'Gönderiliyor...' : '❌ Toplantı İptal Et'}
              </button>
            </>
          ) : (
            // Toplantı detay butonları
            <>
              <button
                onClick={closeMeetingDetail}
                className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 font-medium transition-colors"
              >
                ← Geri Dön
              </button>
              <button
                onClick={async () => {
                  if (confirm('Bu toplantıyı iptal etmek istediğinizden emin misiniz?')) {
                    try {
                      const token = localStorage.getItem('token');
                      const dateStr = format(new Date(selectedMeeting.date), 'yyyy-MM-dd');
                      
                      // Toplantıyı meetings tablosundan sil
                      const meetingRes = await fetch(`http://localhost:3001/api/meetings/${selectedMeeting.id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
                      });
                      
                      if (meetingRes.ok) {
                        setSuccess('Toplantı başarıyla iptal edildi!');
                        setSelectedMeeting(null);
                        setShowMeetingList(false);
                        setMeetings([]);
                        
                        // Eğer tarih seçiliyse toplantıları yeniden yükle
                        if (selectedDate) {
                          await fetchMeetingsForDate(selectedDate);
                        }
                      } else {
                        setError('Toplantı iptal edilemedi');
                      }
                    } catch (error) {
                      console.error('Toplantı iptal hatası:', error);
                      setError('Toplantı iptal edilirken bir hata oluştu');
                    }
                  }
                }}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                🗑️ Toplantıyı İptal Et
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingModal; 