'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './context/AuthContext';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, userRole, isLoading } = useAuth();

  useEffect(() => {
    // Loading bitene kadar bekle
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
    } else {
      // Kullanıcı giriş yapmışsa rolüne göre yönlendir
      if (userRole === 'admin') {
        router.push('/admin');
      } else if (userRole === 'employee') {
        router.push('/employee');
      }
    }
  }, [isAuthenticated, userRole, isLoading, router]);

  // Loading sırasında loading ekranı göster
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-white flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-gray-400 dark:border-white border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-700 dark:text-white/80 text-lg">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return null;
}
