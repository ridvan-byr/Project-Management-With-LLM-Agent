"use client";

import { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const { userId, userRole } = useAuth();

  // Sync Tailwind dark class with system theme and update instantly
  useEffect(() => {
    setMounted(true);
    
    const updateDarkClass = () => {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    updateDarkClass();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateDarkClass);
    return () => {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', updateDarkClass);
    };
  }, []);

  // Hydration sorunlarını önlemek için
  if (!mounted) {
    return null;
  }

  return (
    <>
      {children}
      <Toaster position="top-right" />
    </>
  );
} 