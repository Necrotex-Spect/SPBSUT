export const state = {
  tick: 0,
  speed: 1,
  paused: false,
  resources: {
    coal: 50, metal: 40, grain: 60, oil: 20,
    science: 0, wood: 30, goods: 0
  },
  scales: { efficiency: 50, tech: 1, tension: 20 },
  deltas: { coal: 0, metal: 0, grain: 0, oil: 0, science: 0, wood: 0, goods: 0 },
  regions: [],
  buildings: {},
  meetings: [],
  selectedRegion: null,
  feed: [],
  dossier: [],
  delayedEffects: [],
  MONTH_DURATION: 10,
  timeAccumulator: 0,
  famineEventTriggered: false
};

export async function loadData() {
  const [regions, buildings, meetings] = await Promise.all([
    fetch('data/regions.json').then(r => r.json()),
    fetch('data/buildings.json').then(r => r.json()),
    fetch('data/meetings.json').then(r => r.json()),
  ]);
  state.regions = regions;
  state.buildings = buildings;
  state.meetings = meetings;
}