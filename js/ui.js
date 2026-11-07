import { state } from './state.js';

let lastResources = {};

export function render() {
  ['coal', 'metal', 'grain', 'oil', 'science', 'wood', 'goods'].forEach(k => {
    const valEl = document.getElementById('r-' + k);
    const deltaEl = document.getElementById('d-' + k);
    if (!valEl) return;

    const newVal = Math.floor(state.resources[k] || 0);

    if (lastResources[k] !== undefined && lastResources[k] !== newVal) {
      const resEl = valEl.closest('.res');
      if (resEl) {
        resEl.classList.remove('flash');
        void resEl.offsetWidth;
        resEl.classList.add('flash');
      }
    }
    lastResources[k] = newVal;

    valEl.textContent = newVal;

    if (deltaEl) {
      const d = state.deltas[k] || 0;
      if (d > 0) {
        deltaEl.textContent = `+${d}`;
        deltaEl.className = 'delta pos';
      } else if (d < 0) {
        deltaEl.textContent = `${d}`;
        deltaEl.className = 'delta neg';
      } else {
        deltaEl.textContent = '';
        deltaEl.className = 'delta';
      }
    }
  });

  const trustEl = document.getElementById('r-trust');
  const effEl = document.getElementById('r-eff');
  if (trustEl) trustEl.textContent = Math.floor(state.scales.trust);
  if (effEl) effEl.textContent = Math.floor(state.scales.efficiency);

  renderFeed();
  renderTasks();
}

let lastFeedCount = 0;

function renderFeed() {
  const list = document.getElementById('feed-list');
  if (!list) return;

  if (state.feed.length === lastFeedCount && list.children.length === state.feed.length) return;
  lastFeedCount = state.feed.length;

  list.innerHTML = state.feed.map((f, i) =>
    `<div class="feed-item ${f.isMeeting ? 'meeting' : ''}" style="animation-delay:${Math.min(i * 0.03, 0.3)}s">М${f.tick}: ${f.text}</div>`
  ).join('');
}

export function selectRegion(id) {
  state.selectedRegion = id;
  const r = state.regions.find(x => x.id === id);
  if (!r) return;

  // 1. Разворачиваем штаб, если он был свёрнут
  const side = document.getElementById('side');
  const toggleBtn = document.getElementById('side-toggle');
  if (side && side.classList.contains('collapsed')) {
    side.classList.remove('collapsed');
    if (toggleBtn) {
      toggleBtn.classList.remove('collapsed');
      toggleBtn.textContent = '▶';
    }
  }

  const nameEl = document.getElementById('rp-name');
  const infoEl = document.getElementById('rp-info');
  const bldEl = document.getElementById('rp-buildings');
  const actEl = document.getElementById('rp-actions');
  const panel = document.getElementById('region-panel');

  if (panel) {
    panel.style.animation = 'none';
    void panel.offsetWidth;
    panel.style.animation = 'fadeInUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both';
    
    // 2. Плавно прокручиваем штаб прямо к характеристикам выбранного города
    setTimeout(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  if (nameEl) nameEl.textContent = r.name;
  if (infoEl) infoEl.textContent = `Специализация: ${r.spec} · Слотов: ${r.slots} · Занято: ${r.buildings.length}`;

  if (bldEl) {
    bldEl.innerHTML = '<div style="font-size:12px; opacity:0.7; margin-bottom:4px;">Постройки:</div>';
    r.buildings.forEach((bId, i) => {
      const bType = bId.split('_')[0];
      const b = state.buildings[bType];
      if (!b) return;
      const div = document.createElement('div');
      div.style.cssText = `font-size:13px; padding:2px 0; animation: fadeInUp 0.3s ease ${i * 0.05}s both;`;
      div.textContent = `${b.icon} ${b.name}`;
      bldEl.appendChild(div);
    });
  }

  if (actEl) {
    actEl.innerHTML = '';
    Object.keys(state.buildings).forEach(bId => {
      const b = state.buildings[bId];
      const btn = document.createElement('button');
      btn.textContent = `+ ${b.icon} ${b.name}`;
      btn.style.cssText = 'margin: 2px; font-size: 12px; padding: 6px 10px; min-height: 32px;';
      btn.onclick = () => {
        import('./economy.js').then(({ build }) => {
          const result = build(r.id, bId);
          if (result && result.error) {
            flashStatus(result.error);
            btn.style.animation = 'shake 0.4s';
            setTimeout(() => { btn.style.animation = ''; }, 400);
          } else {
            selectRegion(id);
            render();
          }
        });
      };
      actEl.appendChild(btn);
    });
  }

  // ОТПРАВЛЯЕМ СОБЫТИЕ ДЛЯ ТУТОРИАЛА
  window.dispatchEvent(new CustomEvent('game-action', { detail: { type: 'region' } }));

  import('./scene.js').then(({ highlightRegion }) => highlightRegion(id)).catch(() => {});
}

export function addFeed(text, isMeeting = false) {
  state.feed.unshift({ tick: state.tick, text, isMeeting });
  if (state.feed.length > 30) state.feed.pop();
}

export function flashStatus(text) {
  const s = document.getElementById('status');
  if (!s) return;
  s.textContent = text;
  s.style.color = '#ff7a7a';
  s.style.animation = 'none';
  void s.offsetWidth;
  s.style.animation = 'shake 0.3s';
  setTimeout(() => {
    if (s.textContent === text) {
      s.textContent = '';
      s.style.color = '';
    }
  }, 2500);
}

let lastTasksHash = '';

export function renderTasks() {
  const taskPanel = document.getElementById('task-panel');
  if (!taskPanel) return;

  import('./tasks.js').then(({ activeTasks, completedTasks }) => {
    const hash = activeTasks.map(t => `${t.id}:${t.progress}:${t.timeLeft}`).join('|') +
                 '#' + completedTasks.length;
    if (hash === lastTasksHash) return;
    lastTasksHash = hash;

    if (activeTasks.length === 0 && completedTasks.length === 0) {
      taskPanel.innerHTML = '<div class="empty-state">Нет активных задач</div>';
      return;
    }

    let html = '';

    if (activeTasks.length > 0) {
      html += '<div class="section-label">📋 Активные задачи</div>';
      activeTasks.forEach((task, i) => {
        const priorityClass = task.priority === 'critical' ? 'critical' :
                              task.priority === 'high' ? 'high' : 'medium';
        const isUrgent = task.timeLeft <= 3;
        const isDone = task.progress >= 100;
        const fillClass = isDone ? 'done' : (isUrgent ? 'danger' : '');

        html += `
          <div class="task-card ${priorityClass}" onclick="window.openTaskModal('${task.id}')" style="cursor: pointer; animation: cardIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.08}s both;">
            <div class="task-meta">
              <div class="task-title">${task.title}</div>
              <div class="task-timer ${isUrgent ? 'urgent' : ''}">⏱ ${task.timeLeft} мес.</div>
            </div>
            <div class="task-desc">${task.description.split('\n')[0]}</div>
            <div class="task-progress-bar">
              <div class="task-progress-fill ${fillClass}" style="width: ${task.progress}%"></div>
            </div>
            <div class="task-stats">
              Прогресс: ${task.progress}% ·
              ${getResourceName(task.target.resource)}: ${state.resources[task.target.resource] || 0}/${task.target.value}
            </div>
          </div>
        `;
      });
    }

    if (completedTasks.length > 0) {
      html += '<div class="section-label completed">✓ Завершённые</div>';
      completedTasks.slice(-3).forEach(task => {
        const cls = task.status === 'completed' ? 'completed' : 'failed';
        const icon = task.status === 'completed' ? '✅' : '❌';
        html += `
          <div class="task-card ${cls}" style="animation: cardIn 0.3s ease both;">
            <div class="task-title">${icon} ${task.title}</div>
            <div class="task-desc" style="opacity:0.6;">${task.status === 'completed' ? 'Выполнена' : 'Провалена'}</div>
          </div>
        `;
      });
    }

    taskPanel.innerHTML = html;
  });
}

// Глобальная функция для вызова модалки из HTML
window.openTaskModal = (taskId) => {
  import('./tasks.js').then(({ activeTasks }) => {
    const task = activeTasks.find(t => t.id === taskId);
    if (task) {
      // Ставим игру на паузу при открытии задачи
      state.paused = true;
      
      import('./task-modal.js').then(({ showTaskModal }) => {
        showTaskModal(task, () => {
          // После закрытия снимаем паузу (если не открыто другое меню)
          state.paused = false;
        });
      });
    }
  });
};

export function renderDossier() {
  const modal = document.getElementById('dossier-modal');
  const list = document.getElementById('dossier-list');
  if (!modal || !list) return;

  // Ставим игру на паузу
  state.paused = true;

  if (!state.dossier || state.dossier.length === 0) {
    list.innerHTML = '<div class="empty-state">Досье пока пусто. Принимайте решения — они сохранятся здесь.</div>';
  } else {
    list.innerHTML = state.dossier.slice().reverse().map((d, i) => `
      <div style="
        background: rgba(255,210,122,0.08);
        border-left: 3px solid #ffd27a;
        padding: 12px;
        margin-bottom: 12px;
        border-radius: 4px;
        animation: fadeInUp 0.4s ease ${i * 0.05}s both;
      ">
        <div style="font-weight:600; color:#ffd27a; margin-bottom:4px;">
          ${d.type === 'task' ? '📋' : d.type === 'meeting' ? '🏛' : '⚡'} ${d.title}
        </div>
        <div style="font-size:11px; opacity:0.6; margin-bottom:8px;">${d.date || ''}</div>
        ${d.historicalContext ? `<div style="font-size:12px; margin-bottom:8px; line-height:1.5; white-space:pre-line;"><strong>Контекст:</strong><br>${d.historicalContext}</div>` : ''}
        ${d.choice ? `<div style="font-size:12px; margin-bottom:6px;"><strong>Решение:</strong> ${d.choice}</div>` : ''}
        ${d.outcome ? `<div style="font-size:12px; margin-bottom:6px;"><strong>Итог:</strong> ${d.outcome}</div>` : ''}
        <div style="font-size:12px; line-height:1.5; white-space:pre-line;">${d.text}</div>
      </div>
    `).join('');
  }

  modal.style.display = 'flex';
  modal.style.animation = 'modalBgIn 0.3s ease forwards';
}

export function renderAllTasks() {
  const modal = document.getElementById('tasks-modal');
  const list = document.getElementById('tasks-list');
  if (!modal || !list) return;

  // Ставим игру на паузу
  state.paused = true;

  import('./tasks.js').then(({ activeTasks, completedTasks }) => {
    if (activeTasks.length === 0 && completedTasks.length === 0) {
      list.innerHTML = '<div class="empty-state">Задач пока нет</div>';
    } else {
      let html = '';

      if (activeTasks.length > 0) {
        html += '<div class="section-label">📋 Активные задачи</div>';
        activeTasks.forEach(task => {
          html += renderTaskDetail(task);
        });
      }

      if (completedTasks.length > 0) {
        html += '<div class="section-label completed">✓ Завершённые</div>';
        completedTasks.slice().reverse().forEach(task => {
          html += renderTaskDetail(task, true);
        });
      }

      list.innerHTML = html;
    }

    modal.style.display = 'flex';
    modal.style.animation = 'modalBgIn 0.3s ease forwards';
  });
}

function renderTaskDetail(task, isCompleted = false) {
  const priorityClass = task.priority === 'critical' ? 'critical' :
                        task.priority === 'high' ? 'high' : 'medium';
  const statusIcon = isCompleted ? (task.status === 'completed' ? '✅' : '❌') : '📋';

  return `
    <div class="task-card ${priorityClass} ${isCompleted ? task.status : ''}" style="margin-bottom: 16px; animation: fadeInUp 0.4s ease both;">
      <div class="task-meta">
        <div class="task-title">${statusIcon} ${task.title}</div>
        ${!isCompleted ? `<div class="task-timer ${task.timeLeft <= 3 ? 'urgent' : ''}">⏱ ${task.timeLeft} мес.</div>` : ''}
      </div>
      <div style="font-size:12px; opacity:0.8; margin: 8px 0; line-height:1.5; white-space:pre-line;">${task.description}</div>
      ${!isCompleted ? `
        <div class="task-progress-bar">
          <div class="task-progress-fill ${task.progress >= 100 ? 'done' : ''}" style="width: ${task.progress}%"></div>
        </div>
        <div class="task-stats">
          Прогресс: ${task.progress}% ·
          ${getResourceName(task.target.resource)}: ${state.resources[task.target.resource] || 0}/${task.target.value}
        </div>
      ` : ''}
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
        <div style="font-size:11px; opacity:0.6; margin-bottom:4px;">📜 Исторический контекст:</div>
        <div style="font-size:12px; line-height:1.5; white-space:pre-line; opacity:0.9;">${task.historicalContext}</div>
      </div>
      ${isCompleted ? `
        <div style="margin-top: 8px; font-size:12px; line-height:1.5; white-space:pre-line;">
          <strong>${task.status === 'completed' ? '✅ Итог:' : '❌ Последствия:'}</strong><br>
          ${task.status === 'completed' ? task.completionText : task.penalties.dossier}
        </div>
      ` : ''}
    </div>
  `;
}

export function getResourceName(key) {
  const names = {
    coal: '⛏ Уголь', metal: '🔩 Металл', grain: '🌾 Зерно',
    oil: '🛢 Нефть', science: '🔬 Наука', wood: '🌲 Лес',
    goods: '📦 Товары', trust: '❤ Доверие', efficiency: '📈 План',
    tech: '⚡ Тех', tension: '☢ Напряжение',
  };
  return names[key] || key;
}

export function formatEffects(effects) {
  if (!effects) return '';
  const parts = [];
  for (const [k, v] of Object.entries(effects)) {
    const sign = v > 0 ? '+' : '';
    parts.push(`${sign}${v} ${getResourceName(k)}`);
  }
  return parts.join(', ');
}

export function setupModals() {
  const side = document.getElementById('side');

  // 1. Кнопка-язычок для сворачивания и разворачивания боковой панели (Штаба)
  if (side && !document.getElementById('side-toggle')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'side-toggle';
    toggleBtn.title = 'Свернуть / Развернуть Штаб';
    toggleBtn.textContent = '▶';

    // На мобильных устройствах по умолчанию сворачиваем панель, чтобы открыть карту
    const isMobileOrTablet = window.innerWidth <= 1024 || window.innerHeight <= 550;
    if (isMobileOrTablet) {
      side.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
      toggleBtn.textContent = '◀';
    }

    toggleBtn.onclick = () => {
      const isCollapsed = side.classList.toggle('collapsed');
      toggleBtn.classList.toggle('collapsed', isCollapsed);
      toggleBtn.textContent = isCollapsed ? '◀' : '▶';
    };

    side.parentNode.insertBefore(toggleBtn, side.nextSibling);
  }

  // 2. Модальное окно «Досье»
  const btnDossier = document.getElementById('btn-dossier');
  const modalDossier = document.getElementById('dossier-modal');
  const btnCloseDossier = document.getElementById('btn-close-dossier');

  if (btnDossier) {
    btnDossier.onclick = () => renderDossier();
  }
  if (btnCloseDossier) {
    btnCloseDossier.onclick = () => {
      closeModalAnimated(modalDossier);
      if (state.paused) state.paused = false;
    };
  }
  if (modalDossier) {
    modalDossier.addEventListener('click', (e) => {
      if (e.target === modalDossier) {
        closeModalAnimated(modalDossier);
        if (state.paused) state.paused = false;
      }
    });
  }

  // 3. Модальное окно «Все задачи»
  const btnTasks = document.getElementById('btn-tasks');
  const modalTasks = document.getElementById('tasks-modal');
  const btnCloseTasks = document.getElementById('btn-close-tasks');

  if (btnTasks) {
    btnTasks.onclick = () => renderAllTasks();
  }
  if (btnCloseTasks) {
    btnCloseTasks.onclick = () => {
      closeModalAnimated(modalTasks);
      if (state.paused) state.paused = false;
    };
  }
  if (modalTasks) {
    modalTasks.addEventListener('click', (e) => {
      if (e.target === modalTasks) {
        closeModalAnimated(modalTasks);
        if (state.paused) state.paused = false;
      }
    });
  }

  // 4. Закрытие окон по клавише Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalDossier && modalDossier.style.display === 'flex') {
        closeModalAnimated(modalDossier);
        if (state.paused) state.paused = false;
      }
      if (modalTasks && modalTasks.style.display === 'flex') {
        closeModalAnimated(modalTasks);
        if (state.paused) state.paused = false;
      }
    }
  });

  // 5. Автоматический сброс скролла в самый верх при открытии любой новой карточки
  const modalIds = ['meeting-modal', 'task-modal', 'task-result-modal', 'dossier-modal', 'tasks-modal'];
  const scrollObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const target = m.target;
      const isVisible = target.classList.contains('open') || target.style.display === 'flex';
      if (isVisible) {
        const card = target.querySelector('.meeting-card, #task-modal-card, #task-result-card');
        if (card) {
          requestAnimationFrame(() => {
            card.scrollTop = 0;
          });
        }
      }
    }
  });

  modalIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      scrollObserver.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  });
}

function closeModalAnimated(modal) {
  if (!modal) return;
  const card = modal.querySelector('.meeting-card');
  if (card) {
    card.style.animation = 'modalCardOut 0.3s ease forwards';
  }
  modal.style.animation = 'modalBgOut 0.3s ease forwards';
  setTimeout(() => {
    modal.style.display = 'none';
    modal.style.animation = '';
    if (card) card.style.animation = '';
  }, 300);
}