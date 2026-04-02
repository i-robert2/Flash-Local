<script lang="ts">
  import { settings, showToast } from '../stores';
  import { db } from '../core/storage';
  import type { AppSettings } from '../core/types';

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    settings.update(s => ({ ...s, [key]: value }));
  }

  async function clearAllData() {
    if (!confirm('This will permanently delete ALL decks, cards, and review history. Are you sure?')) return;
    if (!confirm('Last chance — this cannot be undone. Continue?')) return;
    await db.cards.clear();
    await db.decks.clear();
    await db.reviewLogs.clear();
    showToast('All data cleared', 'info');
  }
</script>

<div class="settings">
  <h2>Settings</h2>

  <div class="setting-group">
    <h3>Scheduling</h3>

    <label class="setting">
      <span class="setting-label">
        <strong>Algorithm</strong>
        <small>Choose the spaced repetition algorithm</small>
      </span>
      <select value={$settings.algorithm} onchange={(e) => update('algorithm', (e.target as HTMLSelectElement).value as 'sm2' | 'fsrs')}>
        <option value="sm2">SM-2 (Classic)</option>
        <option value="fsrs">FSRS (Modern)</option>
      </select>
    </label>

    <label class="setting">
      <span class="setting-label">
        <strong>New cards / day</strong>
        <small>Maximum new cards introduced per day</small>
      </span>
      <input type="number" min="1" max="999" value={$settings.newCardsPerDay}
        onchange={(e) => update('newCardsPerDay', parseInt((e.target as HTMLInputElement).value) || 20)} />
    </label>

    <label class="setting">
      <span class="setting-label">
        <strong>Reviews / day</strong>
        <small>Maximum reviews per day</small>
      </span>
      <input type="number" min="1" max="9999" value={$settings.reviewsPerDay}
        onchange={(e) => update('reviewsPerDay', parseInt((e.target as HTMLInputElement).value) || 200)} />
    </label>
  </div>

  <div class="setting-group">
    <h3>Appearance</h3>
    <label class="setting">
      <span class="setting-label"><strong>Theme</strong></span>
      <select value={$settings.theme} onchange={(e) => update('theme', (e.target as HTMLSelectElement).value as 'light' | 'dark' | 'auto')}>
        <option value="auto">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  </div>

  <div class="setting-group danger-zone">
    <h3>Danger Zone</h3>
    <button class="btn btn-danger" onclick={clearAllData}>Clear All Data</button>
    <p class="hint">Permanently delete all decks, cards, and review history.</p>
  </div>
</div>

<style>
  .settings { display: flex; flex-direction: column; gap: 1.5rem; }
  h2 { margin: 0; }

  .setting-group {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .setting-group h3 {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .setting-label { display: flex; flex-direction: column; gap: 0.15rem; }
  .setting-label small { color: var(--color-text-secondary); font-size: 0.8rem; }

  select, .setting input[type="number"] { width: auto; min-width: 8rem; }

  .danger-zone { border-color: var(--color-danger); }
  .danger-zone h3 { color: var(--color-danger); }

  .hint { color: var(--color-text-secondary); font-size: 0.85rem; margin: 0; }
</style>
