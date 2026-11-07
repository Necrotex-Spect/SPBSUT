import { state } from './state.js';

let currentCallback = null;

export function showTaskModal(task, onClose) {
  currentCallback = onClose;
  state.paused = true;

  const modal = document.getElementById('task-modal');
  const card = document.getElementById('task-modal-card');

  if (!modal || !card) {
    console.error('❌ task-modal не найден в DOM');
    state.paused = false;
    if (onClose) onClose();
    return;
  }

  const priorityColor = task.priority === 'critical' ? '#ff6b6b' :
                        task.priority === 'high' ? '#ffd93d' : '#6bcb77';
  const priorityLabel = task.priority === 'critical' ? 'КРИТИЧЕСКАЯ' :
                        task.priority === 'high' ? 'ВАЖНАЯ' : 'ОБЫЧНАЯ';
  const priorityIcon = task.priority === 'critical' ? '🔴' :
                       task.priority === 'high' ? '🟡' : '🟢';

  const rewardsHTML = formatEffectsList(task.rewards);
  const penaltiesHTML = formatEffectsList(task.penalties);

  const targetRes = getResourceName(task.target.resource);
  const targetRegion = task.target.region
    ? (state.regions.find(r => r.id === task.target.region)?.name || '—')
    : 'Вся страна';

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
      <span style="
        background: ${priorityColor}22; color: ${priorityColor};
        border: 1px solid ${priorityColor}66;
        padding: 4px 10px; border-radius: 4px;
        font-size: 11px; font-weight: 700; letter-spacing: 1px;
      ">${priorityIcon} ${priorityLabel}</span>
      <span style="font-size: 12px; color: #8a9aaa;">⏱ Срок: ${task.deadline} мес.</span>
    </div>

    <h2 style="color:#ffd27a; font-size:22px; margin-bottom:12px; line-height:1.3;">📋 ${task.title}</h2>

    <div style="
      background: rgba(255,210,122,0.08);
      border-left: 3px solid #ffd27a;
      padding: 14px; margin-bottom: 18px;
      font-size: 13px; line-height: 1.7;
      color: #c8d4e0; white-space: pre-line;
      border-radius: 0 4px 4px 0;
      max-height: 220px; overflow-y: auto;
    ">
      <div style="font-size: 11px; font-weight: 700; color: #ffd27a; margin-bottom: 8px; letter-spacing: 1px;">
        📜 ИСТОРИЧЕСКАЯ СПРАВКА
      </div>
      ${task.historicalContext}
    </div>

    <div style="margin-bottom: 18px;">
      <div style="font-size: 11px; font-weight: 700; color: #ffd27a; margin-bottom: 8px; letter-spacing: 1px;">🎯 ЗАДАЧА</div>
      <div style="font-size: 13px; line-height: 1.6; color: #c8d4e0; white-space: pre-line;">${task.description}</div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px;">
      <div style="background:rgba(0,0,0,0.3); border:1px solid #3a4a5a; border-radius:6px; padding:10px;">
        <div style="font-size:10px; opacity:0.6; margin-bottom:4px;">ЦЕЛЬ</div>
        <div style="font-size:13px; font-weight:600; color:#ffd27a;">${targetRes}</div>
        <div style="font-size:11px; opacity:0.7; margin-top:2px;">${targetRegion} · ${task.target.value} ед.</div>
      </div>
      <div style="background:rgba(0,0,0,0.3); border:1px solid #3a4a5a; border-radius:6px; padding:10px;">
        <div style="font-size:10px; opacity:0.6; margin-bottom:4px;">СРОК</div>
        <div style="font-size:13px; font-weight:600; color:#ffd93d;">${task.deadline} мес.</div>
        <div style="font-size:11px; opacity:0.7; margin-top:2px;">до месяца ${state.tick + task.deadline}</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px;">
      <div style="background:rgba(122,255,154,0.05); border:1px solid #2a5a3a; border-radius:6px; padding:10px;">
        <div style="font-size:11px; font-weight:700; color:#7aff9a; margin-bottom:6px; letter-spacing:1px;">✅ НАГРАДА</div>
        <div style="font-size:12px; line-height:1.6; color:#c8d4e0;">${rewardsHTML}</div>
      </div>
      <div style="background:rgba(255,122,122,0.05); border:1px solid #5a2a2a; border-radius:6px; padding:10px;">
        <div style="font-size:11px; font-weight:700; color:#ff7a7a; margin-bottom:6px; letter-spacing:1px;">⚠ ПРОВАЛ</div>
        <div style="font-size:12px; line-height:1.6; color:#c8d4e0;">${penaltiesHTML}</div>
      </div>
    </div>

    <button id="task-modal-accept" class="primary" style="width:100%; padding:14px; font-size:15px; font-weight:600;">
      ✔ Принять задачу
    </button>
  `;

  modal.style.display = 'flex';
  modal.classList.add('open');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'modalCardIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both';
  modal.style.animation = 'modalBgIn 0.3s ease forwards';

  document.getElementById('task-modal-accept').onclick = () => closeTaskModal();

  const escHandler = (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      e.preventDefault();
      e.stopPropagation();
      closeTaskModal();
    }
  };
  document.addEventListener('keydown', escHandler, true);
  modal._escHandler = escHandler;

  console.log('✅ Модалка задачи показана:', task.title);
}

function closeTaskModal() {
  const modal = document.getElementById('task-modal');
  const card = document.getElementById('task-modal-card');
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

function formatEffectsList(effects) {
  if (!effects) return '<span style="opacity:0.5;">—</span>';
  const parts = [];
  for (const [k, v] of Object.entries(effects)) {
    if (k === 'dossier' || k === 'tech') continue;
    const sign = v > 0 ? '+' : '';
    const color = v > 0 ? '#7aff9a' : '#ff7a7a';
    parts.push(`<span style="color:${color};">${sign}${v}</span> ${getResourceName(k)}`);
  }
  return parts.join('<br>') || '<span style="opacity:0.5;">—</span>';
}

function getResourceName(key) {
  const names = {
    coal: '⛏ Уголь', metal: '🔩 Металл', grain: '🌾 Зерно',
    oil: '🛢 Нефть', science: '🔬 Наука', wood: '🌲 Лес',
    goods: '📦 Товары', trust: '❤ Доверие', efficiency: '📈 План',
    tech: '⚡ Тех', tension: '☢ Напряжение',
  };
  return names[key] || key;
}