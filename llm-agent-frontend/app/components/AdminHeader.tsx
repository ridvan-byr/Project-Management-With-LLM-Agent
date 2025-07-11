import Link from 'next/link';
import NotificationBell from './NotificationBell';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import React, { useState } from 'react';

interface AdminHeaderProps {
  title?: string;
  active?: 'tasks' | 'messages' | 'positions' | 'meetings';
  onMeetingClick?: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ title = 'Yönetici Paneli', active, onMeetingClick }) => {
  const router = useRouter();
  const { logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white shadow-lg transition-colors duration-300">
      <div className="max-w-full mx-auto px-4 sm:px-8 lg:px-16 xl:px-32">
        <div className="flex justify-between items-center h-16 sm:h-20 lg:h-28">
          <Link href="/admin" className="text-xl sm:text-2xl lg:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight hover:text-blue-700 dark:hover:text-gray-300 transition-colors">
            {title}
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden lg:flex space-x-4 xl:space-x-8 items-center">
            <Link
              href="/admin"
              className={`px-4 xl:px-6 py-2 xl:py-3 rounded-xl text-sm xl:text-lg font-semibold transition-colors shadow-md ${active === 'tasks' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white'}`}
            >
              Görevler
            </Link>
            <Link
              href="/admin/messages"
              className={`px-4 xl:px-6 py-2 xl:py-3 rounded-xl text-sm xl:text-lg font-semibold transition-colors shadow-md ${active === 'messages' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white'}`}
            >
              Mesajlaşma
            </Link>
            <Link
              href="/admin/positions"
              className={`px-4 xl:px-6 py-2 xl:py-3 rounded-xl text-sm xl:text-lg font-semibold transition-colors shadow-md ${active === 'positions' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white'}`}
            >
              Pozisyonlar
            </Link>
            <button
              onClick={onMeetingClick}
              className={`px-4 xl:px-6 py-2 xl:py-3 rounded-xl text-sm xl:text-lg font-semibold transition-colors shadow-md ${active === 'meetings' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white'}`}
            >
              Toplantı
            </button>
            <Link
              href="/ai-chat"
              className="px-4 xl:px-6 py-2 xl:py-3 bg-purple-600 text-white rounded-xl text-sm xl:text-lg font-semibold hover:bg-purple-700 transition-colors shadow-md"
            >
              AI ile Sohbet
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 xl:px-6 py-2 xl:py-3 bg-red-500 text-white rounded-2xl text-sm xl:text-lg font-semibold hover:bg-red-600 transition-colors flex items-center space-x-2 shadow-md"
            >
              <span>Çıkış Yap</span>
            </button>
            <div className="scale-110 xl:scale-125">
              <NotificationBell />
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center space-x-2">
            <div className="scale-90">
              <NotificationBell />
            </div>
            <button
              onClick={toggleMobileMenu}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="px-4 py-4 space-y-3">
              <Link
                href="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block w-full px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${active === 'tasks' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white'}`}
              >
                Görevler
              </Link>
              <Link
                href="/admin/messages"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block w-full px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${active === 'messages' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white'}`}
              >
                Mesajlaşma
              </Link>
              <Link
                href="/admin/positions"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block w-full px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${active === 'positions' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white'}`}
              >
                Pozisyonlar
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onMeetingClick?.();
                }}
                className={`block w-full px-4 py-3 rounded-xl text-sm font-semibold transition-colors text-left ${active === 'meetings' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white'}`}
              >
                Toplantı
              </button>
              <Link
                href="/ai-chat"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full px-4 py-3 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors"
              >
                AI ile Sohbet
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="block w-full px-4 py-3 bg-red-500 text-white rounded-2xl text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default AdminHeader; 