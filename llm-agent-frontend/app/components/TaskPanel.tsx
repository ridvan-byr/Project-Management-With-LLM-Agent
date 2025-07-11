interface Employee {
  id: number;
  name: string;
  position: string;
}

interface Task {
  id: number;
  assigned_to: number;
  status: string;
}

interface TaskPanelProps {
  employees: Employee[];
  tasks: Task[];
}

const TaskPanel: React.FC<TaskPanelProps> = ({ employees, tasks }) => {
  const getSuggestedEmployee = (category: string) => {
    // Kategoriye göre uygun çalışanları filtrele
    const suitableEmployees = employees.filter(emp => {
      // Pozisyon kontrolü
      const hasMatchingPosition = emp.position.toLowerCase().includes(category.toLowerCase());
      
      // Önceki görevleri kontrol et
      const hasPreviousTasks = tasks.some(task => 
        task.assigned_to === emp.id && 
        task.status !== 'cancelled' && 
        task.status !== 'rejected'
      );

      return hasMatchingPosition || hasPreviousTasks;
    });

    if (suitableEmployees.length === 0) return null;

    // Önceki görevleri olan çalışanları önceliklendir
    const prioritizedEmployees = suitableEmployees.sort((a, b) => {
      const aHasPreviousTasks = tasks.some(task => 
        task.assigned_to === a.id && 
        task.status !== 'cancelled' && 
        task.status !== 'rejected'
      );
      const bHasPreviousTasks = tasks.some(task => 
        task.assigned_to === b.id && 
        task.status !== 'cancelled' && 
        task.status !== 'rejected'
      );

      if (aHasPreviousTasks && !bHasPreviousTasks) return -1;
      if (!aHasPreviousTasks && bHasPreviousTasks) return 1;
      return 0;
    });

    return prioritizedEmployees[0];
  };

  return (
    <div>
      {/* Render the component content */}
    </div>
  );
};

export default TaskPanel; 