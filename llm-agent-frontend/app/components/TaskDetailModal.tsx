import React, { useState } from 'react';
// @ts-ignore
import { HexColorPicker } from "react-colorful";
import { useLabelContext } from './KanbanBoard';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import LabelManagerModal from './LabelManagerModal';
dayjs.extend(utc);
dayjs.extend(timezone);

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  onTaskUpdate: (taskId: number, updates: Partial<any>) => void;
  onOpenLabelManager?: () => void;
  isEmployeeView?: boolean;
}

// Sabit renk paleti
const LABEL_COLORS = [
  '#27ae60', // yeşil
  '#2980b9', // mavi
  '#e67e22', // turuncu
  '#e74c3c', // kırmızı
  '#8e44ad', // mor
  '#f1c40f', // sarı
  '#34495e', // koyu mavi
];

// Yorum önerileri
const COMMENT_SUGGESTIONS = [
  'Şunun üzerinde kim çalışıyor...?',
  'Daha fazla bilgi alabilir miyim...?',
  'Durum güncellemesi...',
  'Harika bir iş çıkarmışsınız!',
  'Bir sonraki adım nedir?',
  'Yardım edebileceğim bir şey var mı?'
];

export default function TaskDetailModal({ isOpen, onClose, task, onTaskUpdate, onOpenLabelManager, isEmployeeView }: TaskDetailModalProps) {
  const { labels: globalLabels, addLabel } = useLabelContext();
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [deadline, setDeadline] = useState(task?.deadline || '');
  const [checklist, setChecklist] = useState(task?.checklist || []);
  const [newCheck, setNewCheck] = useState('');
  const [comments, setComments] = useState(task?.comments || []);
  const [newComment, setNewComment] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(Array.isArray(task?.labels) ? task.labels : []);
  const [newLabel, setNewLabel] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#22c55e');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showChecklist, setShowChecklist] = useState(true);
  const [priority, setPriority] = useState(task?.priority || '');
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelInputs, setLabelInputs] = useState<{ [color: string]: string }>({});
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState<number | null>(null);

  // Kullanıcının kendi yorumu olup olmadığını kontrol eden fonksiyon
  const isOwnComment = (comment: any) => {
    const currentUserId = localStorage.getItem('userId');
    const isOwn = comment.user_id === parseInt(currentUserId || '0');
    console.log('Yorum kontrolü:', { 
      commentId: comment.id, 
      commentUserId: comment.user_id, 
      currentUserId, 
      isOwn,
      commentText: comment.text.substring(0, 20) + '...'
    });
    return isOwn;
  };

  React.useEffect(() => {
    setTitle(task?.title || '');
    setDescription(task?.description || '');
    setDeadline(task?.deadline || '');
    setSelectedLabelIds(Array.isArray(task?.labels) ? task.labels : []);
    setPriority(task?.priority || '');
    loadComments();
  }, [task]);

  // Yorumları backend'den yükle
  const loadComments = async () => {
    if (!task?.id) return;
    try {
      const response = await fetch(`http://localhost:3001/api/tasks/${task.id}/updates`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const currentUserId = localStorage.getItem('userId');
        console.log('Backend\'den gelen yorumlar:', data);
        console.log('Mevcut kullanıcı ID:', currentUserId);
        
        const mappedComments = data.map((update: any) => ({
          id: update.id,
          user: update.user_name || 'Bilinmeyen Kullanıcı',
          text: update.comment,
          date: dayjs(update.updated_at).tz('Europe/Istanbul').format('DD.MM.YYYY HH:mm'),
          user_id: update.user_id
        }));
        
        console.log('Map edilmiş yorumlar:', mappedComments);
        setComments(mappedComments);
      }
    } catch (error) {
      console.error('Yorumlar yüklenirken hata:', error);
    }
  };

  // Eğer bir label globalLabels'tan silinirse, selectedLabelIds'den de çıkar
  React.useEffect(() => {
    setSelectedLabelIds(prev => prev.filter(id => globalLabels.some(l => l.id === id)));
  }, [globalLabels]);

  // Modal her açıldığında seçili etiketleri task.labels'dan güncelle
  React.useEffect(() => {
    if (isOpen && Array.isArray(task?.labels)) {
      if (typeof task.labels[0] === 'object') {
        setSelectedLabelIds(task.labels.map((l: any) => l.id));
      } else {
        setSelectedLabelIds(task.labels);
      }
    }
  }, [isOpen, task]);

  // Modal her açıldığında checklist'i task.checklist ile başlat
  React.useEffect(() => {
    setChecklist(task?.checklist || []);
  }, [isOpen, task]);

  // Yorum ekleme fonksiyonu
  const handleAddComment = async () => {
    if (!newComment.trim() || !task?.id) return;
    
    setIsAddingComment(true);
    try {
      const response = await fetch(`http://localhost:3001/api/tasks/${task.id}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          comment: newComment.trim()
        })
      });

      if (response.ok) {
        const responseData = await response.json();
        const newCommentData = {
          id: responseData.id,
          user: 'Sen',
          text: newComment.trim(),
          date: dayjs(responseData.updated_at).tz('Europe/Istanbul').format('DD.MM.YYYY HH:mm'),
          isOwnComment: true,
          user_id: parseInt(localStorage.getItem('userId') || '0')
        };
        setComments((prev: any[]) => [...prev, newCommentData]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Yorum eklenirken hata:', error);
    } finally {
      setIsAddingComment(false);
    }
  };

  // Yorum silme fonksiyonu
  const handleDeleteComment = async (commentId: number) => {
    if (!task?.id) return;
    
    setIsDeletingComment(commentId);
    try {
      const response = await fetch(`http://localhost:3001/api/tasks/${task.id}/updates/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setComments((prev: any[]) => prev.filter(comment => comment.id !== commentId));
      }
    } catch (error) {
      console.error('Yorum silinirken hata:', error);
    } finally {
      setIsDeletingComment(null);
    }
  };

  const handleSave = () => {
    // Seçili etiketlerin tam nesnelerini bul
    const selectedLabels = selectedLabelIds
      .map(id => globalLabels.find(l => l.id === id))
      .filter(Boolean); // undefined olanları çıkar
    onTaskUpdate(task.id, {
      title,
      description,
      deadline,
      labels: selectedLabels,
      priority,
      checklist, // checklist'i de kaydet
    });
    onClose();
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-6xl mx-4 p-8 relative border border-gray-200 dark:border-gray-700 transition-colors duration-300">
        {/* Kapatma butonu */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-400 text-2xl font-bold z-10">×</button>
        
        {/* İki sütunlu layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sol sütun - Task detayları */}
          <div className="space-y-6">
            {/* Başlık */}
            <div className="flex items-center gap-4 mb-6">
              <span className="px-3 py-1 bg-blue-700 text-xs rounded-lg font-semibold">{task.status}</span>
              {/* Öncelik Rozeti */}
              {priority && (
                <span
                  className={`px-3 py-1 text-xs rounded-lg font-semibold 
                    ${priority === 'high' ? 'bg-red-600' : priority === 'medium' ? 'bg-yellow-500 text-gray-900' : priority === 'low' ? 'bg-green-600' : 'bg-gray-500'}
                  `}
                >
                  {priority === 'high' ? 'Yüksek Öncelik' : priority === 'medium' ? 'Orta Öncelik' : priority === 'low' ? 'Düşük Öncelik' : 'Öncelik Yok'}
                </span>
              )}
              <input
                className={`bg-transparent border-b-2 border-gray-300 dark:border-gray-600 text-2xl font-bold w-full focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition placeholder-gray-400 dark:placeholder-gray-500 ${isEmployeeView ? 'cursor-not-allowed opacity-60' : ''}`}
                value={title}
                onChange={e => !isEmployeeView && setTitle(e.target.value)}
                placeholder="Başlık"
                maxLength={80}
                readOnly={isEmployeeView}
              />
            </div>
            
            {/* Etiketleri Yönet butonu ve etiketler */}
            <div className="flex items-center gap-3 justify-start">
              {!isEmployeeView && (
                <button
                  className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-semibold shadow hover:bg-gray-300 dark:hover:bg-gray-700 transition"
                  onClick={() => setShowLabelManager(true)}
                >
                  Etiketleri Yönet
                </button>
              )}
              <div className="flex gap-2 flex-wrap ml-2">
                {selectedLabelIds.map(id => {
                  const label = globalLabels.find(l => l.id === id);
                  if (!label) return null;
                  const color = typeof label.color === 'string' && label.color.startsWith('#') ? label.color : '#2980b9';
                  return (
                    <span key={id} className="px-3 py-1 rounded-lg text-xs font-semibold shadow" style={{ background: color, color: '#fff', minWidth: 48, textAlign: 'center', fontWeight: 700 }}>{label.name}</span>
                  );
                })}
              </div>
            </div>
            
            {/* Son teslim tarihi */}
            <div className="flex gap-4 items-center">
              <span className="text-sm text-gray-400">Son Teslim Tarihi:</span>
              <input
                type="datetime-local"
                className={`bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-3 py-1 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 ${isEmployeeView ? 'cursor-not-allowed opacity-60' : ''}`}
                value={deadline ? deadline.slice(0, 16) : ''}
                onChange={e => !isEmployeeView && setDeadline(e.target.value)}
                readOnly={isEmployeeView}
              />
            </div>
            
            {/* Öncelik seçimi */}
            <div>
              <label className="block text-base font-semibold mb-2 text-gray-700 dark:text-gray-300">Öncelik</label>
              <select
                value={priority}
                onChange={e => !isEmployeeView && setPriority(e.target.value)}
                className={`w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 ${isEmployeeView ? 'cursor-not-allowed opacity-60' : ''}`}
                disabled={isEmployeeView}
              >
                <option value="">Öncelik Yok</option>
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
              </select>
            </div>
            
            {/* Açıklama */}
            <div>
              <label className="block text-base font-semibold mb-2 text-gray-700 dark:text-gray-300">Açıklama</label>
              <textarea
                className={`w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-4 text-gray-900 dark:text-white min-h-[120px] focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 resize-none custom-scrollbar ${isEmployeeView ? 'cursor-not-allowed opacity-60' : ''}`}
                value={description}
                onChange={e => !isEmployeeView && setDescription(e.target.value)}
                placeholder="Daha ayrıntılı bir açıklama ekleyin..."
                maxLength={500}
                readOnly={isEmployeeView}
              />
            </div>
            
            {/* Kontrol listesi göster/gizle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-base font-semibold text-gray-700 dark:text-gray-300">Kontrol listesi</label>
                <button
                  className="text-xs px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300 transition flex items-center gap-1"
                  onClick={() => setShowChecklist(v => !v)}
                  title={showChecklist ? 'Kapat' : 'Aç'}
                >
                  <span className={`inline-block w-5 h-5 rounded-full border-2 border-gray-400 flex items-center justify-center ${showChecklist ? 'bg-green-500 text-white' : 'bg-white text-gray-400'}`}>✔</span>
                </button>
              </div>
              {showChecklist && (
                <div>
                  {/* Progress bar */}
                  {checklist.length > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Tamamlanma: {Math.round((checklist.filter((item: any) => item.done).length / checklist.length) * 100)}%</span>
                        <span className="text-gray-400">{checklist.filter((item: any) => item.done).length}/{checklist.length}</span>
                      </div>
                      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-3 bg-green-500 transition-all duration-300"
                          style={{ width: `${(checklist.filter((item: any) => item.done).length / checklist.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Madde listesi */}
                  <div className="space-y-2 mb-2">
                    {checklist.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <input type="checkbox" checked={item.done} onChange={() => setChecklist((cl: any[]) => cl.map((c: any) => c.id === item.id ? { ...c, done: !c.done } : c))} />
                        <span className={item.done ? 'line-through text-gray-500' : ''}>{item.text}</span>
                        {!isEmployeeView && (
                          <button
                            className="ml-2 text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded"
                            title="Sil"
                            onClick={() => setChecklist((cl: any[]) => cl.filter((c: any) => c.id !== item.id))}
                          >
                            Sil
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Madde ekleme alanı */}
                  {!isEmployeeView && (
                    <div className="flex gap-2 mt-2">
                      <input
                        className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition"
                        value={newCheck}
                        onChange={e => setNewCheck(e.target.value)}
                        placeholder="Bir öğe ekleyin"
                      />
                      <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
                        onClick={() => {
                          if (newCheck.trim()) {
                            setChecklist((cl: any[]) => [...cl, { id: Date.now(), text: newCheck, done: false }]);
                            setNewCheck('');
                          }
                        }}
                      >Ekle</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sağ sütun - Yorumlar */}
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Yorumlar ve Etkinlik</h3>
              {/* Yorum önerileri */}
              <div className="flex flex-wrap gap-2 mb-3">
                {COMMENT_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="px-3 py-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                    onClick={() => setNewComment(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              {/* Yorumlar listesi */}
              <div 
                className="space-y-4 max-h-96 overflow-y-auto mb-4 pr-2 custom-scrollbar"
              >
                {comments.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    Henüz yorum yapılmamış
                  </div>
                ) : (
                  comments.map((c: any) => (
                    <div key={c.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{c.user}</div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-400">{c.date}</div>
                          {isOwnComment(c) && (
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              disabled={isDeletingComment === c.id}
                              className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded transition disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Yorumu sil"
                            >
                              {isDeletingComment === c.id ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{c.text}</div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Yorum ekleme alanı */}
              <div className="flex gap-2">
                <textarea
                  className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition resize-none"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Yorumunuzu yazın..."
                  rows={2}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                />
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed self-end"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || isAddingComment}
                >
                  {isAddingComment ? '...' : 'Gönder'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Kaydet butonu */}
        {!isEmployeeView && (
          <div className="flex justify-end mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:from-blue-600 hover:to-purple-600 transition"
              onClick={handleSave}
            >
              Kaydet
            </button>
          </div>
        )}
      </div>
      <LabelManagerModal
        open={showLabelManager}
        onClose={() => setShowLabelManager(false)}
        selectedLabelIds={selectedLabelIds}
        setSelectedLabelIds={setSelectedLabelIds}
      />
    </div>
  );
} 