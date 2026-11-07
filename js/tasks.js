import { state } from './state.js';
import { addFeed, render } from './ui.js';
import { showTaskModal } from './task-modal.js';
import { showTaskResultModal } from './task-result-modal.js';

export let activeTasks = [];
export let completedTasks = [];

export async function loadTasks() {
  const response = await fetch('data/tasks.json');
  const data = await response.json();
  return data;
}

export function createTask(template) {
  const task = {
    id: template.id + '_' + Date.now(),
    templateId: template.id,
    title: template.title,
    category: template.category,
    priority: template.priority,
    historicalContext: template.historicalContext,
    description: template.description,
    target: { ...template.target },
    deadline: template.deadline,
    timeLeft: template.deadline,
    rewards: template.rewards,
    penalties: template.penalties,
    completionText: template.completionText,
    status: 'active',
    progress: 0,
    createdAt: state.tick,
    announced: false,
  };
  return task;
}

export function updateTasksProgress() {
  activeTasks.forEach(task => {
    task.timeLeft--;

    if (task.target.region) {
      const region = state.regions.find(r => r.id === task.target.region);
      if (region) {
        const ratio = (state.resources[task.target.resource] || 0) / task.target.value;
        task.progress = Math.min(100, Math.floor(ratio * 100));
      }
    } else {
      const ratio = (state.resources[task.target.resource] || 0) / task.target.value;
      task.progress = Math.min(100, Math.floor(ratio * 100));
    }
  });

  activeTasks = activeTasks.filter(task => {
    if (task.progress >= 100) {
      completeTask(task, true);
      return false;
    } else if (task.timeLeft <= 0) {
      completeTask(task, false);
      return false;
    }
    return true;
  });
}

function completeTask(task, success) {
  task.status = success ? 'completed' : 'failed';
  completedTasks.push(task);

  const effects = success ? task.rewards : task.penalties;

  for (const [key, value] of Object.entries(effects)) {
    if (key === 'dossier') continue;

    if (key in state.resources) {
      state.resources[key] += value;
    } else if (key in state.scales) {
      state.scales[key] += value;
    }
  }

  const dossierEntry = {
    type: 'task',
    title: task.title,
    outcome: success ? 'Выполнена' : 'Провалена',
    text: success ? task.completionText : task.penalties.dossier,
    historicalContext: task.historicalContext,
    date: `Месяц ${state.tick}`,
  };

  if (!state.dossier) state.dossier = [];
  state.dossier.push(dossierEntry);

  const message = success
    ? `✅ Задача "${task.title}" выполнена!`
    : `❌ Задача "${task.title}" провалена!`;
  addFeed(message, true);

  render();

  setTimeout(() => {
    showTaskResultModal(task, success, () => {
      render();
    });
  }, 200);
}

let modalQueue = [];
let showingModal = false;

export function initStartingTasks(taskTemplates) {
  modalQueue = [];
  showingModal = false;

  const starters = [
    taskTemplates.templates.find(t => t.id === 'restore_donbass_coal'),
    taskTemplates.templates.find(t => t.id === 'grain_for_cities'),
  ].filter(Boolean);

  const newTasks = starters.map(template => {
    const task = createTask(template);
    activeTasks.push(task);
    addFeed(`📋 Новая задача: ${task.title} (срок: ${task.deadline} мес.)`, true);
    return task;
  });

  showTaskModalsQueue(newTasks);
}

export function showTaskModalsQueue(tasks) {
  tasks.forEach(t => {
    if (!t.announced) modalQueue.push(t);
  });
  processQueue();
}

function processQueue() {
  if (showingModal) return;
  if (modalQueue.length === 0) return;

  showingModal = true;
  const task = modalQueue.shift();

  if (!task) {
    showingModal = false;
    processQueue();
    return;
  }

  task.announced = true;

  setTimeout(() => {
    showTaskModal(task, () => {
      showingModal = false;
      setTimeout(() => processQueue(), 200);
    });
  }, 150);
}

export function checkNewTask(taskTemplates) {
  if (activeTasks.length >= 4) return;
  if (Math.random() > 0.3) return;

  const available = taskTemplates.templates.filter(t =>
    !activeTasks.some(at => at.templateId === t.id) &&
    !completedTasks.some(ct => ct.templateId === t.id)
  );

  if (available.length === 0) return;

  const template = available[Math.floor(Math.random() * available.length)];
  const task = createTask(template);
  activeTasks.push(task);

  addFeed(`📋 Новая задача: ${task.title} (срок: ${task.deadline} мес.)`, true);

  showTaskModalsQueue([task]);
}