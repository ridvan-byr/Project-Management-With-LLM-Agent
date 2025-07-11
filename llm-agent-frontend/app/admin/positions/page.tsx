'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import Link from 'next/link';
import AdminHeader from '../../components/AdminHeader';

interface Role {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  position: string | null;
}

export default function RolesPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee'
  });
  const [roleFormData, setRoleFormData] = useState({ name: '' });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, []);

  const handleLogout = () => {
    logout();
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Roller yüklenirken bir hata oluştu');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/roles/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Kullanıcılar yüklenirken bir hata oluştu');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Kullanıcılar yüklenirken bir hata oluştu');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole) {
      await handleUpdateRole(e);
    } else {
      await handleAddRole(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu rolü silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/roles/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast.success('Rol silindi');
        fetchRoles();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Rol silinirken bir hata oluştu');
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Rol silinirken bir hata oluştu');
    }
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setRoleFormData({ name: role.name });
    setIsModalOpen(true);
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast.error('Lütfen çalışan ve pozisyon seçin');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/roles/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          userId: selectedUser.id, 
          roleId: selectedRole 
        })
      });

      if (response.ok) {
        toast.success('Pozisyon başarıyla atandı');
        fetchUsers();
        setIsAssignModalOpen(false);
        setSelectedUser(null);
        setSelectedRole(null);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Pozisyon atanırken bir hata oluştu');
      }
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error('Pozisyon atanırken bir hata oluştu');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3001/api/users', formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.status === 201) {
        toast.success('Çalışan başarıyla eklendi');
        setIsAddEmployeeModalOpen(false);
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'employee'
        });
        fetchUsers();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Çalışan eklenirken bir hata oluştu');
    }
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3001/api/roles', roleFormData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.status === 201) {
        toast.success('Rol başarıyla eklendi');
        setIsModalOpen(false);
        setRoleFormData({ name: '' });
        fetchRoles();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Rol eklenirken bir hata oluştu');
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    try {
      const response = await axios.put(`http://localhost:3001/api/roles/${editingRole.id}`, roleFormData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.status === 200) {
        toast.success('Rol başarıyla güncellendi');
        setIsModalOpen(false);
        setEditingRole(null);
        setRoleFormData({ name: '' });
        fetchRoles();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Rol güncellenirken bir hata oluştu');
    }
  };

  const handleEditEmployee = (user: User) => {
    setEditingEmployee(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role
    });
    setIsEditEmployeeModalOpen(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      const response = await axios.put(`http://localhost:3001/api/users/${editingEmployee.id}`, formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.status === 200) {
        toast.success('Çalışan başarıyla güncellendi');
        setIsEditEmployeeModalOpen(false);
        setEditingEmployee(null);
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'employee'
        });
        fetchUsers();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Çalışan güncellenirken bir hata oluştu');
    }
  };

  const handleDeleteEmployee = async (userId: number) => {
    if (!confirm('Bu çalışanı silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await axios.delete(`http://localhost:3001/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.status === 200) {
        toast.success('Çalışan başarıyla silindi');
        fetchUsers();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Çalışan silinirken bir hata oluştu');
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-white transition-colors duration-300">
      {/* Header */}
      <AdminHeader active="positions" onMeetingClick={() => router.push('/admin/meetings')} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Roller Bölümü */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pozisyonlar</h2>
            <div className="flex space-x-4">
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Pozisyon Ata
              </button>
              <button
                onClick={() => {
                  setEditingRole(null);
                  setRoleFormData({ name: '' });
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Yeni Pozisyon Ekle
              </button>
            </div>
          </div>

          <div className="bg-gray-100/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
              <thead className="bg-gray-200 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Pozisyon Adı
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-100/80 dark:bg-gray-800/50 divide-y divide-gray-300 dark:divide-gray-700">
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {role.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                      <button
                        onClick={() => handleEdit(role)}
                        className="text-blue-400 hover:text-blue-300 mr-4"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(role.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Çalışanlar Bölümü */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Çalışanlar</h2>
            <button
              onClick={() => setIsAddEmployeeModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Yeni Çalışan Ekle
            </button>
          </div>
          <div className="bg-gray-100/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
              <thead className="bg-gray-200 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Çalışan Adı
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    E-posta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Pozisyon
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-100/80 dark:bg-gray-800/50 divide-y divide-gray-300 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {user.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {user.position || 'Pozisyon atanmamış'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                      <button
                        onClick={() => handleEditEmployee(user)}
                        className="text-blue-400 hover:text-blue-300 mr-4"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(user.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Rol Ekleme/Düzenleme Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-6 rounded-lg w-full max-w-md transition-colors duration-300">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingRole ? 'Pozisyon Düzenle' : 'Yeni Pozisyon Ekle'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Pozisyon Adı</label>
                <input
                  type="text"
                  value={roleFormData.name}
                  onChange={(e) => setRoleFormData({ name: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingRole(null);
                    setRoleFormData({ name: '' });
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingRole ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rol Atama Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 backdrop-blur-sm rounded-lg p-8 w-full max-w-md transition-colors duration-300">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Pozisyon Ata</h2>
            <div className="space-y-6">
              {/* Çalışan Seçimi */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Çalışan Seçin
                </label>
                <select
                  value={selectedUser?.id || ''}
                  onChange={(e) => {
                    const user = users.find(u => u.id === Number(e.target.value));
                    setSelectedUser(user || null);
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
                >
                  <option value="">Çalışan Seçin</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {user.position ? `(${user.position})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rol Seçimi */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Pozisyon Seçin
                </label>
                <select
                  value={selectedRole || ''}
                  onChange={(e) => setSelectedRole(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
                >
                  <option value="">Pozisyon Seçin</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Butonlar */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setIsAssignModalOpen(false);
                    setSelectedUser(null);
                    setSelectedRole(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  İptal
                </button>
                <button
                  onClick={handleAssignRole}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Pozisyon Ata
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Yeni Çalışan Ekleme Modalı */}
      {isAddEmployeeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-6 rounded-lg w-full max-w-md transition-colors duration-300">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Yeni Çalışan Ekle</h2>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Ad Soyad</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Şifre</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddEmployeeModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Çalışan Düzenleme Modalı */}
      {isEditEmployeeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-6 rounded-lg w-full max-w-md transition-colors duration-300">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Çalışan Düzenle
              </h2>
              <form onSubmit={handleUpdateEmployee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Ad Soyad</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Şifre (Boş bırakılırsa değişmez)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditEmployeeModalOpen(false);
                      setEditingEmployee(null);
                      setFormData({
                        name: '',
                        email: '',
                        password: '',
                        role: 'employee'
                      });
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
       
      )}
    </div>
  );
} 