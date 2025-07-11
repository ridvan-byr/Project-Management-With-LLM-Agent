'use client';

import React, { useState, useRef } from 'react';
import ChannelsPanel from '../components/ChannelsPanel';
import MessagePanel from '../components/MessagePanel';

const MIN_WIDTH = 220;
const MAX_WIDTH = 500;

const ChatPage = () => {
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [selectedDirectUser, setSelectedDirectUser] = useState<any>(null);
  const [panelWidth, setPanelWidth] = useState(300);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const resizing = useRef(false);

  // Mouse ile sürükleme işlemleri
  const handleMouseDown = (e: React.MouseEvent) => {
    resizing.current = true;
    document.body.style.cursor = 'ew-resize';
  };
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing.current) {
        setPanelWidth(prev => {
          const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH);
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
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block relative" style={{ width: panelWidth, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH, transition: 'width 0.15s' }}>
        <ChannelsPanel
          onSelectChannel={handleSelectChannel}
          onSelectDirectMessage={handleSelectDirectUser}
          selectedChannelId={selectedChannel?.id || null}
          selectedDirectUserId={selectedDirectUser?.id || null}
          onDeleteAllMessages={handleDeleteAllMessages}
        />
        {/* Sürüklenebilir kenar */}
        <div
          className="absolute top-0 right-0 w-2 h-full cursor-ew-resize z-20 bg-transparent"
          onMouseDown={handleMouseDown}
        >
          <div className="h-full w-1 mx-auto bg-gray-200 dark:bg-gray-700 rounded transition opacity-50" />
        </div>
      </div>

      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-80 bg-white dark:bg-gray-900 shadow-xl">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kanallar</h2>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="h-full overflow-y-auto">
              <ChannelsPanel
                onSelectChannel={(channel) => {
                  handleSelectChannel(channel);
                  setIsMobileMenuOpen(false);
                }}
                onSelectDirectMessage={(user) => {
                  handleSelectDirectUser(user);
                  setIsMobileMenuOpen(false);
                }}
                selectedChannelId={selectedChannel?.id || null}
                selectedDirectUserId={selectedDirectUser?.id || null}
                onDeleteAllMessages={handleDeleteAllMessages}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <MessagePanel
          channelId={selectedChannel?.id || null}
          channelName={selectedChannel?.name || ''}
          directUserId={selectedDirectUser?.id || null}
          directUserName={selectedDirectUser?.name || ''}
        />
      </div>
    </div>
  );
};

export default ChatPage; 