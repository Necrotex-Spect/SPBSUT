import { state } from './state.js';
import { addFeed, render, eventHistoryMapper } from './ui.js';
import { showTaskModal } from './task-modal.js';
import { showTaskResultModal } from './task-result-modal.js';
import { showToast } from './screens.js';

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

    // Calculate progress based on current resources toward target
    // Progress increases as resources accumulate, but task can also complete
    // if time runs out (with appropriate reward/penalty based on progress level)
    if (task.target.region) {
      const region = state.regions.find(r => r.id === task.target.region);
      if (region) {
        const currentAmount = state.resources[task.target.resource] || 0;
        // Increase progress proportionally to resource growth
        const progressIncrease = Math.min(100, Math.floor((currentAmount / task.target.value) * 100));
        // Only increase progress, don't decrease it
        task.progress = Math.max(task.progress, progressIncrease);
      }
    } else {
      const currentAmount = state.resources[task.target.resource] || 0;
      const progressIncrease = Math.min(100, Math.floor((currentAmount / task.target.value) * 100));
      task.progress = Math.max(task.progress, progressIncrease);
    }
  });

  // Filter tasks: complete if progress >= 100, or if time ran out with low progress
  activeTasks = activeTasks.filter(task => {
    if (task.progress >= 100) {
      // Task completed - reward based on progress level
      const completionBonus = task.progress >= 90 ? 1.5 : 1.0;
      completeTask(task, true);
      return false;
    } else if (task.timeLeft <= 0) {
      // Task failed - penalty based on how far progress got
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
    if (key === 'trust') continue;  // Trust mechanic disabled

    if (key in state.resources) {
      state.resources[key] += value;
    } else if (key in state.scales) {
      state.scales[key] = Math.max(0, Math.min(100, state.scales[key] + value));
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

// Use historical event mapping for feed message
const historicalKey = success ? 'task_complete_1946' : 'task_fail_1946';
const historicalMessage = eventHistoryMapper[historicalKey] || message;
addFeed(historicalMessage, true);

  render();

  setTimeout(() => {
    showTaskResultModal(task, success, () => {
      render();
    });
  }, 200);
}

let modalQueue = [];
let showingModal = false;

// Show task modal in the center of the screen
export function showTaskModalCenter(task) {
  // This function shows a task modal at the center of the screen
  // Similar to the original implementation
  if (task.announced) return;
  task.announced = true;
  
  setTimeout(() => {
    showTaskModal(task, () => {
      // After task modal is closed, process next task
      showingModal = false;
      setTimeout(() => processQueue(), 200);
    });
  }, 150);
}

export function initStartingTasks(taskTemplates) {
  modalQueue = [];
  showingModal = false;

  // Immediately create starting tasks right after game starts
  // These are the critical early-game tasks that should be available from day 1
  const starters = [
    taskTemplates.templates.find(t => t.id === 'restore_donbass_coal'),
    taskTemplates.templates.find(t => t.id === 'grain_for_cities'),
  ].filter(Boolean);

  const newTasks = starters.map(template => {
    const task = createTask(template);
    activeTasks.push(task);
    // Use historical event mapping for new task feed
    const historicalKey = 'new_task_1946';
    const historicalMessage = eventHistoryMapper[historicalKey] || `📋 Новая задача: ${task.title} (срок: ${task.deadline} мес.)`;
    addFeed(historicalMessage, true);
    // Show compact toast notification about new task
    showToast(`📋 Задача: ${task.title}`, 3000);
    // Show task modal in the center of the screen - immediately, not after delay
    showTaskModalImmediate(task);
    return task;
  });

  // Show any additional tasks that may accumulate
  showTaskModalsQueue(newTasks);
}

// Show task modal immediately in the center of screen
export function showTaskModalImmediate(task) {
  if (task.announced) return;
  task.announced = true;
  
  setTimeout(() => {
    showTaskModal(task, () => {
      // After task modal is closed, process next task immediately
      showingModal = false;
      setTimeout(() => processQueue(), 100);
    });
  }, 100);
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

  // Use historical event mapping for new task feed
  const historicalKey = 'new_task_1946';
  const historicalMessage = eventHistoryMapper[historicalKey] || `📋 Новая задача: ${task.title} (срок: ${task.deadline} мес.)`;
  addFeed(historicalMessage, true);
  
  // Show task modal in the center of the screen
  showTaskModalCenter(task);
  // Show compact toast notification about new task
  showToast(`📋 Новая задача: ${task.title}`, 3000);

  showTaskModalsQueue([task]);
}