import { state } from './state.js';
import { addFeed, render } from './ui.js';

export function showMeeting(meeting) {
  state.paused = true;

  const card = document.getElementById('meeting-card');
  card.innerHTML = `
    <h2>${meeting.title}</h2>
    <div class="date">${meeting.date}</div>
    <div class="context">${meeting.context}</div>
    ${meeting.options.map(o => `
      <button class="option ${o.historical ? 'historical' : ''}" data-opt="${o.id}">
        <div class="label">${o.label}</div>
        <div class="effect">${o.desc}</div>
      </button>
    `).join('')}
    <div class="dossier">📜 ${meeting.dossier}</div>
  `;

  card.querySelectorAll('.option').forEach(btn => {
    btn.onclick = () => chooseOption(meeting, btn.dataset.opt);
  });

  document.getElementById('meeting-modal').classList.add('open');
}

function chooseOption(meeting, optId) {
  const opt = meeting.options.find(o => o.id === optId);
  if (!opt) return;

  for (const [k, v] of Object.entries(opt.immediate || {})) {
    if (k in state.resources) state.resources[k] += v;
    else if (k in state.scales) state.scales[k] += v;
  }

  state.dossier.push({
    type: 'meeting',
    title: meeting.title,
    text: meeting.dossier,
    choice: opt.label,
    date: meeting.date
  });

  addFeed(`✔ Заседание «${meeting.title}»: ${opt.label}`);
  document.getElementById('meeting-modal').classList.remove('open');
  state.paused = false;
  render();
}

export function showRandomEvent(event, onChoice) {
  state.paused = true;

  const card = document.getElementById('meeting-card');
  card.innerHTML = `
    <h2>${event.title}</h2>
    <div class="context" style="white-space: pre-line; margin-bottom: 20px; line-height: 1.6;">${event.historicalContext}</div>
    <div style="background: rgba(255,210,122,0.1); padding: 12px; border-left: 3px solid #ffd27a; margin-bottom: 16px;">
      <strong>Ситуация:</strong><br>
      ${event.description}
    </div>
    ${event.choices.map(c => `
      <button class="option" data-choice="${c.id}">
        <div class="label">${c.text}</div>
        ${c.immediate ? `<div class="effect">Сейчас: ${formatEffects(c.immediate)}</div>` : ''}
        ${c.delayed ? `<div class="effect">Позже: ${formatEffects(c.delayed)}</div>` : ''}
      </button>
    `).join('')}
  `;

  card.querySelectorAll('.option').forEach(btn => {
    btn.onclick = () => {
      const choice = event.choices.find(c => c.id === btn.dataset.choice);
      applyChoice(choice, event);
      if (onChoice) onChoice(choice);
    };
  });

  document.getElementById('meeting-modal').classList.add('open');
}

function formatEffects(effects) {
  const parts = [];
  for (const [k, v] of Object.entries(effects)) {
    const sign = v > 0 ? '+' : '';
    parts.push(`${sign}${v} ${getResourceName(k)}`);
  }
  return parts.join(', ');
}

function getResourceName(key) {
  const names = {
    coal: 'угля', metal: 'металла', grain: 'зерна',
    oil: 'нефти', science: 'науки', goods: 'товаров',
    trust: 'доверия', efficiency: 'эффективности'
  };
  return names[key] || key;
}

function applyChoice(choice, event) {
  if (!choice) return;

  if (choice.immediate) {
    for (const [k, v] of Object.entries(choice.immediate)) {
      if (k in state.resources) state.resources[k] += v;
      else if (k in state.scales) state.scales[k] += v;
    }
  }

  if (choice.delayed) {
    const delayMonths = 6;
    const targetTick = state.tick + delayMonths;
    if (!state.delayedEffects) state.delayedEffects = [];
    state.delayedEffects.push({
      targetTick,
      effects: { ...choice.delayed },
      eventTitle: event.title,
      consequence: choice.consequence,
    });
    addFeed(`⏳ Отложенный эффект события «${event.title}» сработает через ${delayMonths} мес.`);
  }

  state.dossier.push({
    type: 'event',
    title: event.title,
    text: event.historicalContext + '\n\n' + choice.consequence,
    choice: choice.text,
    date: `Месяц ${state.tick}`
  });

  addFeed(`✔ ${event.title}: ${choice.text}`);
  document.getElementById('meeting-modal').classList.remove('open');
  state.paused = false;
  render();
}