import { state } from './state.js';
import { addFeed } from './ui.js';

const EXTRACTOR_YIELD = 5;

export function tick() {
  Object.keys(state.deltas).forEach(k => state.deltas[k] = 0);

  state.regions.forEach(r => {
    r.buildings.forEach(bId => {
      const bType = bId.split('_')[0];
      const b = state.buildings[bType];
      if (!b) return;

      // Добыча ресурсов
      if (b.extractor) {
        const regionResources = r.resources || [];
        let targetRes = null;
        if (bType === 'farm') targetRes = regionResources.find(res => res === 'grain');
        if (bType === 'mine') targetRes = regionResources.find(res => ['coal', 'metal'].includes(res));
        if (bType === 'oil') targetRes = regionResources.find(res => res === 'oil');
        if (bType === 'forest') targetRes = regionResources.find(res => res === 'wood');

        if (targetRes) {
          state.resources[targetRes] = (state.resources[targetRes] || 0) + EXTRACTOR_YIELD;
          state.deltas[targetRes] += EXTRACTOR_YIELD;
        }
        return;
      }

      // Переработка (Заводы)
      let canProduce = true;
      for (const [res, amt] of Object.entries(b.in || {})) {
        if ((state.resources[res] || 0) < amt) { canProduce = false; break; }
      }

      if (canProduce) {
        for (const [res, amt] of Object.entries(b.in || {})) {
          state.resources[res] -= amt;
          state.deltas[res] -= amt;
        }
        for (const [res, amt] of Object.entries(b.out || {})) {
          state.resources[res] = (state.resources[res] || 0) + amt;
          state.deltas[res] += amt;
        }
      }
    });
  });

  // ============ СИСТЕМА ГОЛОДА ============
  const grainNeeded = Math.ceil(state.regions.length * 1.5); // 15 единиц на 10 регионов
  
  if (state.resources.grain >= grainNeeded) {
    // Всё хорошо
    state.resources.grain -= grainNeeded;
    state.deltas.grain -= grainNeeded;
    
    // Медленный рост доверия, если всё стабильно
    if (state.scales.trust < 80) {
      state.scales.trust = Math.min(100, state.scales.trust + 1);
    }
  } else {
    // ГОЛОД
    const deficit = grainNeeded - state.resources.grain;
    state.resources.grain = 0;
    
    // Чем больше дефицит, тем страшнее последствия
    const trustLoss = 5 + Math.floor(deficit / 2);
    state.scales.trust = Math.max(0, state.scales.trust - trustLoss);
    
    // Раз в 3 месяца при голоде выкидываем событие
    if (state.tick % 3 === 0) {
      addFeed(`⚠ КРИТИЧЕСКИЙ ДЕФИЦИТ ЗЕРНА! Не хватает ${deficit} ед. Доверие падает на ${trustLoss}.`);
      
      // Пытаемся вызвать событие «Голод» (если оно есть в tasks.json и модалка не открыта)
      import('./tasks.js').then(({ loadTasks }) => {
        // Мы не знаем, загружен ли tasks.json в этой области, поэтому вызовем глобально
        // В идеале eventData должен быть доступен, но для простоты используем динамический импорт
        import('./time.js').then(({ triggerFamineEvent }) => {
          if (triggerFamineEvent) triggerFamineEvent();
        });
      });
    }
  }
}

export function build(regionId, buildingId) {
  const r = state.regions.find(x => x.id === regionId);
  const b = state.buildings[buildingId];

  if (!r || !b) return { error: 'Неверные данные' };
  if (r.buildings.length >= r.slots) return { error: 'Нет свободных слотов!' };

  for (const [res, amt] of Object.entries(b.cost)) {
    if ((state.resources[res] || 0) < amt) {
      return { error: `Не хватает ${res} (нужно ${amt})` };
    }
  }

  for (const [res, amt] of Object.entries(b.cost)) {
    state.resources[res] -= amt;
  }

  r.buildings.push(buildingId + '_' + Date.now());
  addFeed(`В ${r.name} построен(а) ${b.name}`);
  return { success: true };
}