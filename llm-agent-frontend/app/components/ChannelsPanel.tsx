import React, { useEffect, useState, useRef } from 'react';
import { FaHashtag, FaUser, FaPlus, FaTrash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

interface Channel {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  role: string;
}

interface ChannelsPanelProps {
  onSelectChannel: (channel: Channel) => void;
  onSelectDirectMessage: (user: User) => void;
  selectedChannelId: number | null;
  selectedDirectUserId: number | null;
  width?: number;
  onUserContextMenu?: (e: React.MouseEvent, user: User) => void;
  onUserRemove?: (user: User) => void;
  onDeleteAllMessages?: (userId: number) => void;
}

const ChannelsPanel: React.FC<ChannelsPanelProps> = ({ onSelectChannel, onSelectDirectMessage, selectedChannelId, selectedDirectUserId, width, onUserContextMenu, onUserRemove, onDeleteAllMessages }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const { userId, userRole } = useAuth();
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [addingChannel, setAddingChannel] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; userId: number; userName: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3001/api/channels', {
          headers: { Authorization: `Bearer ${token}` }
        });
        let data = await res.json();
        // Eğer çalışan ise sadece üye olduğu kanalları göster
        if (userRole === 'employee') {
          // Her kanal için üyeleri fetch et
          const memberChannels: Channel[] = [];
          for (const ch of data) {
            const membersRes = await fetch(`http://localhost:3001/api/channels/${ch.id}/members`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const members = await membersRes.json();
            if (members.some((m: any) => m.user_id === userId)) {
              memberChannels.push(ch);
            }
          }
          data = memberChannels;
        }
        setChannels(data);
      } catch {}
    };
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3001/api/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setUsers(data.filter((u: User) => u.id !== userId));
      } catch {}
    };
    fetchChannels();
    fetchUsers();
  }, [userId, userRole]);

  // Context menu'yu kapatmak için click event listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  const handleAddChannel = async () => {
    if (!newChannelName.trim()) return;
    setAddingChannel(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3001/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newChannelName })
      });
      setNewChannelName('');
      setShowAddChannel(false);
      // Kanalları tekrar yükle
      // fetchChannels fonksiyonu burada yok, useEffect tetiklenmesi için dummy state kullanılabilir veya props ile callback alınabilir.
      window.location.reload(); // Basit çözüm: sayfayı yenile
    } catch {
      // Hata yönetimi eklenebilir
    } finally {
      setAddingChannel(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, user: User) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      userId: user.id,
      userName: user.name
    });
  };

  const handleDeleteMessages = () => {
    if (contextMenu && onDeleteAllMessages) {
      onDeleteAllMessages(contextMenu.userId);
      setContextMenu(null);
    }
  };

  return (
    <aside
      className="h-full bg-gradient-to-b from-white via-gray-50 to-gray-100 dark:from-[#181828] dark:via-[#23233a] dark:to-[#181828] border-r border-gray-200 dark:border-gray-800 flex flex-col shadow-2xl transition-all duration-200"
      style={{
        width: width || 300,
        minWidth: (width && width >= 440) ? 400 : 220,
        maxWidth: (width && width >= 440) ? 900 : 500
      }}
    >
      <div className="px-4 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
        <span className="inline-block w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight drop-shadow">Sohbet</h2>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-6 flex flex-col gap-8">
        {/* Kanallar */}
        <div>
          <div className="flex items-center mb-3 px-1">
            <span className="text-base font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">Kanallar</span>
            {userRole === 'admin' && (
              <button
                className="ml-2 p-1 rounded-full bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-300 transition-all shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
                title="Kanal Ekle"
                onClick={() => setShowAddChannel(v => !v)}
              >
                <FaPlus />
              </button>
            )}
          </div>
          {showAddChannel && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <input
                type="text"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400"
                placeholder="Kanal adı"
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleAddChannel(); }}
              />
              <button
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-colors shadow disabled:opacity-50"
                onClick={handleAddChannel}
                disabled={addingChannel || !newChannelName.trim()}
              >Ekle</button>
              <button
                className="px-2 py-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                onClick={() => setShowAddChannel(false)}
                title="İptal"
              >
                ×
              </button>
            </div>
          )}
          <ul className="flex flex-col gap-2 pl-1">
            {Array.isArray(channels) && channels.map(channel => (
              <li key={channel.id}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-semibold text-lg shadow-sm
                    ${selectedChannelId === channel.id
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 ring-2 ring-blue-400 dark:ring-blue-700'
                      : 'hover:bg-blue-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200'}
                  `}
                  onClick={() => onSelectChannel(channel)}
                >
                  <FaHashtag className="text-blue-400 text-xl" />
                  <span className="truncate">{channel.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {/* Kişiler */}
        <div>
          <div className="text-base font-bold text-gray-600 dark:text-gray-300 mb-3 px-1 uppercase tracking-widest">Kişiler</div>
          <ul className="flex flex-col gap-2 pl-1">
            {users.map(user => (
              <li key={user.id}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-semibold text-lg shadow-sm
                    ${selectedDirectUserId === user.id
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 ring-2 ring-purple-400 dark:ring-purple-700'
                      : 'hover:bg-purple-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200'}
                  `}
                  onClick={() => onSelectDirectMessage(user)}
                  onContextMenu={(e) => handleContextMenu(e, user)}
                >
                  <FaUser className="text-purple-400 text-xl" />
                  <span className="truncate flex items-center">{user.name}</span>
                  <span className="ml-auto text-sm text-gray-400 dark:text-gray-500 font-normal">
                    {user.role === 'employee' ? 'Çalışan' : user.role === 'admin' ? 'Yönetici' : user.role}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999
          }}
          className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-2xl py-2 min-w-[180px] text-base select-none"
        >
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="font-semibold text-gray-800 dark:text-white">{contextMenu.userName}</div>
          </div>
          <button
            className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium flex items-center gap-2"
            onClick={handleDeleteMessages}
          >
            <FaTrash className="text-sm" />
            Tüm Mesajları Sil
          </button>
        </div>
      )}
    </aside>
  );
};

export default ChannelsPanel;