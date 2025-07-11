import React, { useState } from 'react';
import { useLabelContext } from './KanbanBoard';

const LABEL_COLORS = [
  '#27ae60', // yeşil
  '#2980b9', // mavi
  '#e67e22', // turuncu
  '#e74c3c', // kırmızı
  '#8e44ad', // mor
  '#f1c40f', // sarı
  '#34495e', // koyu mavi
];

interface LabelManagerModalProps {
  open: boolean;
  onClose: () => void;
  selectedLabelIds: string[];
  setSelectedLabelIds: (fn: (prev: string[]) => string[]) => void;
}

const LabelManagerModal: React.FC<LabelManagerModalProps> = ({ open, onClose, selectedLabelIds, setSelectedLabelIds }) => {
  const { labels, addLabel } = useLabelContext();
  const [newLabel, setNewLabel] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 sm:p-8 relative border border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-400 text-2xl">×</button>
        <h2 className="text-xl font-bold mb-6 text-center">Etiketler</h2>
        <div className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LABEL_COLORS.map(color => {
              const label = labels.find(l => l.color === color);
              const isSelected = label && selectedLabelIds.includes(label.id);
              return (
                <div key={color} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-2 min-w-0 overflow-hidden">
                  <div className="w-7 h-7 rounded-lg flex-shrink-0" style={{ background: color }} />
                  {label ? (
                    <>
                      <span className="font-semibold text-xs truncate max-w-[100px]" style={{ color: '#fff', background: color, borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>{label.name}</span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedLabelIds(prev => {
                            if (isSelected) {
                              return prev.filter(id => id !== label.id);
                            } else {
                              return [...prev, label.id];
                            }
                          });
                        }}
                        className="ml-2 w-4 h-4 accent-blue-500"
                        title={isSelected ? 'Karta ekli' : 'Karta ekle'}
                      />
                    </>
                  ) : (
                    <span className="italic text-gray-400 text-xs">(boş)</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-300 text-sm">Yeni etiket oluştur</h3>
          <div className="flex flex-col sm:flex-row gap-3 items-center mb-3">
            <div className="flex gap-2 flex-wrap">
              {LABEL_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`w-7 h-7 rounded-full border-2 ${newLabelColor === color ? 'border-blue-500 ring-2 ring-blue-400' : 'border-gray-300 dark:border-gray-700'} ${labels.some(l => l.color === color) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ background: color }}
                  disabled={labels.some(l => l.color === color)}
                  onClick={() => setNewLabelColor(color)}
                />
              ))}
            </div>
            <input
              className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-3 py-2 text-gray-900 dark:text-white w-32 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Etiket adı"
              maxLength={20}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold transition"
              onClick={() => {
                if (newLabel.trim() && LABEL_COLORS.includes(newLabelColor) && !labels.some(l => l.color === newLabelColor)) {
                  const id = newLabel.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Math.random().toString(36).slice(2, 7);
                  addLabel({ id, name: newLabel, color: newLabelColor });
                  setSelectedLabelIds(prev => [...prev, id]);
                  setNewLabel('');
                }
              }}
            >Ekle</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabelManagerModal; 