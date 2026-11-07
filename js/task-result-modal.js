import { state } from './state.js';

let currentCallback = null;

export function showTaskResultModal(task, success, onClose) {
  currentCallback = onClose;
  state.paused = true;

  const modal = document.getElementById('task-result-modal');
  const card = document.getElementById('task-result-card');

  if (!modal || !card) {
    console.error('❌ task-result-modal не найден в DOM');
    state.paused = false;
    if (onClose) onClose();
    return;
  }

  const accentColor = success ? '#7aff9a' : '#ff7a7a';
  const accentBg = success ? 'rgba(122,255,154,0.08)' : 'rgba(255,122,122,0.08)';
  const accentBorder = success ? '#2a5a3a' : '#5a2a2a';

  const statusIcon = success ? '✅' : '❌';
  const statusLabel = success ? 'ЗАДАЧА ВЫПОЛНЕНА' : 'ЗАДАЧА ПРОВАЛЕНА';
  const statusSub = success
    ? 'Вы справились с поставленной целью'
    : 'Вы не успели выполнить задачу в срок';

  const historyText = success
    ? (task.completionText || 'В реальной истории эта задача была успешно решена.')
    : (task.penalties?.dossier || 'В реальной истории провал этой задачи привёл к тяжёлым последствиям.');

  const effects = success ? task.rewards : task.penalties;
  const effectsHTML = formatEffectsList(effects, success);

  const consequenceText = success
    ? (task.completionText || 'Задача выполнена. Страна получила передышку.')
    : (task.penalties?.dossier || 'Задача провалена. Последствия оказались тяжёлыми.');

  card.innerHTML = `
    <div style="
      background: ${accentBg};
      border: 1px solid ${accentBorder};
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
    ">
      <div style="font-size: 48px; margin-bottom: 8px;">${statusIcon}</div>
      <div style="
        font-size: 18px; font-weight: 800; letter-spacing: 1.5px;
        color: ${accentColor};
        margin-bottom: 4px;
      ">${statusLabel}</div>
      <div style="font-size: 13px; color: #8a9aaa;">${statusSub}</div>
    </div>

    <h2 style="
      color: #ffd27a; font-size: 20px; margin-bottom: 16px;
      line-height: 1.3; text-align: center;
    ">📋 ${task.title}</h2>

    <div style="
      background: rgba(255,210,122,0.08);
      border-left: 3px solid #ffd27a;
      padding: 14px; margin-bottom: 16px;
      font-size: 13px; line-height: 1.7;
      color: #c8d4e0; white-space: pre-line;
      border-radius: 0 4px 4px 0;
      max-height: 220px; overflow-y: auto;
    ">
      <div style="
        font-size: 11px; font-weight: 700; color: #ffd27a;
        margin-bottom: 8px; letter-spacing: 1px;
      ">📜 ИСТОРИЧЕСКАЯ СПРАВКА</div>
      ${historyText}
    </div>

    <div style="
      background: ${accentBg};
      border: 1px solid ${accentBorder};
      border-radius: 6px; padding: 14px;
      margin-bottom: 16px;
    ">
      <div style="
        font-size: 11px; font-weight: 700; color: ${accentColor};
        margin-bottom: 8px; letter-spacing: 1px;
      ">${success ? '🎯 ЧТО ПРОИЗОШЛО' : '⚠ ПОСЛЕДСТВИЯ'}</div>
      <div style="
        font-size: 13px; line-height: 1.7;
        color: #c8d4e0; white-space: pre-line;
      ">${consequenceText}</div>
    </div>

    <div style="margin-bottom: 20px;">
      <div style="
        font-size: 11px; font-weight: 700; color: ${accentColor};
        margin-bottom: 8px; letter-spacing: 1px;
      ">${success ? '✅ ПОЛУЧЕНО' : '📉 ПОТЕРЯНО'}</div>
      <div style="
        display: grid; grid-template-columns: 1fr 1fr;
        gap: 8px;
      ">
        ${effectsHTML}
      </div>
    </div>

    <button id="task-result-continue" class="primary" style="
      width: 100%; padding: 14px; font-size: 15px; font-weight: 600;
    ">${success ? '▶ Продолжить' : '▶ Принять последствия'}</button>
  `;

  modal.style.display = 'flex';
  modal.classList.add('open');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'modalCardIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both';
  modal.style.animation = 'modalBgIn 0.3s ease forwards';

  document.getElementById('task-result-continue').onclick = () => closeResultModal();

  const escHandler = (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      e.preventDefault();
      e.stopPropagation();
      closeResultModal();
    }
  };
  document.addEventListener('keydown', escHandler, true);
  modal._escHandler = escHandler;
}

function formatEffectsList(effects, isPositive) {
  if (!effects) return '<div style="opacity:0.5;">—</div>';

  const cards = [];
  for (const [k, v] of Object.entries(effects)) {
    if (k === 'dossier') continue;

    const icon = getResourceIcon(k);
    const name = getResourceName(k);
    const sign = v > 0 ? '+' : '';
    const color = v > 0 ? '#7aff9a' : '#ff7a7a';

    cards.push(`
      <div style="
        background: rgba(0,0,0,0.3);
        border: 1px solid #3a4a5a;
        border-radius: 4px;
        padding: 8px 10px;
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px;
      ">
        <div style="font-size: 12px; color: #c8d4e0;">${icon} ${name}</div>
        <div style="font-size: 14px; font-weight: 700; color: ${color};">${sign}${v}</div>
      </div>
    `);
  }

  if (cards.length === 0) {
    return '<div style="opacity:0.5; grid-column: 1 / -1;">Эффектов нет</div>';
  }

  return cards.join('');
}

function getResourceName(key) {
  const names = {
    coal: 'Уголь', metal: 'Металл', grain: 'Зерно',
    oil: 'Нефть', science: 'Наука', wood: 'Лес',
    goods: 'Товары', trust: 'Доверие', efficiency: 'План',
    tech: 'Тех', tension: 'Напряжение',
  };
  return names[key] || key;
}

function getResourceIcon(key) {
  const icons = {
    coal: '⛏', metal: '🔩', grain: '🌾',
    oil: '🛢', science: '🔬', wood: '🌲',
    goods: '📦', trust: '❤', efficiency: '📈',
    tech: '⚡', tension: '☢',
  };
  return icons[key] || '•';
}

function closeResultModal() {
  const modal = document.getElementById('task-result-modal');
  const card = document.getElementById('task-result-card');
  if (!modal) return;

  if (card) card.style.animation = 'modalCardOut 0.3s ease forwards';
  modal.style.animation = 'modalBgOut 0.3s ease forwards';

  if (modal._escHandler) {
    document.removeEventListener('keydown', modal._escHandler, true);
    modal._escHandler = null;
  }

  setTimeout(() => {
    modal.style.display = 'none';
    modal.classList.remove('open');
    modal.style.animation = '';
    if (card) card.style.animation = '';

    state.paused = false;

    const cb = currentCallback;
    currentCallback = null;
    if (cb) cb();
  }, 300);
}