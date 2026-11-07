import { state } from './state.js';
import { showScreen } from './screens.js';

export function showGameOver() {
  // Останавливаем время
  state.paused = true;
  
  const modal = document.getElementById('game-over-modal');
  const card = document.getElementById('game-over-card');
  if (!modal || !card) {
    console.error('❌ game-over-modal не найден в DOM');
    return;
  }

  // Собираем статистику
  const monthsSurvived = state.tick;
  const buildingsBuilt = state.regions.reduce((acc, r) => acc + r.buildings.length, 0);
  
  card.innerHTML = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 64px; margin-bottom: 12px;">🔥</div>
      <h2 style="color: #ff6b6b; font-size: 28px; margin-bottom: 8px;">ВОССТАНИЕ</h2>
      <div style="color: #8a9aaa; font-size: 14px;">
        Доверие народа упало до нуля
      </div>
    </div>

    <div style="
      background: rgba(255, 100, 100, 0.08);
      border-left: 3px solid #ff6b6b;
      padding: 16px; margin-bottom: 20px;
      font-size: 14px; line-height: 1.7;
      color: #c8d4e0;
    ">
      <strong style="color: #ff6b6b; display: block; margin-bottom: 8px;">📜 ИСТОРИЧЕСКАЯ СПРАВКА</strong>
      В реальной истории послевоенный голод 1946–1947 годов унёс жизни сотен тысяч людей. 
      Власть шла на жёсткие меры, но не допускала полного коллапса. 
      В вашей партии доверие народа иссякло — начались стихийные бунты, 
      забастовки на заводах и крестьянские восстания. 
      Партия потеряла контроль над страной.
    </div>

    <div style="
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 10px; margin-bottom: 20px;
    ">
      <div style="background: rgba(0,0,0,0.3); border: 1px solid #3a4a5a; border-radius: 6px; padding: 12px; text-align: center;">
        <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px;">ПРОДЕРЖАЛИСЬ</div>
        <div style="font-size: 20px; font-weight: 700; color: #ffd27a;">${monthsSurvived} мес.</div>
      </div>
      <div style="background: rgba(0,0,0,0.3); border: 1px solid #3a4a5a; border-radius: 6px; padding: 12px; text-align: center;">
        <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px;">ПОСТРОЕНО</div>
        <div style="font-size: 20px; font-weight: 700; color: #ffd27a;">${buildingsBuilt}</div>
      </div>
    </div>

    <div style="font-size: 13px; opacity: 0.7; text-align: center; margin-bottom: 20px; line-height: 1.6;">
      Ваша партия завершилась. Но история не заканчивается — попробуйте снова и найдите баланс между индустриализацией и заботой о людях.
    </div>

    <button id="btn-game-over-restart" class="primary" style="width: 100%; padding: 14px; font-size: 15px; font-weight: 600;">
      🔄 Начать заново
    </button>
    <button id="btn-game-over-menu" style="width: 100%; padding: 12px; font-size: 14px; margin-top: 8px; background: transparent; border: 1px solid #3a4a5a;">
      🏠 В главное меню
    </button>
  `;

  modal.style.display = 'flex';
  modal.style.animation = 'modalBgIn 0.3s ease forwards';

  document.getElementById('btn-game-over-restart').onclick = () => {
    // Сбрасываем состояние и начинаем заново
    import('./screens.js').then(({ resetGameState }) => {
      resetGameState();
      import('./time.js').then(({ resetGameEnded }) => resetGameEnded());
      
      modal.style.display = 'none';
      
      // Начинаем новую игру
      import('./screens.js').then(({ startLoading, hideAllScreens }) => {
        startLoading(() => {
          hideAllScreens();
          // Перезапускаем стартовые задачи
          import('./main.js').then(() => {
            // main.js уже вызван, просто перезагружаем страницу
            location.reload();
          });
        });
      });
    });
  };

  document.getElementById('btn-game-over-menu').onclick = () => {
    modal.style.display = 'none';
    import('./screens.js').then(({ showScreen, resetGameState }) => {
      resetGameState();
      import('./time.js').then(({ resetGameEnded }) => resetGameEnded());
      showScreen('main-menu');
    });
  };
}