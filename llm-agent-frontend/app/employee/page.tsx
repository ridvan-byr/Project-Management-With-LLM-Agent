'use client';

import { useState, useEffect, useRef, useContext } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import MessagePanel from '../components/MessagePanel';
import { CircularProgress } from '@mui/material';
import Link from 'next/link';
import NotificationBell from '../components/NotificationBell';
import ChannelsPanel from '../components/ChannelsPanel';
import KanbanBoard from '../components/KanbanBoard';
import { LabelContext, LabelType } from '../components/KanbanBoard';

export const useLabelContext = () => useContext(LabelContext);

import EmployeeHeader from '../components/EmployeeHeader';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  assigned_to: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  category: string;
  assigned_to_name?: string;
  completed?: boolean;
}

export default function EmployeePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const isLoading = tasksLoading || userLoading;
  const router = useRouter();
  const { logout, refreshToken, isAuthenticated, userRole } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [showMessaging, setShowMessaging] = useState(false);
  const [selectedDirectUser, setSelectedDirectUser] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [labels, setLabels] = useState<LabelType[]>([]);
  const addLabel = (label: LabelType) => setLabels(prev => [...prev, label]);
  const getLabelById = (id: string) => labels.find(l => l.id === id);

  const [viewMode, setViewMode] = useState<'kanban'>('kanban');
  const defaultStatuses = ['Yapılacaklar', 'Yapılıyor', 'Tamamlandı'];
  const [statuses, setStatuses] = useState<string[]>([...defaultStatuses]);
  const [panelWidth, setPanelWidth] = useState(440);
  const resizing = useRef(false);
  const [showMembersPanel, setShowMembersPanel] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || userRole !== 'employee') {
      router.push('/login');
      return;
    }
    refreshToken()
      .then(() => {
        fetchTasks();
        fetchMe();
        fetchUsers();
      })
      .catch((error) => {
        console.error('Token yenileme hatası:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        router.push('/login');
      });
  }, [isAuthenticated, userRole, router]);

  // URL parametresini kontrol et
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'messages') {
      setShowMessaging(true);
    }
  }, []);

  useEffect(() => {
    const taskStatuses = Array.from(new Set(tasks.map(t => t.status)));
    setStatuses(prev => {
      const merged = Array.from(new Set([...defaultStatuses, ...prev, ...taskStatuses]));
      return merged;
    });
  }, [tasks]);

  const testBackendConnection = async () => {
    try {
      const response = await axios.get('http://localhost:3001/health', { timeout: 5000 });
      console.log('Backend bağlantısı başarılı:', response.data);
      return true;
    } catch (error) {
      console.error('Backend bağlantısı başarısız:', error);
      return false;
    }
  };

  const fetchTasks = async () => {
    try {
      setTasksLoading(true);
      
      // Önce backend bağlantısını test et
      const isBackendConnected = await testBackendConnection();
      if (!isBackendConnected) {
        toast.error('Backend sunucusuna bağlanılamıyor. Lütfen sunucunun çalıştığından emin olun.');
        setTasksLoading(false);
        return;
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      const { data } = await axios.get('http://localhost:3001/api/tasks', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 saniye timeout
      });
      setTasks(data);
    } catch (error: any) {
      console.error('Görevler yüklenirken hata:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        router.push('/login');
      } else {
        toast.error('Görevler yüklenirken bir hata oluştu');
      }
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchMe = async () => {
    try {
      setUserLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      const res = await axios.get('http://localhost:3001/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });
      setUser(res.data);
    } catch (error: any) {
      console.error('Kullanıcı bilgileri yüklenirken hata:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        router.push('/login');
      }
    } finally {
      setUserLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      const res = await axios.get('http://localhost:3001/api/users', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });
      setUsers(res.data);
    } catch (error: any) {
      console.error('Kullanıcılar yüklenirken hata:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        router.push('/login');
      }
    }
  };

  const updateTaskStatus = async (taskId: number, newStatus: string) => {
    const token = localStorage.getItem('token');
    
    // Status değiştiğinde completed alanını da güncelle
    const updates: any = { status: newStatus };
    
    // Eğer yeni status "Tamamlandı" ise completed'ı true yap
    if (newStatus === 'Tamamlandı' || newStatus === 'completed') {
      updates.completed = true;
    } else {
      // Eğer başka bir status'a taşındıysa completed'ı false yap
      updates.completed = false;
    }
    
    // Backend'e gönder (async olarak)
    axios.put(
      `http://localhost:3001/api/tasks/${taskId}`,
      updates,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(response => {
      // Backend'den güncellenmiş veriyi al ve state'i güncelle
      if (response.data.updatedTask) {
        setTasks(prevTasks => prevTasks.map(task =>
          task.id === taskId ? { ...task, ...response.data.updatedTask } : task
        ));
      }
    }).catch(error => {
      console.error('Task status güncelleme hatası:', error);
      toast.error('Görev durumu güncellenemedi');
      fetchTasks(); // Hata durumunda orijinal veriyi geri yükle
    });
  };

  const updateTaskCompleted = async (taskId: number, completed: boolean) => {
    const token = localStorage.getItem('token');
    
    // Backend'e gönder (async olarak)
    axios.put(
      `http://localhost:3001/api/tasks/${taskId}`,
      { completed },
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(response => {
      // Backend'den güncellenmiş veriyi al ve state'i güncelle
      if (response.data.updatedTask) {
        setTasks(prevTasks => prevTasks.map(task =>
          task.id === taskId ? { ...task, ...response.data.updatedTask } : task
        ));
      }
    }).catch(error => {
      console.error('Task completed güncelleme hatası:', error);
      toast.error('Görev durumu güncellenemedi');
      // Hata durumunda orijinal veriyi geri yükle
      fetchTasks();
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Beklemede';
      case 'in_progress': return 'Devam Ediyor';
      case 'completed': 
      case 'Tamamlandı': return 'Tamamlandı';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'in_progress': return 'bg-blue-500';
      case 'completed': 
      case 'Tamamlandı': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // tasks dizisinde assigned_to_name yoksa, user listesinden veya user state'inden bul
  const getAssignedToName = (task: Task) => {
    if (task.assigned_to_name) return task.assigned_to_name;
    if (user && task.assigned_to === user.id) return user.name;
    // Kullanıcı listesinden bul
    const assignedUser = users.find(u => u.id === task.assigned_to);
    if (assignedUser) return assignedUser.name;
    return '';
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Tüm görevleri göster, ama sadece kendine atananları taşıyabilsin
  const allTasks = tasks.map(t => ({ ...t, assigned_to_name: getAssignedToName(t) }));

  // Task güncelleme fonksiyonu
  const handleTaskUpdate = (taskId: number, updates: Partial<any>) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Completed alanı güncelleniyorsa sadece kendi görevini güncelleyebilir
    if (updates.completed !== undefined && task.assigned_to !== user?.id) {
      return;
    }
    
    // Status güncellemesi için sadece kendi görevini güncelleyebilir
    if (updates.status && task.assigned_to !== user?.id) {
      return;
    }
    
    // Optimistic update - sadece status değişikliği için (completed_at backend'den gelecek)
    if (updates.status) {
      setTasks(prevTasks => prevTasks.map(t => {
        if (t.id === taskId) {
          const updatedTask = { ...t, status: updates.status! };
          
          // Status değişikliğinde completed alanını güncelle
          if (updates.status === 'Tamamlandı' || updates.status === 'completed') {
            updatedTask.completed = true;
            // completed_at backend'den gelecek, şimdilik undefined bırak
          } else {
            updatedTask.completed = false;
            updatedTask.completed_at = undefined;
          }
          
          return updatedTask;
        }
        return t;
      }));
    }
    
    // Eğer completed alanı güncelleniyorsa, direkt backend'e gönder
    if (updates.completed !== undefined) {
      updateTaskCompleted(taskId, updates.completed);
    } else if (updates.status) {
      // Status güncellemesi için mevcut fonksiyonu kullan
      updateTaskStatus(taskId, updates.status);
    }
  };

  // Sol paneli büyütüp küçültme
  const handleMouseDown = (e: React.MouseEvent) => {
    resizing.current = true;
    document.body.style.cursor = 'ew-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing.current) {
        setPanelWidth(prev => {
          const newWidth = Math.min(Math.max(e.clientX, 220), 500);
          return newWidth;
        });
      }
    };
    const handleMouseUp = () => {
      resizing.current = false;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          <div className="text-white/80 text-lg">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <LabelContext.Provider value={{ labels, addLabel, getLabelById }}>
      <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-white transition-colors duration-300">
        {/* Header */}
        <EmployeeHeader
          title="Çalışan Paneli"
          active={showMessaging ? 'messages' : 'tasks'}
          onTabChange={tab => {
            if (tab === 'messages') {
              setShowMessaging(true);
              router.push('/employee?tab=messages');
            } else if (tab === 'tasks') {
              setShowMessaging(false);
              router.push('/employee');
            }
          }}
          onMeetingClick={() => router.push('/employee/meetings')}
          onLogout={handleLogout}
        />
        <main className="h-[calc(96vh-4rem)] p-2 bg-transparent dark:bg-transparent dark:text-white transition-colors duration-300">
          {!showMessaging ? (
            <div className="w-full bg-gray-100 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 rounded-[2.5rem] border-4 border-gray-300 dark:border-gray-700 p-8 flex flex-col shadow-2xl min-h-[60vh] transition-colors duration-300">
              <div className="flex justify-between items-center mb-12 flex-shrink-0">
                <div className="flex items-center space-x-8">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Görev Yönetimi</h2>
                </div>
              </div>
              {/* Task Content */}
              <div>
                <KanbanBoard
                  tasks={allTasks}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskDelete={() => {}}
                  onStatusAdd={() => {}}
                  onStatusDelete={() => {}}
                  statuses={statuses}
                  currentUserId={user?.id}
                  isEmployeeView={true}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full">
              <div
                style={{
                  width: panelWidth,
                  minWidth: 340,
                  maxWidth: 700,
                  height: '100%',
                  transition: 'width 0.15s',
                  position: 'relative',
                  zIndex: 10,
                }}
              >
                <ChannelsPanel
                  onSelectChannel={channel => {
                    setSelectedChannel(channel);
                    setSelectedDirectUser(null);
                    setShowMembersPanel(true);
                  }}
                  onSelectDirectMessage={user => {
                    setSelectedDirectUser(user);
                    setSelectedChannel(null);
                    setShowMembersPanel(false);
                  }}
                  selectedChannelId={selectedChannel?.id || null}
                  selectedDirectUserId={selectedDirectUser?.id || null}
                  width={panelWidth}
                />
                {/* Kenara gelince büyüt/küçült başlat */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 8,
                    height: '100%',
                    cursor: 'ew-resize',
                    zIndex: 20,
                    background: 'transparent',
                  }}
                  onMouseDown={handleMouseDown}
                  className="group"
                >
                  <div className="w-full h-full transition-all group-hover:bg-blue-100/40 group-hover:shadow-lg dark:group-hover:bg-blue-900/30 rounded-r-xl" />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
                <MessagePanel
                  channelId={selectedChannel?.id || null}
                  channelName={selectedChannel?.name || ''}
                  directUserId={selectedDirectUser?.id || null}
                  directUserName={selectedDirectUser?.name || ''}
                  userRole={userRole || 'employee'}
                  {...{showMembersPanel, canAddMembers: false}}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </LabelContext.Provider>
  );
} 