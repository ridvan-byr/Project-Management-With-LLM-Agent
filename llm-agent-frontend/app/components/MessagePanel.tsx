"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { FaUserPlus, FaUserEdit } from 'react-icons/fa';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

interface Message {
  id: number;
  message: string;
  sender_id: number;
  receiver_id?: number;
  created_at: string;
  is_sender: boolean;
  sender_name: string;
  sender_role: string;
}

interface MessagePanelProps {
  userRole?: string;
  channelId?: number | null;
  channelName?: string;
  directUserId?: number | null;
  directUserName?: string;
  showMembersPanel?: boolean;
  canAddMembers?: boolean;
}

function stringToColor(str: string) {
  // Basit bir renk üretici
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).slice(-2);
  }
  return color;
}

export default function MessagePanel({ userRole, channelId, channelName, directUserId, directUserName, showMembersPanel = true, canAddMembers = true }: MessagePanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { userId } = useAuth();
  const { userRole: authUserRole } = useAuth();
  const [userName, setUserName] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [addUserId, setAddUserId] = useState('');
  const [addUserRole, setAddUserRole] = useState('member');
  const [adding, setAdding] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: number | null } | null>(null);
  const [userContextMenu, setUserContextMenu] = useState<{ x: number; y: number; userId: number | null, userName: string } | null>(null);

  useEffect(() => {
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setUserName(storedName);
    } else {
      const fetchMe = async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get('http://localhost:3001/api/users/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUserName(res.data.name);
          localStorage.setItem('userName', res.data.name);
        } catch {}
      };
      fetchMe();
    }
  }, []);

  useEffect(() => {
    if (!channelId && !directUserId) return;
    fetchMessages();
  }, [channelId, directUserId, userId]);

  const fetchMessages = async () => {
    if (!channelId && !directUserId) return;
    try {
      const token = localStorage.getItem("token");
      let res;
      if (channelId) {
        res = await axios.get(`http://localhost:3001/api/messages?channel_id=${channelId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(
          res.data.channel.map((msg: any) => ({
            ...msg,
            message: msg.message || msg.content,
            is_sender: String(msg.sender_id) === String(userId),
          }))
        );
      } else if (directUserId) {
        res = await axios.get(`http://localhost:3001/api/messages?user_id=${directUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(
          res.data.messages.map((msg: any) => ({
            ...msg,
            message: msg.message || msg.content,
            is_sender: String(msg.sender_id) === String(userId),
          }))
        );
      }
    } catch (error) {
      toast.error("Mesajlar yüklenirken bir hata oluştu");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading || !userId || (!channelId && !directUserId)) return;
    setIsLoading(true);
    const messageToSend = newMessage.trim();
    setNewMessage("");
    try {
      const token = localStorage.getItem("token");
      let sentMessage = null;
      if (channelId) {
        const res = await axios.post(
          "http://localhost:3001/api/messages",
          { message: messageToSend, channel_id: channelId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        sentMessage = res.data;
      } else if (directUserId) {
        const res = await axios.post(
          "http://localhost:3001/api/messages",
          { message: messageToSend, user_id: directUserId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        sentMessage = res.data;
      }
      if (sentMessage) {
        setMessages((prev) => [
          ...prev,
          {
            ...sentMessage,
            message: sentMessage.message || sentMessage.content,
            is_sender: true,
          },
        ]);
      }
      // Kısa bir gecikme ile fetchMessages çağır (veritabanı gecikmesi için)
      setTimeout(() => {
        fetchMessages();
      }, 300);
    } catch (error) {
      toast.error("Mesaj gönderilemedi");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Kanal üyelerini getir
  useEffect(() => {
    if (channelId && showMembersPanel) {
      fetchMembers();
      fetchEmployees();
    }
  }, [channelId, showMembersPanel]);

  const fetchMembers = async () => {
    if (!channelId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:3001/api/channels/${channelId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMembers(res.data);
    } catch {}
  };
  // Sadece çalışanları getir
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:3001/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllEmployees(res.data.filter((u: any) => u.role === 'employee'));
    } catch {}
  };

  // Kanala üye ekle
  const handleAddMember = async () => {
    if (!addUserId || !channelId) return;
    setAdding(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:3001/api/channels/${channelId}/members`, {
        user_id: addUserId,
        role: addUserRole,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAddUserId('');
      setAddUserRole('member');
      fetchMembers();
    } catch {
      toast.error('Üye eklenemedi');
    } finally {
      setAdding(false);
    }
  };

  // Rol güncelleme (sadece rolü değiştirmek için)
  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!channelId) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:3001/api/channels/${channelId}/members`, {
        user_id: userId,
        role: newRole,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMembers();
    } catch {
      toast.error('Rol güncellenemedi');
    }
  };

  const handleAvatarContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msgId: msg.id });
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
    }
  }, [contextMenu]);

  const handleDeleteMessage = async (msgId: number) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3001/api/messages/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      setContextMenu(null);
    } catch {
      toast.error('Mesaj silinemedi');
    }
  };

  const handleUserContextMenu = (e: React.MouseEvent, member: any) => {
    e.preventDefault();
    alert('Sağ tık event tetiklendi: ' + member.name);
    setUserContextMenu({ x: e.clientX, y: e.clientY, userId: member.user_id, userName: member.name });
  };

  useEffect(() => {
    const closeMenu = () => setUserContextMenu(null);
    if (userContextMenu) {
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
    }
  }, [userContextMenu]);

  const handleDeleteConversation = async (userId: number) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3001/api/messages/all?user_id=${userId}&type=dm`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages((prev) => prev.filter((m) => m.sender_id !== userId && m.receiver_id !== userId));
      setUserContextMenu(null);
      toast.success('Tüm mesajlar silindi');
    } catch {
      toast.error('Mesajlar silinemedi');
    }
  };

  const handleDeleteAllMessages = async (userId: number) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3001/api/messages/all?user_id=${userId}&type=dm`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages([]);
      toast.success('Tüm mesajlar silindi');
    } catch {
      toast.error('Mesajlar silinemedi');
    }
  };

  if (!channelId && !directUserId) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-lg">Bir kanal veya kişi seçin</div>;
  }

  return (
    <div className="flex h-full w-full">
      {/* Mesaj paneli */}
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {messages.map((msg) => {
            const name = msg.sender_name || "?";
            const avatarColor = stringToColor(name);
            const initial = name.charAt(0).toUpperCase();
            return (
              <div key={msg.id} className="flex items-start gap-6" onContextMenu={(e) => handleAvatarContextMenu(e, msg)}>
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg"
                  style={{ background: avatarColor, color: '#fff' }}
                >
                  {initial}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white text-xl">{name}</span>
                    {msg.sender_role === 'admin' && (
                      <span className="bg-red-600 text-white text-sm px-3 py-1 rounded ml-2">Yönetici</span>
                    )}
                  </div>
                  <div className={`rounded-2xl px-8 py-5 text-2xl shadow-lg max-w-[900px] min-w-[180px] border ${msg.is_sender ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700'}`}>
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                  </div>
                  <span className="text-sm opacity-60 mt-2 block ml-1">{dayjs.utc(msg.created_at).tz('Europe/Istanbul').format('HH:mm')}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className="p-8 border-t border-gray-300 dark:border-gray-700 flex gap-6 bg-white dark:bg-gray-900 transition-colors duration-300">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-8 py-6 focus:outline-none focus:ring-2 focus:ring-blue-500 text-2xl shadow-md border border-gray-300 dark:border-gray-700 transition-colors duration-300"
            placeholder="Mesajınızı yazın..."
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 py-4 font-semibold text-xl min-h-[56px] ml-2 disabled:opacity-50 transition-all shadow-lg"
            disabled={isLoading || !newMessage.trim()}
          >
            Gönder
          </button>
        </form>
      </div>
      {/* Üyeler paneli */}
      {channelId && showMembersPanel && (
        <div className="w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full transition-all duration-300">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
            <span className="text-lg font-bold text-gray-900 dark:text-white">Üyeler</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {members.map((member: any) => (
              <div key={member.user_id} className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm relative group" onContextMenu={(e) => handleUserContextMenu(e, member)}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg cursor-pointer" style={{ background: stringToColor(member.name) }} onContextMenu={(e) => handleUserContextMenu(e, member)}>{member.name[0]}</div>
                <div className="flex-1" onContextMenu={(e) => handleUserContextMenu(e, member)}>
                  <div className="font-semibold text-gray-900 dark:text-white">{member.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{member.role === 'admin' ? 'Yönetici' : 'Üye'}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${member.role === 'admin' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' : 'bg-gradient-to-r from-gray-400 to-gray-700 text-white'}`}>{member.role === 'admin' ? 'Yönetici' : 'Üye'}</span>
              </div>
            ))}
          </div>
          {/* Üye ekleme arayüzü */}
          {canAddMembers && userRole === 'admin' && (
            <div className="mb-4 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow flex flex-col gap-3 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-lg text-gray-900 dark:text-white">Kanal Üyesi Ekle</span>
              </div>
              <div className="flex flex-col gap-2">
                <select
                  className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-base bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400"
                  value={addUserId}
                  onChange={e => setAddUserId(e.target.value)}
                >
                  <option value="">Kişi seçin</option>
                  {allEmployees.filter(emp => !members.some(m => m.user_id === emp.id)).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-base bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400"
                  value={addUserRole}
                  onChange={e => setAddUserRole(e.target.value)}
                >
                  <option value="member">Üye</option>
                  <option value="admin">Yönetici</option>
                </select>
                <button
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg px-6 py-3 font-bold text-lg flex items-center gap-2 mt-1 shadow-lg transition-all disabled:opacity-50"
                  onClick={handleAddMember}
                  type="button"
                  disabled={!addUserId || adding}
                >
                  {adding ? 'Ekleniyor...' : 'Ekle'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {userContextMenu && (
        <div
          style={{ position: 'fixed', top: userContextMenu.y, left: userContextMenu.x, zIndex: 9999 }}
          className="bg-white border border-gray-300 rounded-xl shadow-2xl py-4 px-6 min-w-[180px] text-base select-none animate-fade-in"
          onClick={e => e.stopPropagation()}
        >
          <div className="font-semibold text-gray-800 mb-2">{userContextMenu.userName}</div>
          <button
            className="text-red-600 hover:bg-gray-100 w-full text-left py-2 px-3 rounded transition-colors font-bold"
            onClick={() => handleDeleteConversation(userContextMenu.userId!)}
          >
            Kişiyle Tüm Mesajları Sil
          </button>
        </div>
      )}
    </div>
  );
} 