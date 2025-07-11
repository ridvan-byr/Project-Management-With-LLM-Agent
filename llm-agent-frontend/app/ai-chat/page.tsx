'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiSend, FiArrowLeft, FiSettings } from 'react-icons/fi';
import Link from 'next/link';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

export default function AIChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { userId, userRole } = useAuth();
  const router = useRouter();

  // Authentication kontrolü
  useEffect(() => {
    if (!userId) {
      router.push('/login');
      return;
    }
  }, [userId, router]);

  // LocalStorage'dan sohbet geçmişini yükle
  useEffect(() => {
    if (userId) {
      const savedSessions = localStorage.getItem(`ai_chat_sessions_${userId}`);
      if (savedSessions) {
        try {
          const parsed = JSON.parse(savedSessions);
          // Date objelerini geri yükle
          const sessionsWithDates = parsed.map((session: any) => ({
            ...session,
            createdAt: new Date(session.createdAt),
            messages: session.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
          }));
          setSessions(sessionsWithDates);
          if (sessionsWithDates.length > 0) {
            setCurrentSession(sessionsWithDates[0]);
          } else {
            // Sohbet geçmişi yoksa yeni sohbet oluştur
            const newSession: ChatSession = {
              id: Date.now().toString(),
              title: 'Yeni Sohbet',
              messages: [],
              createdAt: new Date()
            };
            setSessions([newSession]);
            setCurrentSession(newSession);
            saveSessionsToStorage([newSession]);
          }
        } catch (error) {
          console.error('Sohbet geçmişi yüklenirken hata:', error);
          // Hata durumunda yeni sohbet oluştur
          const newSession: ChatSession = {
            id: Date.now().toString(),
            title: 'Yeni Sohbet',
            messages: [],
            createdAt: new Date()
          };
          setSessions([newSession]);
          setCurrentSession(newSession);
          saveSessionsToStorage([newSession]);
        }
      } else {
        // Hiç sohbet geçmişi yoksa yeni sohbet oluştur
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: 'Yeni Sohbet',
          messages: [],
          createdAt: new Date()
        };
        setSessions([newSession]);
        setCurrentSession(newSession);
        saveSessionsToStorage([newSession]);
      }
      
      // Backend'den gelişmiş bellek bilgilerini al
      loadAdvancedMemory();
      loadModelStatus();
      loadSuggestions();
      // loadSmartSuggestions(); // Gereksiz AI çağrısını kaldır
    }
  }, [userId]);

  // Gelişmiş bellek bilgilerini yükle
  const loadAdvancedMemory = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get('http://localhost:3001/api/chatbot/memory', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        console.log('Gelişmiş bellek yüklendi:', response.data.data);
        // Burada bellek bilgilerini kullanabiliriz
        // Örneğin: kullanıcı tercihlerini UI'da gösterebiliriz
      }
    } catch (error) {
      console.error('Gelişmiş bellek yükleme hatası:', error);
    }
  };

  // Model durumunu yükle
  const loadModelStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get('http://localhost:3001/api/chatbot/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setModelStatus(response.data.data);
        console.log('Model durumu:', response.data.data);
      }
    } catch (error) {
      console.error('Model durumu yükleme hatası:', error);
    }
  };

  // Rol bazlı önerilen soruları yükle
  const loadSuggestions = () => {
    const adminSuggestions = [
      "Bugünkü görev durumunu özetle",
      "En çok görev alan çalışan kim?",
      "Bu hafta tamamlanan projeleri listele",
      "Performans analizi yap",
      "Yeni görev önerileri ver",
      "Çalışan verimliliğini analiz et",
      "Proje ilerleme raporu hazırla",
      "Toplantı planlaması yap",
      "Takım motivasyonu nasıl?",
      "Bütçe durumu nedir?"
    ];

    const employeeSuggestions = [
      "Bugünkü görevlerimi göster",
      "Yarın için plan önerisi ver",
      "Görev önceliklerini düzenle",
      "Çalışma performansımı analiz et",
      "Yeni beceri önerileri ver",
      "Görev tamamlama sürelerimi hesapla",
      "İş yükü dengeleme önerisi",
      "Kariyer gelişim tavsiyesi",
      "Stres yönetimi önerileri",
      "Zaman yönetimi ipuçları"
    ];

    const generalSuggestions = [
      "Merhaba, nasılsın?",
      "Hava durumu nasıl?",
      "Günün tarihi nedir?",
      "Matematik hesaplaması yap",
      "Kod örneği ver",
      "Teknoloji haberleri anlat",
      "Kitap önerisi ver",
      "Spor sonuçlarını söyle",
      "Şarkı önerisi ver",
      "Film tavsiyesi al"
    ];

    // Rol bazlı önerileri birleştir
    let roleSuggestions: string[] = [];
    if (userRole === 'admin') {
      roleSuggestions = adminSuggestions;
    } else if (userRole === 'employee') {
      roleSuggestions = employeeSuggestions;
    } else {
      roleSuggestions = generalSuggestions;
    }

    // Genel önerileri de ekle (ilk 4 tanesi)
    const finalSuggestions = [...roleSuggestions, ...generalSuggestions.slice(0, 4)];
    setSuggestions(finalSuggestions);
  };

  // Akıllı önerileri backend'den al
  const loadSmartSuggestions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !userId) return;

      const response = await axios.get('http://localhost:3001/api/chatbot/suggestions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success && response.data.suggestions.length > 0) {
        // Backend'den gelen önerileri mevcut önerilere ekle
        const smartSuggestions = response.data.suggestions.map((suggestion: any) => suggestion.title);
        setSuggestions(prev => [...smartSuggestions, ...prev.slice(0, 4)]);
      }
    } catch (error) {
      console.error('Akıllı öneriler yükleme hatası:', error);
    }
  };

  // Sohbet geçmişini localStorage'a kaydet
  const saveSessionsToStorage = (newSessions: ChatSession[]) => {
    if (userId) {
      localStorage.setItem(`ai_chat_sessions_${userId}`, JSON.stringify(newSessions));
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);



  // Sohbet sil
  const deleteSession = (sessionId: string) => {
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    saveSessionsToStorage(updatedSessions);
    if (currentSession?.id === sessionId) {
      setCurrentSession(updatedSessions[0] || null);
    }
  };

  // Sohbet başlığını güncelle
  const updateSessionTitle = (sessionId: string, title: string) => {
    const updatedSessions = sessions.map(s => 
      s.id === sessionId ? { ...s, title } : s
    );
    setSessions(updatedSessions);
    saveSessionsToStorage(updatedSessions);
    if (currentSession?.id === sessionId) {
      setCurrentSession(prev => prev ? { ...prev, title } : null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !userId || !currentSession) return;

    const timestamp = Date.now();
    const userMessage: Message = {
      id: timestamp,
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    // İlk mesajsa başlığı güncelle
    if (currentSession.messages.length === 0) {
      const title = input.length > 30 ? input.substring(0, 30) + '...' : input;
      updateSessionTitle(currentSession.id, title);
    }

    // Mesajı ekle
    const updatedSession = {
      ...currentSession,
      messages: [...currentSession.messages, userMessage]
    };
    setCurrentSession(updatedSession);
    const updatedSessions = sessions.map(s => s.id === currentSession.id ? updatedSession : s);
    setSessions(updatedSessions);
    saveSessionsToStorage(updatedSessions);
    
    setInput('');
    setIsLoading(true);

    // Loading mesajı ekle
    const loadingMessage: Message = {
      id: timestamp + 0.5,
      text: '...',
      sender: 'assistant',
      timestamp: new Date()
    };
    
    const sessionWithLoading = {
      ...updatedSession,
      messages: [...updatedSession.messages, loadingMessage]
    };
    setCurrentSession(sessionWithLoading);
    const sessionsWithLoading = updatedSessions.map(s => s.id === currentSession.id ? sessionWithLoading : s);
    setSessions(sessionsWithLoading);
    saveSessionsToStorage(sessionsWithLoading);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token bulunamadı');
      }

      // Sohbet geçmişini backend'e gönder
      const conversationHistory = currentSession.messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const response = await axios.post(
        'http://localhost:3001/api/chatbot',
        {
          message: input,
          role: 'ai_chat',
          conversation_history: conversationHistory
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data) {
        // Loading mesajını kaldır ve gerçek yanıtı ekle
        const assistantMessage: Message = {
          id: timestamp + 1,
          text: response.data.response,
          sender: 'assistant',
          timestamp: new Date()
        };

        const finalSession = {
          ...sessionWithLoading,
          messages: sessionWithLoading.messages.filter(msg => msg.text !== '...').concat(assistantMessage)
        };
        
        setCurrentSession(finalSession);
        const finalSessions = sessionsWithLoading.map(s => s.id === currentSession.id ? finalSession : s);
        setSessions(finalSessions);
        saveSessionsToStorage(finalSessions);
      }
    } catch (error: any) {
      console.error('AI Chat error:', error);
      // Loading mesajını kaldır ve hata mesajını ekle
      const errorMessage: Message = {
        id: timestamp + 2,
        text: error.response?.data?.message || 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        sender: 'assistant',
        timestamp: new Date()
      };

      const errorSession = {
        ...sessionWithLoading,
        messages: sessionWithLoading.messages.filter(msg => msg.text !== '...').concat(errorMessage)
      };
      
      setCurrentSession(errorSession);
      const errorSessions = sessionsWithLoading.map(s => s.id === currentSession.id ? errorSession : s);
      setSessions(errorSessions);
      saveSessionsToStorage(errorSessions);
      toast.error(error.response?.data?.message || 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = (msg: Message) => {
    // Loading mesajı için özel render
    if (msg.text === '...') {
      return (
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      );
    }

    return msg.text;
  };



  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link
                href={userRole === 'admin' ? '/admin' : '/employee'}
                className="flex items-center space-x-1 sm:space-x-2 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              >
                <FiArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-lg font-medium">Geri Dön</span>
              </Link>
              <div className="w-px h-6 sm:h-8 bg-gray-300 dark:bg-gray-600"></div>
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm sm:text-lg">AI</span>
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">AI Asistan</h1>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Yapay Zeka ile Sohbet</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button className="p-1.5 sm:p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors">
                <FiSettings className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              {modelStatus && (
                <div className={`hidden sm:flex items-center space-x-2 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium ${
                  modelStatus.status === 'active' 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    modelStatus.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span>{modelStatus.provider}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)]">
            {/* Ana Alan - Chat */}
            <div className="flex-1 flex flex-col">
              {currentSession ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                      {currentSession.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {currentSession.messages.length} mesaj
                    </p>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                    {currentSession.messages.length === 0 && (
                      <div className="text-center text-gray-500 dark:text-gray-400 mt-8 sm:mt-12">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg">
                          <span className="text-white font-bold text-xl sm:text-2xl">AI</span>
                        </div>
                        <p className="text-lg sm:text-xl font-medium mb-2">Merhaba! Size nasıl yardımcı olabilirim?</p>
                        <p className="text-sm sm:text-base">Herhangi bir konuda soru sorabilirsiniz.</p>
                      </div>
                    )}
                    
                    {currentSession.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 sm:px-6 py-3 sm:py-4 shadow-sm ${
                            msg.sender === 'user'
                              ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                          }`}
                          style={{ whiteSpace: 'pre-wrap' }}
                        >
                          <div className="text-sm sm:text-base leading-relaxed">
                            {renderMessage(msg)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Alanı */}
                  <div className="flex-shrink-0 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700">
                    {/* Önerilen Sorular */}
                    {suggestions.length > 0 && (
                      <div className="mb-3 sm:mb-4">
                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Önerilen Sorular:
                        </div>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {suggestions.slice(0, 6).map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => setInput(suggestion)}
                              className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-gray-600 transition-colors duration-200"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSubmit}>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Mesajınızı yazın..."
                          className="flex-1 p-2.5 sm:p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                          disabled={isLoading}
                        />
                        <button
                          type="submit"
                          disabled={!input.trim() || isLoading}
                          className="px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base"
                        >
                          {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          )}
                          <span className="hidden sm:inline">Gönder</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <span className="text-white font-bold text-2xl">AI</span>
                    </div>
                    <p className="text-xl font-medium mb-2">Merhaba! Size nasıl yardımcı olabilirim?</p>
                    <p className="text-base">Herhangi bir konuda soru sorabilirsiniz.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 