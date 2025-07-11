'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import ChannelsPanel from '../../components/ChannelsPanel';
import MessagePanel from '../../components/MessagePanel';
import Link from 'next/link';
import AdminHeader from '../../components/AdminHeader';

export default function AdminMessagesPage() {
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [selectedDirectUser, setSelectedDirectUser] = useState<any>(null);
  const router = useRouter();
  const { logout, isAuthenticated, userRole } = useAuth();

  // Yetki kontrolü
  useEffect(() => {
    if (!isAuthenticated || userRole !== 'admin') {
      router.push('/login');
    }
  }, [isAuthenticated, userRole, router]);

  if (!isAuthenticated || userRole !== 'admin') {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Kanal seçilince kişi seçimini sıfırla
  const handleSelectChannel = (channel: any) => {
    setSelectedChannel(channel);
    setSelectedDirectUser(null);
  };

  // Kişi seçilince kanal seçimini sıfırla
  const handleSelectDirectUser = (user: any) => {
    setSelectedDirectUser(user);
    setSelectedChannel(null);
  };

  // Tüm mesajları silme fonksiyonu
  const handleDeleteAllMessages = async (userId: number) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3001/api/messages/all?user_id=${userId}&type=dm`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      // Mesajları temizle
      if (selectedDirectUser?.id === userId) {
        setSelectedDirectUser(null);
      }
    } catch (error) {
      console.error('Mesajlar silinemedi:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-300">
      {/* Header */}
      <AdminHeader active="messages" onMeetingClick={() => router.push('/admin/meetings')} />

      {/* Mesajlaşma içeriği */}
      <main className="h-[calc(96vh-4rem)] p-2 bg-transparent dark:bg-transparent dark:text-white transition-colors duration-300">
        <div className="flex h-full">
          {/* Desktop Channels Panel */}
          <div className="hidden lg:block">
            <ChannelsPanel
              onSelectChannel={handleSelectChannel}
              onSelectDirectMessage={handleSelectDirectUser}
              selectedChannelId={selectedChannel?.id || null}
              selectedDirectUserId={selectedDirectUser?.id || null}
              onDeleteAllMessages={handleDeleteAllMessages}
            />
          </div>
          
          {/* Mobile Channels Panel - Overlay */}
          <div className="lg:hidden fixed inset-0 z-40" style={{ display: selectedChannel || selectedDirectUser ? 'none' : 'block' }}>
            <div className="h-full bg-white dark:bg-gray-900">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kanallar</h2>
              </div>
              <ChannelsPanel
                onSelectChannel={handleSelectChannel}
                onSelectDirectMessage={handleSelectDirectUser}
                selectedChannelId={selectedChannel?.id || null}
                selectedDirectUserId={selectedDirectUser?.id || null}
                onDeleteAllMessages={handleDeleteAllMessages}
              />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <MessagePanel
              channelId={selectedChannel?.id || null}
              channelName={selectedChannel?.name || ''}
              directUserId={selectedDirectUser?.id || null}
              directUserName={selectedDirectUser?.name || ''}
              userRole="admin"
            />
          </div>
        </div>
      </main>
    </div>
  );
} 