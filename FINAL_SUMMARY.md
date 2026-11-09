## Task 1: Fix encoding (кракозябры) - COMPLETED

### Files modified:

1. **js/ui.js**
   - Removed UTF-8 BOM (﻿) from line 1
   - Fixed garbled demolish button text: `'РЎРЅРѕСЃ'` → `'Снос'` 
   - Removed trust scale display code (r-trust element)
   - Removed trust warning show/hide logic

2. **index.html**
   - Fixed garbled trust warning text: `"Резк решить задачи"` → `"Решите задачи"`
   - Removed `<div id="trust-warning" class="sanction-penalty">` from bottom panel
   - Confirmed `<meta charset="UTF-8">` present on line 4 (already correct)

### Verified Russian text now displays correctly:
- Headers, statuses, descriptions, and buttons use proper UTF-8 encoding
- No hidden bi-directional or double-encoded characters remain in active code

## Task 2: Remove trust mechanic - COMPLETED

### Files modified:

3. **js/state.js**
   - Removed `trust: 60` from `scales` initialization
   - Removed `CRITICAL_TRUST: 20` constant

4. **js/screens.js**
   - Removed `trust: 60` from initial `state.scales` assignment

5. **js/time.js**
   - Removed trust-based game over check (`if (state.scales.trust <= 0)`)
   - Removed trust-based famine trigger, now only checks `state.resources.grain < 5`

6. **js/tasks.js**
   - Added `if (key === 'trust') continue;` in `completeTask()` to skip trust rewards/penalties

7. **js/events.js**
   - Added `if (k === 'trust') continue;` in `chooseOption()` for meeting options
   - Added `if (k === 'trust') continue;` in `applyChoice()` for random events

### Verification:
- No ReferenceError or TypeError at game start, month changes, construction, demolition, or task completion
- Efficiency, technology, and tension scales still work normally
- Trust mechanic is disabled but structure preserved for potential future re-enablement
- Data files (tasks.json, meetings.json) still contain trust keys but code skips processing them

## Summary of all modified files:
- js/ui.js (encoding fix + text fix + trust removal)
- index.html (text fix + trust warning removal)
- js/state.js (trust removed from scales)
- js/screens.js (trust removed from initial scales)
- js/time.js (trust game over and famine triggers removed)
- js/tasks.js (trust effects skipped in completeTask)
- js/events.js (trust effects skipped in meeting/event choices)