'use client';

import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import MessagePanel from '../components/MessagePanel';
import TaskModal from '../components/TaskModal';
import Link from 'next/link';
import NotificationBell from '../components/NotificationBell';
import MeetingModal from '../components/MeetingModal';
import ChannelsPanel from '../components/ChannelsPanel';
import KanbanBoard from '../components/KanbanBoard';
import AdminHeader from '../components/AdminHeader';
import { CalendarMonth } from '@mui/icons-material';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { LabelContext, LabelType } from '../components/KanbanBoard';

dayjs.extend(utc);
dayjs.extend(timezone);

export const useLabelContext = () => useContext(LabelContext);

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  assigned_to: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  assigned_to_name: string;
  category: string;
  priority?: string;
  deadline?: string;
  labels?: { id: string; name: string; color: string }[];
  completed?: boolean;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  position?: string;
  expertise?: string[];
  skills?: string[];
  experience?: number;
}

export default function AdminPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const router = useRouter();
  const { logout, refreshToken, isAuthenticated, userRole } = useAuth();
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTask, setEditTask] = useState<Partial<Task>>({});
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [showMessaging, setShowMessaging] = useState(false);
  const defaultStatuses = ['Yapılacaklar', 'Yapılıyor', 'Tamamlandı'];
  const [statuses, setStatuses] = useState<string[]>([...defaultStatuses]);
  const [labels, setLabels] = useState<LabelType[]>([]);
  const addLabel = (label: LabelType) => setLabels(prev => [...prev, label]);
  const getLabelById = (id: string) => labels.find(l => l.id === id);

  useEffect(() => {
    if (!isAuthenticated || userRole !== 'admin') {
      router.push('/login');
      return;
    }

    refreshToken()
      .then(() => {
        fetchTasks();
        fetchUsers();
      })
      .catch((error) => {
        console.error('Token yenileme hatası:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        router.push('/login');
      });
  }, [isAuthenticated, userRole, router]);

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
      setIsLoading(true);
      
      // Önce backend bağlantısını test et
      const isBackendConnected = await testBackendConnection();
      if (!isBackendConnected) {
        toast.error('Backend sunucusuna bağlanılamıyor. Lütfen sunucunun çalıştığından emin olun.');
        setIsLoading(false);
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
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      const { data } = await axios.get('http://localhost:3001/api/users', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      setUsers(data.filter((user: User) => user.role === 'employee'));
    } catch (error: any) {
      console.error('Kullanıcılar yüklenirken hata:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        router.push('/login');
      }
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Bu görevi silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const response = await axios.delete(`http://localhost:3001/api/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.status === 200) {
        toast.success('Görev başarıyla silindi');
        fetchTasks();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Görev silinirken bir hata oluştu');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleEditClick = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTask({
      ...task,
      assigned_to: task.assigned_to
    });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditTask(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSave = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:3001/api/tasks/${editingTaskId}`,
        {
          title: editTask.title,
          description: editTask.description,
          assigned_to: editTask.assigned_to ? Number(editTask.assigned_to) : null,
          status: editTask.status,
          priority: editTask.priority,
          deadline: editTask.deadline,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Görev güncellendi');
      setEditingTaskId(null);
      setEditTask({});
      fetchTasks();
    } catch (error) {
      console.error('Görev güncelleme hatası:', error);
      toast.error('Görev güncellenemedi');
    }
  };

  const handleEditCancel = () => {
    setEditingTaskId(null);
    setEditTask({});
  };

  const handleTaskUpdate = async (taskId: number, updates: Partial<Task>) => {
    let updatesToSend = { ...updates } as Partial<Task & { labels?: any[] }>;
    if (Array.isArray(updatesToSend.labels) && updatesToSend.labels.length > 0 && typeof updatesToSend.labels[0] === 'string') {
      updatesToSend.labels = (updatesToSend.labels as string[]).map(id => {
        const label = ((tasks.find(t => t.id === taskId)?.labels) || []).find((l: any) => l.id === id);
        return label || { id, name: id, color: '#2980b9' };
      });
    }
    
    // Optimistic update - sadece status değişikliği için (completed_at backend'den gelecek)
    if (updates.status) {
      setTasks(prevTasks => prevTasks.map(task => {
        if (task.id === taskId) {
          const updatedTask = { ...task, status: updates.status! };
          
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
        return task;
      }));
    }
    
    // Backend'e gönder (async olarak)
    const token = localStorage.getItem('token');
    axios.put(`http://localhost:3001/api/tasks/${taskId}`, updatesToSend, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(response => {
      // Backend'den güncellenmiş veriyi al ve state'i güncelle
      if (response.data.updatedTask) {
        setTasks(prevTasks => prevTasks.map(task =>
          task.id === taskId ? { ...task, ...response.data.updatedTask } : task
        ));
      }
    }).catch(error => {
      console.error('Görev güncelleme hatası:', error);
      toast.error('Görev güncellenemedi');
      
      // Hata durumunda orijinal veriyi geri yükle
      fetchTasks();
    });
  };

  const handleStatusAdd = async (statusName: string) => {
    if (!statuses.includes(statusName)) {
      setStatuses(prev => [...prev, statusName]);
      toast.success(`Yeni durum eklendi: ${statusName}`);
    } else {
      toast.error('Bu durum zaten mevcut!');
    }
  };

  const handleStatusDelete = async (statusName: string) => {
    if (defaultStatuses.includes(statusName)) {
      toast.error('Varsayılan durumlar silinemez!');
      return;
    }
    setStatuses(prev => prev.filter(s => s !== statusName));
    toast.success(`Durum silindi: ${statusName}`);
  };

  const handleTaskOrderChange = (status: string, newOrder: Task[]) => {
    setTasks(prevTasks => {
      const otherTasks = prevTasks.filter(t => t.status !== status);
      return [...otherTasks, ...newOrder];
    });
  };

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
        <AdminHeader active="tasks" onMeetingClick={() => router.push('/admin/meetings')} />
        <main className="w-full max-w-none mx-auto px-0 sm:px-4 lg:px-8 py-5">
          <div className="w-full bg-gray-100 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 rounded-[2.5rem] border-4 border-gray-300 dark:border-gray-700 p-8 flex flex-col shadow-2xl min-h-[60vh] transition-colors duration-300">
            <div className="flex justify-between items-center mb-12 flex-shrink-0">
              <div className="flex items-center space-x-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Görev Yönetimi</h2>
              </div>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-2xl font-semibold text-xl hover:from-blue-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-200 dark:focus:ring-offset-gray-900 transition-all transform hover:scale-[1.02] shadow-2xl"
              >
                Yeni Görev
              </button>
            </div>
            <KanbanBoard
              tasks={tasks}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleDeleteTask}
              onStatusAdd={handleStatusAdd}
              onStatusDelete={handleStatusDelete}
              statuses={statuses}
              onTaskOrderChange={handleTaskOrderChange}
              currentUserId={undefined} // Admin tüm görevleri taşıyabilir
              isEmployeeView={false}
            />
          </div>
        </main>
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onTaskCreated={() => {
            fetchTasks();
            setIsTaskModalOpen(false);
          }}
        />
      </div>
    </LabelContext.Provider>
  );
} 