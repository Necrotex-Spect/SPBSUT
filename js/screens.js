import { state } from './state.js';

const FACTS = [
  "Доктрина Трумэна (12 марта 1947) — речь президента США перед Конгрессом, положившая начало политике сдерживания коммунизма.",
  "Берлинская блокада длилась 322 дня. Воздушный мост снабжал город всем необходимым — от угля до продуктов.",
  "29 августа 1949 года СССР испытал первую атомную бомбу РДС-1 на Семипалатинском полигоне.",
  "К 1948 году Донбасс восстановил добычу угля до 80% от довоенного уровня благодаря героическому труду шахтёров.",
  "ДнепроГЭС — крупнейшая электростанция Европы — была полностью уничтожена дважды: в 1941 и 1943 годах.",
  "План Маршалла (1948) — программа экономической помощи Западной Европе, ставшая ответом на советское влияние.",
  "Создание Коминформа (сентябрь 1947) — координационного центра коммунистических партий.",
  "В 1946–1947 годах от голода в СССР погибло от 500 тысяч до 1 миллиона человек.",
  "Советская атомная программа началась в 1943 году, но ускорилась после Хиросимы и Нагасаки.",
  "Раздел Германии на ФРГ и ГДР произошёл в 1949 году — кульминация послевоенного раскола Европы."
];

const ONBOARDING_KEY = 'akt1_onboarding_seen';

let currentScreen = null;
let factTimer = null;
let factIndex = 0;
let loadingProgress = 0;
let loadingCallback = null;
let obSlideIndex = 0;
let obTotalSlides = 0;
let obInitialized = false;

export function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(name);
  if (el) {
    el.classList.add('active');
    currentScreen = name;
    console.log('📺 Показан экран:', name);
  } else {
    console.error('❌ Экран не найден:', name);
  }
}

export function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  currentScreen = null;
}

export function getCurrentScreen() {
  return currentScreen;
}

export function hasSeenOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {}
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch {}
}

export function initOnboarding() {
  if (obInitialized) return;
  obInitialized = true;

  const slides = document.querySelectorAll('.ob-slide');
  obTotalSlides = slides.length;
  obSlideIndex = 0;

  console.log('🎬 Инициализация онбординга. Слайдов:', obTotalSlides);

  updateOnboardingUI();

  const btnPrev = document.getElementById('ob-prev');
  const btnNext = document.getElementById('ob-next');
  const btnSkip = document.getElementById('ob-skip');

  if (btnPrev) {
    btnPrev.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('⬅ Назад');
      if (obSlideIndex > 0) {
        obSlideIndex--;
        updateOnboardingUI();
      }
    };
  }

  if (btnNext) {
    btnNext.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('➡ Далее, слайд:', obSlideIndex);
      if (obSlideIndex < obTotalSlides - 1) {
        obSlideIndex++;
        updateOnboardingUI();
      } else {
        finishOnboarding();
      }
    };
  }

  if (btnSkip) {
    btnSkip.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('⏭ Пропустить');
      finishOnboarding();
    };
  }

  document.addEventListener('keydown', (e) => {
    if (getCurrentScreen() !== 'onboarding') return;
    if (e.key === 'ArrowRight' && obSlideIndex < obTotalSlides - 1) {
      obSlideIndex++; updateOnboardingUI();
    } else if (e.key === 'ArrowLeft' && obSlideIndex > 0) {
      obSlideIndex--; updateOnboardingUI();
    }
  });
}

function updateOnboardingUI() {
  const slides = document.querySelectorAll('.ob-slide');
  slides.forEach((s, i) => {
    s.classList.toggle('active', i === obSlideIndex);
  });

  const dots = document.querySelectorAll('.ob-dot');
  dots.forEach((d, i) => {
    d.classList.toggle('active', i === obSlideIndex);
  });

  const btnPrev = document.getElementById('ob-prev');
  const btnNext = document.getElementById('ob-next');

  if (btnPrev) {
    btnPrev.disabled = obSlideIndex === 0;
    btnPrev.style.visibility = obSlideIndex === 0 ? 'hidden' : 'visible';
  }

  if (btnNext) {
    if (obSlideIndex === obTotalSlides - 1) {
      btnNext.textContent = '🎮 Перейти в главное меню →';
      btnNext.classList.add('primary');
    } else {
      btnNext.textContent = 'Далее →';
      btnNext.classList.remove('primary');
    }
  }

  const body = document.getElementById('ob-body');
  if (body) body.scrollTop = 0;
}

function finishOnboarding() {
  markOnboardingSeen();
  showScreen('main-menu');
}

export function startLoading(onComplete) {
  showScreen('loading-screen');
  loadingProgress = 0;
  factIndex = Math.floor(Math.random() * FACTS.length);
  loadingCallback = onComplete;

  updateFact();
  updateProgress(0);

  if (factTimer) clearInterval(factTimer);
  factTimer = setInterval(() => {
    factIndex = (factIndex + 1) % FACTS.length;
    updateFact();
  }, 3000);

  let elapsed = 0;
  const totalTime = 4000;
  const interval = 80;
  const increment = (interval / totalTime) * 100;

  const progressTimer = setInterval(() => {
    elapsed += interval;
    loadingProgress = Math.min(100, loadingProgress + increment);
    updateProgress(loadingProgress);

    if (loadingProgress >= 100) {
      clearInterval(progressTimer);
      setTimeout(() => {
        if (factTimer) clearInterval(factTimer);
        factTimer = null;
        if (loadingCallback) loadingCallback();
      }, 400);
    }
  }, interval);
}

function updateFact() {
  const el = document.getElementById('loading-fact');
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = FACTS[factIndex];
      el.style.opacity = '1';
    }, 200);
  }
}

function updateProgress(p) {
  const bar = document.getElementById('loading-bar-fill');
  const status = document.getElementById('loading-status');
  if (bar) bar.style.width = `${p}%`;
  if (status) {
    if (p < 30) status.textContent = 'Загрузка регионов...';
    else if (p < 60) status.textContent = 'Подготовка экономики...';
    else if (p < 90) status.textContent = 'Инициализация карты...';
    else status.textContent = 'Почти готово...';
  }
}

export function showPauseMenu() {
  if (getCurrentScreen() === 'pause-menu') return;
  state.paused = true;
  showScreen('pause-menu');
}

export function hidePauseMenu() {
  if (getCurrentScreen() === 'pause-menu') {
    hideAllScreens();
    state.paused = false;
  }
}

export function togglePauseMenu() {
  if (getCurrentScreen() === 'pause-menu') {
    hidePauseMenu();
  } else if (getCurrentScreen() === null) {
    showPauseMenu();
  }
}

export function showToast(text, duration = 2500) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.remove('show');
  }, duration);
}

const SETTINGS_KEY = 'akt1_settings';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return getDefaultSettings();
    return { ...getDefaultSettings(), ...JSON.parse(raw) };
  } catch {
    return getDefaultSettings();
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function getDefaultSettings() {
  return {
    defaultSpeed: 1,
    showTooltips: true,
    masterVolume: 70,
  };
}

export function resetGameState() {
  state.tick = 0;
  state.speed = 1;
  state.paused = false;
  state.timeAccumulator = 0;

  state.resources = {
    coal: 50, metal: 40, grain: 60, oil: 20,
    science: 0, wood: 30, goods: 0
  };
  state.scales = { trust: 60, efficiency: 50, tech: 1, tension: 20 };
  state.deltas = { coal: 0, metal: 0, grain: 0, oil: 0, science: 0, wood: 0, goods: 0 };

  state.regions.forEach(r => {
    r.buildings = r.buildings.filter(b => {
      const parts = b.split('_');
      return parts.length < 3;
    });
  });

  state.feed = [];
  state.dossier = [];
  state.delayedEffects = [];
  state.selectedRegion = null;
}

export function setupScreenHandlers(callbacks) {
  const safeBind = (id, fn) => {
    const el = document.getElementById(id);
    if (el) {
      el.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      };
    } else {
      console.warn('⚠ Кнопка не найдена:', id);
    }
  };

  safeBind('btn-new-game', () => {
    resetGameState();
    startLoading(() => {
      hideAllScreens();
      if (callbacks.onStartGame) callbacks.onStartGame();
    });
  });

  safeBind('btn-load-game', () => {
    showToast('Сохранений пока нет — начните новую игру');
  });

  safeBind('btn-settings-menu', () => {
    showScreen('settings-screen');
    fillSettingsForm();
  });

  safeBind('btn-about', () => {
    showScreen('about-screen');
  });

  safeBind('btn-view-onboarding', () => {
    obSlideIndex = 0;
    showScreen('onboarding');
    updateOnboardingUI();
  });

  safeBind('btn-settings-back', () => {
    const s = readSettingsForm();
    saveSettings(s);
    if (callbacks.onSettingsChanged) callbacks.onSettingsChanged(s);

    if (state.tick > 0 || (callbacks.isGameRunning && callbacks.isGameRunning())) {
      showScreen('pause-menu');
    } else {
      showScreen('main-menu');
    }
  });

  safeBind('btn-settings-apply', () => {
    const s = readSettingsForm();
    saveSettings(s);
    if (callbacks.onSettingsChanged) callbacks.onSettingsChanged(s);
    showToast('Настройки сохранены');
  });

  safeBind('btn-reset-progress', () => {
    if (confirm('Сбросить весь прогресс и настройки? Это действие необратимо.')) {
      resetGameState();
      resetOnboarding();
      try { localStorage.removeItem(SETTINGS_KEY); } catch {}
      showToast('Прогресс сброшен');
      showScreen('main-menu');
    }
  });

  safeBind('btn-about-back', () => {
    showScreen('main-menu');
  });

  safeBind('btn-pause-resume', () => {
    hidePauseMenu();
  });

  safeBind('btn-pause-settings', () => {
    showScreen('settings-screen');
    fillSettingsForm();
  });

  safeBind('btn-pause-main-menu', () => {
    if (confirm('Выйти в главное меню? Прогресс не сохранится.')) {
      hideAllScreens();
      state.paused = true;
      showScreen('main-menu');
    }
  });

  safeBind('btn-pause-exit', () => {
    if (confirm('Закрыть игру?')) {
      window.close();
      location.reload();
    }
  });
}

function fillSettingsForm() {
  const s = loadSettings();
  const speedEl = document.getElementById('set-default-speed');
  const volEl = document.getElementById('set-volume');
  const volLabel = document.getElementById('set-volume-label');
  const tipsEl = document.getElementById('set-tooltips');

  if (speedEl) speedEl.value = s.defaultSpeed;
  if (volEl) volEl.value = s.masterVolume;
  if (volLabel) volLabel.textContent = s.masterVolume + '%';
  if (tipsEl) tipsEl.checked = s.showTooltips;

  if (volEl) {
    volEl.oninput = () => {
      if (volLabel) volLabel.textContent = volEl.value + '%';
    };
  }
}

function readSettingsForm() {
  const speedEl = document.getElementById('set-default-speed');
  const volEl = document.getElementById('set-volume');
  const tipsEl = document.getElementById('set-tooltips');

  return {
    defaultSpeed: parseInt(speedEl?.value || '1', 10),
    masterVolume: parseInt(volEl?.value || '70', 10),
    showTooltips: tipsEl?.checked ?? true,
  };
}