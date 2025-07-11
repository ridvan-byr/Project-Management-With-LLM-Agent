'use client';

import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/tr';
import EmployeeHeader from '../../components/EmployeeHeader';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

dayjs.extend(customParseFormat);

const getDaysInMonth = (year: number, month: number) => {
  const days = [];
  const firstDay = dayjs(`${year}-${String(month + 1).padStart(2, '0')}-01`);
  const daysInMonth = firstDay.daysInMonth();
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(dayjs(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`));
  }
  return days;
};

export default function EmployeeMeetingsPage() {
  const router = useRouter();
  const today = dayjs();
  const [currentMonth, setCurrentMonth] = useState(today.month());
  const [currentYear, setCurrentYear] = useState(today.year());
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [meetings, setMeetings] = useState<any[]>([]);
  const [detailMeeting, setDetailMeeting] = useState<any | null>(null);
  const [monthMeetings, setMonthMeetings] = useState<any[]>([]);

  dayjs.locale('tr');

  const days = getDaysInMonth(currentYear, currentMonth);

  // Ay başında, o ayın tüm günleri için toplantıları fetch et
  const fetchMonthMeetings = async () => {
    const token = localStorage.getItem('token');
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    let allMeetings: any[] = [];
    for (const day of daysInMonth) {
      try {
        const res = await fetch(`http://localhost:3001/api/meetings?date=${day.format('YYYY-MM-DD')}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            allMeetings = allMeetings.concat(data.map((m: any) => ({ ...m, date: day.format('YYYY-MM-DD') })));
          }
        }
      } catch {}
    }
    setMonthMeetings(allMeetings);
  };

  // Toplantıları backend'den çeken fonksiyon
  const fetchMeetings = async (dateStr: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/meetings?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMeetings(Array.isArray(data) ? data : []);
      } else {
        setMeetings([]);
      }
    } catch {
      setMeetings([]);
    }
  };

  // Seçili gün değişince toplantıları çek
  useEffect(() => {
    fetchMeetings(selectedDate.format('YYYY-MM-DD'));
  }, [selectedDate]);

  useEffect(() => {
    fetchMonthMeetings();
  }, [currentMonth, currentYear]);

  const meetingsForSelectedDay = meetings.filter(m =>
    dayjs(m.date).format('YYYY-MM-DD') === selectedDate.format('YYYY-MM-DD')
  );

  // Detay modalı için toplantı detayını backend'den çek
  const handleShowDetailMeeting = async (meeting: any) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/meetings/${meeting.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDetailMeeting(data);
      } else {
        setDetailMeeting({ ...meeting, users: [] });
      }
    } catch {
      setDetailMeeting({ ...meeting, users: [] });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col">
      <EmployeeHeader 
        active="meetings" 
        onTabChange={(tab) => {
          if (tab === 'tasks') {
            router.push('/employee');
          } else if (tab === 'messages') {
            router.push('/employee?tab=messages');
          }
        }}
        onMeetingClick={() => router.push('/employee/meetings')} 
        onLogout={() => {
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          router.push('/login');
        }}
      />
      <div className="flex flex-col items-center justify-start py-12 px-4">
        <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-10 flex flex-col gap-8 mt-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white drop-shadow">Toplantı Takvimi</h1>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-300" onClick={() => setCurrentMonth(m => m - 1)}>&lt;</button>
              <span className="font-bold text-lg text-gray-700 dark:text-gray-200">{dayjs().month(currentMonth).year(currentYear).format('MMMM YYYY')}</span>
              <button className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-300" onClick={() => setCurrentMonth(m => m + 1)}>&gt;</button>
            </div>
          </div>
          {/* Takvim Grid */}
          <div className="grid grid-cols-7 gap-3 mb-8 ml-6">
            {/* Gün isimleri */}
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="w-12 h-12 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400 text-base select-none"
                style={{margin:0, padding:0}}
              >
                {dayjs().day(i === 0 ? 1 : i === 6 ? 0 : i + 1).format('dd').replace('.', '')}
              </div>
            ))}
            {/* Ayın ilk günü öncesi boşluklar */}
            {Array(days[0].day() === 1 ? 0 : days[0].day() === 0 ? 6 : days[0].day() - 1).fill(null).map((_, i) => (
              <button
                key={"empty-"+i}
                className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-lg border-2 border-transparent bg-transparent cursor-default select-none"
                disabled
                tabIndex={-1}
                aria-hidden="true"
                style={{margin:0, padding:0, background:'transparent'}}>
                {/* boş */}
              </button>
            ))}
            {/* Günler */}
            {days.map(day => {
              const isSelected = day.isSame(selectedDate, 'day');
              const hasMeeting = monthMeetings.some(m => m.date === day.format('YYYY-MM-DD'));
              const isToday = day.isSame(today, 'day');
              const isPast = day.isBefore(today, 'day');
              return (
                <button
                  key={day.format('YYYY-MM-DD')}
                  className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-lg transition-all border-2
                    ${isToday ? 'bg-green-500 text-white border-green-600 scale-110 shadow-lg' : 
                      isSelected ? 'bg-blue-500 text-white border-blue-600 scale-110 shadow-lg' : 
                      isPast ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 border-gray-400 dark:border-gray-500' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900'}
                    ${hasMeeting ? 'ring-2 ring-purple-400 dark:ring-purple-600' : ''}`}
                  style={{ margin: 0, padding: 0 }}
                  onClick={() => setSelectedDate(day)}
                >
                  <span className="block leading-none" style={{lineHeight:'1.2'}}>{day.date()}</span>
                  {isToday && <span className="w-1 h-1 mt-1 rounded-full bg-white inline-block"></span>}
                  {hasMeeting && <span className="w-2 h-2 mt-1 rounded-full bg-purple-500 inline-block"></span>}
                </button>
              );
            })}
          </div>
          {/* Toplantı Listeleme */}
          <div className="flex flex-col gap-8">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-4 text-blue-700 dark:text-blue-200">{selectedDate.format('DD MMMM YYYY')} Toplantıları</h2>
              {meetingsForSelectedDay.length === 0 ? (
                <div className="text-gray-400 dark:text-gray-500">Bu gün için toplantı yok.</div>
              ) : (
                <ul className="space-y-4">
                  {meetingsForSelectedDay.map(m => (
                    <li
                      key={m.id}
                      className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 flex items-center justify-between shadow cursor-pointer hover:scale-[1.01] transition-transform"
                      onClick={() => handleShowDetailMeeting(m)}
                    >
                      <span className="font-semibold text-lg text-purple-700 dark:text-purple-200">{m.title}{m.time ? ` - ${m.time.slice(0,5)}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Toplantı Detay Modalı */}
      {detailMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-300 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4 text-blue-700 dark:text-blue-200">{detailMeeting.title}{detailMeeting.time ? ` - ${detailMeeting.time.slice(0,5)}` : ''}</h2>
            <div className="mb-2 text-gray-700 dark:text-gray-300"><span className="font-semibold">Açıklama:</span> {detailMeeting.description || <span className="italic text-gray-400">(Yok)</span>}</div>
            <div className="mb-2 text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Tarih:</span> {detailMeeting.date && detailMeeting.time
                ? dayjs(`${detailMeeting.date} ${detailMeeting.time}`, ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm']).format('DD MMMM YYYY, HH:mm')
                : <span className="italic text-gray-400">(Belirtilmemiş)</span>}
            </div>
            <div className="mb-4 text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Katılımcılar:</span>
              {detailMeeting.users && detailMeeting.users.length > 0 ? (
                <ul className="list-disc ml-6 mt-1">
                  {detailMeeting.users.map((u: any) => (
                    <li key={u.id}>{u.name}</li>
                  ))}
                </ul>
              ) : (
                <span className="italic text-gray-400 ml-2">(Yok)</span>
              )}
            </div>

            <button
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              onClick={() => setDetailMeeting(null)}
            >
              Kapat
            </button>
          </div>
        </div>
      )}
      <style jsx global>{`
      @keyframes slideDownFadeIn {
        0% { opacity: 0; transform: translateY(-32px) scale(0.98); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      `}</style>
    </div>
  );
} 