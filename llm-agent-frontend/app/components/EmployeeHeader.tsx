import React from 'react';
import NotificationBell from './NotificationBell';
import Link from 'next/link';

interface EmployeeHeaderProps {
  title?: string;
  active: 'tasks' | 'messages' | 'meetings';
  onTabChange: (tab: 'tasks' | 'messages') => void;
  onMeetingClick?: () => void;
  onLogout: () => void;
}

const EmployeeHeader: React.FC<EmployeeHeaderProps> = ({
  title = 'Çalışan Paneli',
  active,
  onTabChange,
  onMeetingClick,
  onLogout,
}) => {
  return (
    <header className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white shadow-lg transition-colors duration-300">
      <div className="max-w-full mx-auto px-8 sm:px-16 lg:px-32">
        <div className="flex justify-between items-center h-28">
          <Link href="/employee" className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight drop-shadow hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
            {title}
          </Link>
          <div className="flex space-x-8 items-center">
            <button
              className={`px-6 py-3 rounded-xl text-lg font-semibold transition-colors shadow-md ${active === 'tasks' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white'}`}
              onClick={() => onTabChange('tasks')}
            >
              Görevler
            </button>
            <button
              className={`px-6 py-3 rounded-xl text-lg font-semibold transition-colors shadow-md ${active === 'messages' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white'}`}
              onClick={() => onTabChange('messages')}
            >
              Mesajlaşma
            </button>
            <button
              className={`px-6 py-3 rounded-xl text-lg font-semibold transition-colors shadow-md ${active === 'meetings' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-blue-700 hover:text-white dark:hover:bg-blue-700 dark:hover:text-white'}`}
              onClick={onMeetingClick}
            >
              Toplantılar
            </button>
            <Link
              href="/ai-chat"
              className="px-6 py-3 bg-purple-600 text-white rounded-xl text-lg font-semibold hover:bg-purple-700 transition-colors shadow-md"
            >
              AI ile Sohbet
            </Link>
            <button
              onClick={onLogout}
              className="px-6 py-3 bg-red-500 text-white rounded-2xl text-lg font-semibold hover:bg-red-600 transition-colors flex items-center space-x-2 shadow-md"
            >
              <span>Çıkış Yap</span>
            </button>
            <div className="scale-125">
              <NotificationBell />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default EmployeeHeader; 