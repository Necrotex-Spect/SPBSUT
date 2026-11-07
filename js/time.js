import { state } from './state.js';
import { addFeed, render } from './ui.js';
import { tick } from './economy.js';
import { updateTasksProgress, checkNewTask } from './tasks.js';
import { showMeeting, showRandomEvent } from './events.js';

let eventData = null;
let lastFrame = 0;
let running = false;

export function setEventData(data) { eventData = data; }

export function startClock() {
  if (running) return;
  running = true;
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.2);
  lastFrame = now;

  if (!state.paused && state.speed > 0) {
    state.timeAccumulator += dt * state.speed;

    while (state.timeAccumulator >= state.MONTH_DURATION) {
      state.timeAccumulator -= state.MONTH_DURATION;
      advanceMonth();
    }
  }

  updateTimeUI();
  requestAnimationFrame(loop);
}

function advanceMonth() {
  if (state.tick >= 48) {
    if (state.speed > 0) {
      state.paused = true;
      addFeed('🏁 Акт I завершён!');
    }
    return;
  }

  tick();
  updateTasksProgress();
  state.tick++;

  if (state.delayedEffects && state.delayedEffects.length) {
    const ready = state.delayedEffects.filter(e => e.targetTick <= state.tick);
    state.delayedEffects = state.delayedEffects.filter(e => e.targetTick > state.tick);
    ready.forEach(e => {
      for (const [k, v] of Object.entries(e.effects)) {
        if (k in state.resources) state.resources[k] += v;
        else if (k in state.scales) state.scales[k] += v;
      }
      addFeed(`📋 Последствия «${e.eventTitle}»: ${e.consequence}`);
    });
  }

  const meeting = state.meetings.find(m => m.month === state.tick);
  if (meeting) showMeeting(meeting);

  if (state.tick % 6 === 0 && eventData && Math.random() > 0.4) {
    const ev = eventData.randomEvents[Math.floor(Math.random() * eventData.randomEvents.length)];
    showRandomEvent(ev);
  }

  if (state.tick % 10 === 0 && eventData) checkNewTask(eventData);

  render();
}

function updateTimeUI() {
  const progress = state.timeAccumulator / state.MONTH_DURATION;
  const bar = document.getElementById('time-progress-fill');
  if (bar) bar.style.width = `${progress * 100}%`;

  const totalMonths = state.tick;
  const year = 1946 + Math.floor(totalMonths / 12);
  const monthIndex = totalMonths % 12;

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const dayInMonth = Math.min(30, 1 + Math.floor(progress * 30));

  const dateEl = document.getElementById('game-date');
  if (dateEl) {
    dateEl.textContent = `${dayInMonth} ${monthNames[monthIndex]} ${year}`;
  }

  const speedEl = document.getElementById('speed-label');
  if (speedEl) {
    speedEl.textContent = state.paused ? '⏸ Пауза' :
                          state.speed === 1 ? '▶ x1' :
                          state.speed === 2 ? '▶▶ x2' :
                          state.speed === 3 ? '▶▶▶ x3' : '▶';
  }
}

export function togglePause() {
  state.paused = !state.paused;
}

export function setSpeed(s) {
  state.speed = s;
  state.paused = false;
}