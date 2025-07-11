'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  position?: string;
}

interface SuggestedEmployee {
  id: number;
  name: string;
  position: string;
  explanation: string;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
}

export default function TaskModal({ isOpen, onClose, onTaskCreated }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedEmployee, setSuggestedEmployee] = useState<SuggestedEmployee | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('');

  // Form alanlarını sıfırla
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssignedTo('');
    setSuggestedEmployee(null);
    setIsSuggesting(false);
    setStatusMessage('');
    setDeadline('');
    setPriority('');
  };

  // Modal kapandığında formu sıfırla
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get('http://localhost:3001/api/users');
      // Sadece çalışanları (employee rolündeki kullanıcıları) filtrele
      const employees = data.filter((user: User) => user.role === 'employee');
      setUsers(employees);
    } catch (error) {
      toast.error('Kullanıcılar yüklenirken bir hata oluştu');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title,
          description,
          assigned_to: assignedTo,
          deadline,
          priority,
        })
      });

      if (!response.ok) {
        throw new Error('Görev oluşturulamadı');
      }

      const data = await response.json();
      if (data.suggestedEmployee) {
        setSuggestedEmployee(data.suggestedEmployee);
        toast.success('Görev oluşturuldu ve önerilen çalışan belirlendi');
      } else {
        toast.success('Görev oluşturuldu');
      }
      onTaskCreated();
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Görev oluşturulurken bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggest = async () => {
    if (!title) return;
    setIsSuggesting(true);
    setStatusMessage('Açıklama yazılıyor...');
    try {
      const response = await fetch('http://localhost:3001/api/tasks/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ title })
      });
      if (!response.ok) {
        throw new Error('Açıklama önerisi alınamadı');
      }
      const data = await response.json();
      setDescription(data.suggestion);
      setStatusMessage('');
    } catch (error) {
      console.error('Error getting suggestion:', error);
      toast.error('Açıklama önerisi alınırken bir hata oluştu');
    } finally {
      setIsSuggesting(false);
      setStatusMessage('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${isOpen ? 'block' : 'hidden'}`}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        </div>

        <div className="inline-block align-bottom bg-white dark:bg-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-300 dark:border-gray-700 transition-colors duration-300">
          <div className="px-4 sm:px-6 py-4">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-4">Yeni Görev Oluştur</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="title" className="block text-sm sm:text-base font-medium text-gray-900 dark:text-white mb-2">
                  Görev Başlığı
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base transition-colors duration-300"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="description" className="block text-sm sm:text-base font-medium text-gray-900 dark:text-white mb-2">
                  Açıklama
                </label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base transition-colors duration-300"
                    rows={4}
                    required
                  />
                  <div className="flex flex-row sm:flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleSuggest}
                      disabled={isSuggesting || !title}
                      className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-400 to-purple-400 dark:from-blue-500 dark:to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 h-fit mt-1 transition-all transform hover:scale-[1.02] text-sm sm:text-base font-medium"
                    >
                      {isSuggesting ? 'Bekleyin...' : 'Asistanla Açıklama'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!title || !description) return;
                        setIsSuggesting(true);
                        setStatusMessage('Çalışan bulunuyor...');
                        try {
                          const employeeResponse = await fetch('http://localhost:3001/api/tasks/suggest-employee', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify({ title, description }),
                          });
                          if (employeeResponse.ok) {
                            const employeeData = await employeeResponse.json();
                            console.log('Çalışan önerisi verisi:', employeeData);
                            if (employeeData.suggestedEmployee) {
                              setSuggestedEmployee(employeeData.suggestedEmployee);
                              toast.success('Çalışan önerisi alındı!');
                            } else {
                              toast.error('Çalışan önerisi bulunamadı');
                            }
                          } else {
                            const errorData = await employeeResponse.json();
                            toast.error(errorData.message || 'Çalışan önerisi alınamadı');
                          }
                        } catch (error) {
                          console.error('Çalışan önerisi hatası:', error);
                          toast.error('Çalışan önerisi alınırken bir hata oluştu');
                        } finally {
                          setIsSuggesting(false);
                          setStatusMessage('');
                        }
                      }}
                      disabled={isSuggesting || !title || !description}
                      className="px-6 py-3 bg-gradient-to-r from-green-400 to-blue-400 dark:from-green-600 dark:to-blue-600 text-white rounded-lg hover:from-green-600 hover:to-blue-600 disabled:opacity-50 h-fit transition-all transform hover:scale-[1.02] text-base font-medium"
                    >
                      {isSuggesting ? 'Bekleyin...' : 'Çalışan Öner'}
                    </button>
                  </div>
                </div>
                {statusMessage && (
                  <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                    {statusMessage}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor="assignedTo" className="block text-base font-medium text-gray-900 dark:text-white mb-2">
                  Atanan Çalışan
                </label>
                <select
                  id="assignedTo"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 text-base transition-colors duration-300"
                  required
                >
                  <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-2">Çalışan Seçin</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-2">
                      {user.name}
                      {suggestedEmployee && suggestedEmployee.id === user.id && ' (Önerilen)'}
                    </option>
                  ))}
                </select>
                {suggestedEmployee && (
                  <div className="mt-2 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/50 dark:to-indigo-900/50 rounded-lg border border-blue-200 dark:border-blue-600 shadow-sm">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {suggestedEmployee.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                          Önerilen Çalışan: {suggestedEmployee.name}
                          {suggestedEmployee.position && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400 font-normal">
                              ({suggestedEmployee.position})
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-2 leading-relaxed">
                          {suggestedEmployee.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor="deadline" className="block text-base font-medium text-gray-900 dark:text-white mb-2">
                  Son Teslim Tarihi
                </label>
                <input
                  type="datetime-local"
                  id="deadline"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 text-base transition-colors duration-300"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="priority" className="block text-base font-medium text-gray-900 dark:text-white mb-2">
                  Öncelik
                </label>
                <select
                  id="priority"
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 text-base transition-colors duration-300"
                >
                  <option value="">Öncelik Yok</option>
                  <option value="low">Düşük</option>
                  <option value="medium">Orta</option>
                  <option value="high">Yüksek</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:focus:ring-gray-500"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                >
                  {isLoading ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 