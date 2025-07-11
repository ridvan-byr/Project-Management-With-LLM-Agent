'use client';

import React, { useMemo, useState, useEffect, createContext, useContext } from 'react';
import {
  DndContext,
  closestCenter,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
  DragOverlay,
  useDndContext,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskDetailModal from './TaskDetailModal';
import LabelManagerModal from './LabelManagerModal';
import axios from 'axios';
import { CheckCircle, Check } from '@mui/icons-material';

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  assigned_to: number;
  assigned_to_name: string;
  category: string;
  created_at: string;
  priority?: string;
  updated_at: string;
  completed_at?: string;
  deadline?: string;
  labels?: { id: string; name: string; color: string }[];
  checklist?: { id: string; done: boolean }[];
  completed?: boolean;
}

interface KanbanBoardProps {
  tasks: Task[];
  onTaskUpdate: (taskId: number, updates: Partial<Task>) => void;
  onTaskDelete: (taskId: number) => void;
  onStatusAdd: (statusName: string) => void;
  onStatusDelete: (statusName: string) => void;
  statuses: string[];
  onTaskOrderChange?: (status: string, newOrder: Task[]) => void;
  currentUserId?: number;
  isEmployeeView?: boolean;
}

interface SortableTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: number) => void;
  onTaskUpdate: (taskId: number, updates: Partial<Task>) => void;
  large?: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  onCardClick?: (task: Task) => void;
  canDrag?: boolean;
  currentUserId?: number;
  isEmployeeView?: boolean;
}

// Global Label Context
export interface LabelType {
  id: string;
  name: string;
  color: string;
}

export const LabelContext = createContext<{
  labels: LabelType[];
  addLabel: (label: LabelType) => void;
  getLabelById: (id: string) => LabelType | undefined;
}>({ labels: [], addLabel: () => {}, getLabelById: () => undefined });

export const useLabelContext = () => useContext(LabelContext);

const SortableTaskCard: React.FC<SortableTaskCardProps> = ({ task, onEdit, onDelete, onTaskUpdate, large, isDragging, isOverlay, onCardClick, canDrag, currentUserId, isEmployeeView }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: dndKitDragging,
  } = useSortable({ id: task.id, disabled: !canDrag });

  const isAssignedToMe = task.assigned_to === currentUserId;
  const [checked, setChecked] = React.useState(task.completed || false);
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    setChecked(task.completed || false);
  }, [task.completed, task.id]);

  const style = {
    transform: isOverlay ? undefined : CSS.Transform.toString(transform),
    transition: isOverlay ? undefined : transition || 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s',
    opacity: isOverlay ? 0.95 : (isDragging ? 0.5 : 1),
    zIndex: isOverlay ? 50 : undefined,
    boxShadow: (isDragging || dndKitDragging || isOverlay)
      ? '0 12px 32px 0 rgba(59,130,246,0.25), 0 2px 8px 0 rgba(0,0,0,0.10)'
      : undefined,
    scale: isOverlay ? 1.08 : undefined,
    border: (isDragging || dndKitDragging || isOverlay) ? '2px solid #3b82f6' : undefined,
    filter: isOverlay ? 'blur(0.5px)' : undefined,
    cursor: 'grab',
  };

  const isOverdue = task.deadline && new Date(task.deadline) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? attributes : {})}
      {...(canDrag ? listeners : {})}
      className={`w-full bg-white dark:bg-gray-900 rounded-2xl p-3 sm:p-5 mb-3 sm:mb-5 shadow-xl border transition-all duration-200 flex flex-col items-stretch min-h-[140px] sm:min-h-[170px] group relative overflow-hidden ${
        isEmployeeView && isAssignedToMe 
          ? 'border-blue-500 border-2' 
          : 'border-gray-200 dark:border-gray-700'
      } hover:shadow-2xl ${canDrag ? 'cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-900/30' : 'cursor-not-allowed opacity-60'}`}
      onClick={
        (e) => {
          if (!isDragging && !isOverlay && onCardClick) {
            e.stopPropagation();
            onCardClick(task);
          }
        }
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Öncelik çubuğu - sol tarafta, tam yükseklikte ve kalın */}
      <div className="absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl" style={{
        backgroundColor: task.priority === 'high' ? '#f87171' : 
                         task.priority === 'medium' ? '#fbbf24' : 
                         task.priority === 'low' ? '#34d399' : '#d1d5db'
      }} />

      {/* Tik butonu - sağ üstte, sadece hover'da veya tamamlandıysa görünür, temaya göre */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTaskUpdate(task.id, { completed: !checked });
        }}
        className={`absolute top-2 sm:top-3 right-2 sm:right-3 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 shadow-md
          ${checked
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100'}
          ${checked
            ? 'bg-green-500 border-green-500 text-white'
            : 'bg-white dark:bg-black border-gray-300 dark:border-gray-700 text-gray-300 dark:text-gray-400 hover:text-green-500 hover:border-green-500'}
        `}
        style={{ fontSize: 16 }}
      >
        {checked ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Check className="w-4 h-4 sm:w-5 sm:h-5 opacity-40" />}
      </button>

      {/* Başlık */}
      <div className="mb-2 sm:mb-3 pl-4">
        <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm line-clamp-2">
          {task.title}
        </h3>
      </div>

      {/* Etiketler */}
      {Array.isArray(task.labels) && task.labels.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2 sm:mb-3 pl-4">
          {task.labels.map((label, index) => (
            <span
              key={label.id || index}
              className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-white font-medium"
              style={{ background: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Alt bilgiler */}
      <div className="mt-auto space-y-2 pl-4">
        {/* Son teslim tarihi */}
        {task.deadline && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Son Tarih: </span>
            <span className={`px-2 py-0.5 rounded ${
              isOverdue 
                ? 'bg-red-500 text-white' 
                : ''
            }`}>
              {new Date(task.deadline).toLocaleDateString('tr-TR')} {new Date(task.deadline).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        {/* Atanan kişi */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {task.assigned_to_name || 'Atanmamış'}
          </span>
        </div>
      </div>
    </div>
  );
};

const DroppableColumn: React.FC<{ id: string; children: React.ReactNode } > = ({ id, children }) => {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef}>{children}</div>;
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onTaskUpdate,
  onTaskDelete,
  onStatusAdd,
  onStatusDelete,
  statuses,
  onTaskOrderChange,
  currentUserId,
  isEmployeeView
}) => {
  // const [columns, setColumns] = useState<{ [key: string]: Task[] }>({}); // KALDIRILDI
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [globalLabels, setGlobalLabels] = React.useState<LabelType[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [pendingOrderChange, setPendingOrderChange] = useState<{ status: string; newOrder: Task[] } | null>(null);
  const [newStatusName, setNewStatusName] = useState('');
  const [showAddStatus, setShowAddStatus] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { over } = useDndContext();

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, '': 3 };

  // columns'u her renderda hesapla
  const columns = useMemo(() => {
    const grouped: { [key: string]: Task[] } = {};
    statuses.forEach(status => { grouped[status] = []; });
    tasks.forEach(task => {
      const status = task.status || statuses[0] || 'Beklemede';
      if (!grouped[status]) grouped[status] = [];
      let labels = task.labels;
      if (Array.isArray(labels) && labels.length > 0) {
        if (typeof labels[0] === 'string') {
          labels = (labels as unknown as string[]).map((id: string) => globalLabels.find(l => l.id === id)).filter((l): l is LabelType => !!l);
        } else if (typeof labels[0] === 'object') {
          labels = labels.filter((l: any) => l && l.id && l.name && l.color);
        }
      }
      grouped[status].push({ ...task, labels });
    });
    // Her sütunu priority'ye göre sırala
    Object.keys(grouped).forEach(status => {
      grouped[status] = grouped[status].sort((a, b) => (priorityOrder[String(a.priority)] ?? 3) - (priorityOrder[String(b.priority)] ?? 3));
    });
    return grouped;
  }, [tasks, statuses, globalLabels]);

  // Etiketleri backend'den çek
  useEffect(() => {
    async function fetchLabels() {
      try {
        const { data } = await axios.get('http://localhost:3001/api/labels');
        setGlobalLabels(data);
      } catch (err) {
        setGlobalLabels([]);
      }
    }
    fetchLabels();
  }, []);

  const handleDragStart = (event: any) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveDragTask(task);
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    console.log('handleDragOver', { over, isEmployeeView, currentUserId });
    if (over && statuses.includes(over.id as string)) {
      setOverColumnId(over.id as string);
    } else {
      setOverColumnId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    console.log('handleDragEnd', { event });
    setActiveDragTask(null);
    setOverColumnId(null);
    const { active, over } = event;
    if (!over) return;
    const activeTask = tasks.find(task => String(task.id) === String(active.id));
    let newStatus: string | null = null;
    let insertIndex: number | undefined = undefined;
    const overId = String(over.id);
    if (statuses.includes(overId)) {
      newStatus = overId;
      insertIndex = columns[newStatus].length;
    } else {
      const overTask = tasks.find(task => String(task.id) === overId);
      if (overTask) {
        newStatus = overTask.status;
        insertIndex = columns[newStatus].findIndex(t => String(t.id) === overId);
      }
    }
    console.log('handleDragEnd', { activeTask, newStatus, isEmployeeView, currentUserId });
    if (!activeTask || !newStatus) return;
    if (isEmployeeView && activeTask.assigned_to !== currentUserId) {
      console.log('Çalışan paneli: başkasının kartı, işlem yok');
      return;
    }
    // Aynı sütunda sıralama değişikliği veya kendi yerine bırakma
    if (activeTask.status === newStatus) {
      // Sıralama değişikliği parent'a bildirilsin
      if (typeof onTaskOrderChange === 'function') {
        const col = columns[newStatus!].filter(t => t.id !== activeTask.id);
        const newCol = [
          ...col.slice(0, insertIndex),
          activeTask,
          ...col.slice(insertIndex)
        ];
        onTaskOrderChange(newStatus!, newCol);
      }
      console.log('Aynı sütunda sıralama değişikliği');
      return;
    }
    // Farklı sütuna taşındıysa parent'a bildir
    // Sadece status değişikliği için parent'a bildir
    const updates: any = { status: newStatus };
    if (newStatus === 'Tamamlandı' || newStatus === 'completed') {
      updates.completed = true;
    } else {
      updates.completed = false;
    }
    console.log('Kart güncelleniyor', { id: activeTask.id, updates });
    onTaskUpdate(activeTask.id, updates);
  };

  const handleAddStatus = () => {
    if (newStatusName.trim()) {
      onStatusAdd(newStatusName.trim());
      setNewStatusName('');
      setShowAddStatus(false);
    }
  };

  const handleDeleteStatus = (statusName: string) => {
    onStatusDelete(statusName);
  };

  const handleEditTask = (task: Task) => {
    setDetailTask(task);
  };

  const handleCardClick = (task: Task) => {
    setDetailTask(task);
    setSelectedLabelIds(Array.isArray(task.labels)
      ? task.labels.map((l: any) => l.id ? l.id : `${l.color}-${l.name}`)
      : []);
  };

  // Sıralama değişikliği parent'a bildirilsin (render dışında)
  useEffect(() => {
    if (pendingOrderChange && typeof onTaskOrderChange === 'function') {
      onTaskOrderChange(pendingOrderChange.status, pendingOrderChange.newOrder);
      setPendingOrderChange(null);
    }
  }, [pendingOrderChange, onTaskOrderChange]);

  // Etiket ekleme fonksiyonu (backend'e de ekler)
  const addLabel = (label: LabelType) => {
    setGlobalLabels(prev => [...prev, label]); // Optimistic update
    axios.post('http://localhost:3001/api/labels', label)
      .catch(() => {
        setGlobalLabels(prev => prev.filter(l => l.id !== label.id));
      });
  };

  // ID'ye göre etiket bulma fonksiyonu
  const getLabelById = (id: string) => globalLabels.find(l => l.id === id);

  return (
    <LabelContext.Provider value={{ labels: globalLabels, addLabel, getLabelById }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 sm:gap-6 pb-4 min-h-[80vh] overflow-x-auto">
          {statuses.map((status) => (
            <div key={status} className="flex-shrink-0 w-72 sm:w-80">
              <DroppableColumn id={status}>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 sm:p-4 h-[600px] sm:h-[700px]">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                        {status}
                      </h3>
                      <span className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full text-xs sm:text-sm">
                        {columns[status]?.length || 0}
                      </span>
                    </div>
                    {/* Sadece yöneticiler durum silebilir */}
                    {!isEmployeeView && status !== 'Beklemede' && status !== 'Devam Ediyor' && status !== 'Tamamlandı' && (
                      <button
                        onClick={() => onStatusDelete(status)}
                        className="text-red-500 hover:text-red-700 text-sm p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Durumu sil"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <SortableContext items={columns[status]?.map(task => task.id) || []}>
                    <div className="space-y-2 overflow-y-auto min-h-0 max-h-[520px] sm:max-h-[620px] pr-2">
                      {columns[status]?.map((task) => (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          onEdit={handleEditTask}
                          onDelete={onTaskDelete}
                          onTaskUpdate={onTaskUpdate}
                          onCardClick={handleCardClick}
                          canDrag={
                            isEmployeeView
                              ? (task.assigned_to === currentUserId)
                              : true
                          }
                          currentUserId={currentUserId}
                          isEmployeeView={isEmployeeView}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              </DroppableColumn>
            </div>
          ))}
          
          {/* Yeni durum ekleme sütunu - sadece yöneticiler için */}
          {!isEmployeeView && (
            <div className="flex-shrink-0 w-72 sm:w-80">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 sm:p-4 min-h-[400px] sm:min-h-[500px] border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                <div className="flex flex-col items-center justify-center h-full">
                                      <div className="text-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3 mx-auto">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Durum Ekle
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Yeni bir durum sütunu oluşturun
                      </p>
                      <button
                        onClick={() => setShowAddStatus(true)}
                        className="px-3 sm:px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors transform hover:scale-105 text-sm sm:text-base"
                      >
                        + Durum Ekle
                      </button>
                    </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <DragOverlay>
          {activeDragTask ? (
            <SortableTaskCard
              task={activeDragTask}
              onEdit={handleEditTask}
              onDelete={onTaskDelete}
              onTaskUpdate={onTaskUpdate}
              isDragging={true}
              isOverlay={true}
              canDrag={false}
              currentUserId={currentUserId}
              isEmployeeView={isEmployeeView}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      
      {/* Task Detail Modal */}
      {detailTask && (
        <TaskDetailModal
          isOpen={!!detailTask}
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onTaskUpdate={onTaskUpdate}
          isEmployeeView={isEmployeeView}
        />
      )}
      
      {/* Label Manager Modal */}
      {showLabelManager && (
        <LabelManagerModal
          open={showLabelManager}
          onClose={() => setShowLabelManager(false)}
          selectedLabelIds={selectedLabelIds}
          setSelectedLabelIds={setSelectedLabelIds}
        />
      )}

      {/* Yeni Durum Ekleme Modal */}
      {showAddStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              Yeni Durum Ekle
            </h3>
            <input
              type="text"
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              placeholder="Durum adı..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              onKeyPress={(e) => e.key === 'Enter' && handleAddStatus()}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddStatus(false);
                  setNewStatusName('');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleAddStatus}
                disabled={!newStatusName.trim()}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </LabelContext.Provider>
  );
};

export default KanbanBoard; 