import { loadData, state } from './state.js';
import { setupInput } from './input.js';
import { loadTasks, initStartingTasks } from './tasks.js';
import { startClock, setEventData } from './time.js';
import {
  showScreen,
  setupScreenHandlers,
  loadSettings,
  initOnboarding,
} from './screens.js';

let gameStarted = false;
let taskData = null;
let sceneReady = false;

async function main() {
  console.log('🎮 Запуск Акт I...');

  try {
    showScreen('onboarding');
  } catch (e) {
    console.error('❌ Не удалось показать онбординг:', e);
  }

  try {
    setupScreenHandlers({
      onStartGame: startActualGame,
      isGameRunning: () => gameStarted,
      onSettingsChanged: (s) => {
        if (s.defaultSpeed) {
          import('./time.js').then(({ setSpeed }) => setSpeed(s.defaultSpeed)).catch(() => {});
        }
      },
    });
    initOnboarding();
    console.log('✅ UI экранов готов');
  } catch (e) {
    console.error('❌ Ошибка UI экранов:', e);
  }

  try {
    await loadData();
    taskData = await loadTasks();
    setEventData(taskData);
    console.log('✅ Данные загружены:', {
      regions: state.regions.length,
      buildings: Object.keys(state.buildings).length,
      meetings: state.meetings.length,
      tasks: taskData.templates.length,
    });
  } catch (e) {
    console.error('❌ Ошибка загрузки данных:', e);
    return;
  }

  try {
    const { initScene, createRegions, resize, animate } = await import('./scene.js');
    initScene();
    createRegions();
    resize();
    animate();
    sceneReady = true;
    window.addEventListener('resize', resize);
    console.log('✅ 3D-сцена готова');
  } catch (e) {
    console.error('❌ Ошибка 3D-сцены (игра будет без карты):', e);
    const mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.innerHTML = `
        <div style="
          display: flex; align-items: center; justify-content: center;
          height: 100%; color: #5a6a7a; font-size: 14px;
          background: #0a0f18;
        ">
          ⚠ Карта недоступна (WebGL не поддерживается)
        </div>
      `;
    }
  }

  try {
    const { setupModals } = await import('./ui.js');
    setupModals();
  } catch (e) {
    console.error('❌ Ошибка модалок:', e);
  }

  try {
    setupInput();
  } catch (e) {
    console.error('❌ Ошибка ввода:', e);
  }

  try {
    state.paused = true;
    startClock();
  } catch (e) {
    console.error('❌ Ошибка часов:', e);
  }

  console.log('🏁 Инициализация завершена. Экран:', document.querySelector('.screen.active')?.id);
}

function startActualGame() {
  if (gameStarted) return;
  gameStarted = true;

  if (state.tick > 0) {
    state.tick = 0;
    state.timeAccumulator = 0;
  }

  try {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    import('./ui.js').then(({ addFeed, render, selectRegion }) => {
      addFeed('🎬 Акт I начался. Восстановите страну после войны!');
      addFeed('💡 Пробел — пауза. Esc — меню. Клавиши 1/2/3 — скорость.');

      if (sceneReady) {
        selectRegion('center');
      }
      render();
    }).catch(e => console.error('❌ Ошибка UI при старте игры:', e));

    state.paused = false;

    const settings = loadSettings();
    import('./time.js').then(({ setSpeed }) => setSpeed(settings.defaultSpeed || 1)).catch(() => {});

    setTimeout(() => {
      if (taskData) initStartingTasks(taskData);
    }, 300);

    console.log('▶ Игра запущена');
  } catch (e) {
    console.error('❌ Ошибка старта игры:', e);
  }
}

main().catch(err => {
  console.error('❌ Критическая ошибка запуска:', err);
  try {
    showScreen('onboarding');
  } catch {}
});