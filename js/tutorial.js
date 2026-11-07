import { state } from './state.js';

let currentStep = 0;
let tutorialActive = false;
let isPracticeMode = false;

const STEPS = [
  {
    id: 0,
    target: 'map',
    title: '🗺 Добро пожаловать в Штаб',
    text: 'Страна в руинах. Нам нужно срочно восстановить экономику. Давайте начнем с добычи ресурсов. <strong>Кликните на регион «Урал»</strong> на карте, чтобы выбрать его.',
    waitFor: 'region'
  },
  {
    id: 1,
    target: 'region-panel',
    title: '🏗 Строительство',
    text: 'Вы выбрали Урал. Здесь есть залежи металла. Постройте <strong>Шахту (⛏)</strong>, чтобы начать добычу.',
    waitFor: 'build_mine'
  },
  {
    id: 2,
    target: 'top',
    title: '⏱ Время — ресурс',
    text: 'Отлично! Металл начнет поступать в казну. Обратите внимание на верхнюю панель — здесь отображаются все ваши ресурсы. <strong>Ускорьте время (▶▶)</strong>, чтобы не ждать.',
    waitFor: 'speed_2'
  },
  {
    id: 3,
    target: 'task-panel',
    title: '📋 Задачи Партии',
    text: 'Смотрите сюда! Партия поставила перед нами задачу: <strong>восстановить Донбасс</strong>. Это критически важно для страны. Следите за прогрессом.',
    waitFor: 'none'
  }
];

export function initTutorial(practice = false) {
  if (tutorialActive) return;
  
  tutorialActive = true;
  isPracticeMode = practice;
  currentStep = 0;

  // Если это "Обучение" из меню, сбрасываем игру, чтобы начать с чистого листа
  if (practice) {
    import('./screens.js').then(({ resetGameState }) => {
      resetGameState();
      import('./ui.js').then(({ render, selectRegion }) => {
        selectRegion('center');
        render();
      });
    });
  }

  // Ждем, пока прогрузится интерфейс игры
  setTimeout(() => {
    showStep(0);
  }, 1000);
}

// Оставляем алиас, чтобы ничего не сломалось
export const startTutorial = initTutorial;

function showStep(index) {
  if (index >= STEPS.length) {
    endTutorial();
    return;
  }

  const step = STEPS[index];
  const targetEl = document.getElementById(step.target);

  if (!targetEl) {
    showStep(index + 1);
    return;
  }

  // Подсвечиваем элемент
  targetEl.style.position = 'relative';
  targetEl.style.zIndex = '900';
  targetEl.classList.add('tutorial-highlight');

  // Создаем всплывающее окно
  let popup = document.getElementById('tutorial-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'tutorial-popup';
    document.getElementById('game').appendChild(popup);
  }

  // Позиционируем окно рядом с элементом
  const rect = targetEl.getBoundingClientRect();
  popup.style.left = `${Math.max(20, rect.left + rect.width / 2 - 150)}px`;
  popup.style.top = `${rect.bottom + 20}px`;

  popup.innerHTML = `
    <div style="
      background: #1e2530; border: 1px solid #ffd27a; border-radius: 8px;
      padding: 16px; max-width: 300px; color: #e8e8e8; font-size: 14px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8); position: relative;
      animation: fadeInUp 0.3s ease both;
    ">
      <div style="font-weight: 700; color: #ffd27a; margin-bottom: 8px; font-size: 15px;">${step.title}</div>
      <div style="line-height: 1.5; margin-bottom: 12px;">${step.text}</div>
      <div style="font-size: 11px; opacity: 0.6; text-align: right;">Шаг ${index + 1} из ${STEPS.length}</div>
      ${index === STEPS.length - 1 ? `<button id="btn-tutorial-finish" class="primary" style="width:100%; margin-top:8px; font-size:12px; padding:6px;">Понятно</button>` : ''}
    </div>
  `;
  popup.style.display = 'block';
  popup.style.position = 'fixed';
  popup.style.zIndex = '1000';

  if (index === STEPS.length - 1) {
    document.getElementById('btn-tutorial-finish').onclick = () => endTutorial();
  }

  // Слушаем действия игрока
  waitForAction(step.waitFor, () => {
    targetEl.style.boxShadow = '';
    targetEl.style.zIndex = '';
    targetEl.classList.remove('tutorial-highlight');
    
    currentStep++;
    showStep(currentStep);
  });
}

let actionListener = null;

function waitForAction(action, callback) {
  if (action === 'none') return;

  if (actionListener) {
    window.removeEventListener('game-action', actionListener);
  }

  actionListener = (e) => {
    if (e.detail.type === action) {
      window.removeEventListener('game-action', actionListener);
      actionListener = null;
      callback();
    }
  };

  window.addEventListener('game-action', actionListener);
}

export function endTutorial() {
  tutorialActive = false;
  
  if (!isPracticeMode) {
    localStorage.setItem('akt1_tutorial_seen', '1');
  }
  
  const popup = document.getElementById('tutorial-popup');
  if (popup) popup.remove();

  document.querySelectorAll('.tutorial-highlight').forEach(el => {
    el.style.boxShadow = '';
    el.style.zIndex = '';
    el.classList.remove('tutorial-highlight');
  });

  if (isPracticeMode) {
    import('./screens.js').then(({ showScreen }) => showScreen('main-menu'));
  }
}

export function isTutorialActive() {
  return tutorialActive;
}