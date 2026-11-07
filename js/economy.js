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

      if (b.extractor) {
        const regionResources = r.resources || [];
        const target = regionResources.find(res =>
          ['coal', 'metal', 'oil', 'wood', 'grain'].includes(res)
        );

        if (target) {
          state.resources[target] = (state.resources[target] || 0) + EXTRACTOR_YIELD;
          state.deltas[target] += EXTRACTOR_YIELD;
        }
        return;
      }

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

  const grainNeeded = Math.ceil(state.regions.length * 1.5);
  if (state.resources.grain >= grainNeeded) {
    state.resources.grain -= grainNeeded;
    state.deltas.grain -= grainNeeded;
    state.scales.trust = Math.min(100, state.scales.trust + 1);
  } else {
    state.scales.trust = Math.max(0, state.scales.trust - 5);
    addFeed('⚠ Дефицит зерна! Доверие падает.');
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