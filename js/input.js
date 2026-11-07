import { state } from './state.js';
import { togglePause, setSpeed } from './time.js';
import { togglePauseMenu, getCurrentScreen } from './screens.js';

export function setupInput() {
  const canvas = document.getElementById('canvas');

  canvas.addEventListener('pointerdown', (e) => {
    if (getCurrentScreen() !== null) return;
    const taskModal = document.getElementById('task-modal');
    const resultModal = document.getElementById('task-result-modal');
    if (taskModal && taskModal.classList.contains('open')) return;
    if (resultModal && resultModal.classList.contains('open')) return;

    if (e.button === 0) {
      import('./scene.js').then(({ handlePointerDown }) => handlePointerDown(e)).catch(() => {});
    }
  });

  const btnPause = document.getElementById('btn-pause');
  if (btnPause) btnPause.onclick = () => togglePause();
  
  const btnS1 = document.getElementById('btn-speed-1');
  if (btnS1) btnS1.onclick = () => setSpeed(1);
  
  const btnS2 = document.getElementById('btn-speed-2');
  if (btnS2) btnS2.onclick = () => setSpeed(2);
  
  const btnS3 = document.getElementById('btn-speed-3');
  if (btnS3) btnS3.onclick = () => setSpeed(3);

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const taskModal = document.getElementById('task-modal');
    const resultModal = document.getElementById('task-result-modal');
    if (taskModal && taskModal.classList.contains('open')) return;
    if (resultModal && resultModal.classList.contains('open')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      const screen = getCurrentScreen();
      if (screen === 'pause-menu') {
        import('./screens.js').then(({ hidePauseMenu }) => hidePauseMenu());
      } else if (screen === 'settings-screen' || screen === 'about-screen') {
        import('./screens.js').then(({ showScreen }) => showScreen('pause-menu'));
      } else if (screen === null) {
        togglePauseMenu();
      }
      return;
    }

    if (getCurrentScreen() !== null) return;

    if (e.key === ' ') { e.preventDefault(); togglePause(); }
    if (e.key === '1') setSpeed(1);
    if (e.key === '2') setSpeed(2);
    if (e.key === '3') setSpeed(3);
  });

  const btnDossier = document.getElementById('btn-dossier');
  if (btnDossier) {
    btnDossier.onclick = () => {
      if (!state.dossier.length) {
        import('./ui.js').then(({ flashStatus }) => flashStatus('Досье пока пусто'));
        return;
      }
      import('./ui.js').then(({ renderDossier }) => renderDossier());
    };
  }

  const btnTasks = document.getElementById('btn-tasks');
  if (btnTasks) {
    btnTasks.onclick = () => {
      import('./ui.js').then(({ renderAllTasks }) => renderAllTasks());
    };
  }
}