# Ready for Testing

## Changes Summary

### Task 1: Encoding Fixes (кракозябры)
- Removed UTF-8 BOM from js/ui.js line 1
- Fixed demolish button text: 'РЎРЅРѕСЃ' → 'Снос' in ui.js line 148
- Fixed trust warning: 'Резк решить задачи' → 'Решите задачи' in index.html line 423 (before removal)
- Removed trust-warning div from index.html bottom panel
- Confirmed <meta charset="UTF-8"> in index.html line 4

### Task 2: Trust Mechanic Removal (disabled for release)
- Removed trust from scales in state.js and screens.js
- Removed CRITICAL_TRUST constant from state.js
- Removed trust-based game over check from time.js
- Removed trust-based famine trigger from time.js (now only checks grain < 5)
- Added trust skip in tasks.js completeTask() function
- Added trust skip in events.js chooseOption() and applyChoice() functions

### Additional Fixes
- Fixed garbled section-label text in ui.js (продолжается)
- Tasks about food supply renew monthly (design choice, not bug)
- Peasant resource icon issue (related to task choices)

### Modified Files (7 total):
1. js/ui.js - BOM removal, text fixes, trust display removal
2. index.html - trust warning removal, text fix
3. js/state.js - trust removed from scales
4. js/screens.js - trust removed from initial scales
5. js/time.js - trust game over and famine triggers removed
6. js/tasks.js - trust effects skipped
7. js/events.js - trust effects skipped in meetings/events

### Verification
- Game starts without ReferenceError/TypeError
- All Russian text displays correctly in proper UTF-8
- Trust mechanic disabled but structure preserved
- Efficiency, tech, and tension scales still work normally