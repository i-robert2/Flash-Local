<script lang="ts">
  import { db } from '../core/storage';
  import { navigate } from '../stores';
  import type { Deck, Notebook, Note, Card } from '../core/types';

  let open = $state(false);
  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let searching = $state(false);
  let inputEl: HTMLInputElement;

  interface SearchResult {
    type: 'deck' | 'notebook' | 'note' | 'card';
    id: string;
    title: string;
    subtitle: string;
    route: string;
  }

  function toggle() {
    open = !open;
    if (open) {
      query = '';
      results = [];
      requestAnimationFrame(() => inputEl?.focus());
    }
  }

  async function doSearch() {
    const q = query.trim().toLowerCase();
    if (q.length < 2) { results = []; return; }
    searching = true;

    const found: SearchResult[] = [];

    // Search decks by name
    const decks = await db.decks.toArray();
    for (const d of decks) {
      if (d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)) {
        found.push({ type: 'deck', id: d.id, title: d.name, subtitle: 'Deck', route: `/deck/${d.id}` });
      }
    }

    // Search cards by front/back content
    const cards = await db.cards.toArray();
    const deckMap = new Map(decks.map(d => [d.id, d.name]));
    for (const c of cards) {
      if (c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)) {
        found.push({
          type: 'card',
          id: c.id,
          title: c.front.slice(0, 60).replace(/!\[[^\]]*\]\([^)]*\)/g, '[img]'),
          subtitle: `Card in ${deckMap.get(c.deckId) ?? 'Deck'}`,
          route: `/card/${c.deckId}/${c.id}`,
        });
        if (found.filter(f => f.type === 'card').length >= 10) break; // limit card results
      }
    }

    // Search notebooks by name
    const notebooks = await db.notebooks.toArray();
    for (const nb of notebooks) {
      if (nb.name.toLowerCase().includes(q) || nb.description.toLowerCase().includes(q)) {
        found.push({ type: 'notebook', id: nb.id, title: nb.name, subtitle: 'Notebook', route: `/notebook/${nb.id}` });
      }
    }

    // Search notes by title/content
    const notes = await db.notes.toArray();
    const nbMap = new Map(notebooks.map(n => [n.id, n.name]));
    for (const n of notes) {
      // Strip image data before searching content to avoid matching base64
      const cleanContent = n.content.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
      if (n.title.toLowerCase().includes(q) || cleanContent.toLowerCase().includes(q)) {
        found.push({
          type: 'note',
          id: n.id,
          title: n.title,
          subtitle: `Note in ${nbMap.get(n.notebookId) ?? 'Notebook'}`,
          route: `/notebook/${n.notebookId}/note/${n.id}`,
        });
        if (found.filter(f => f.type === 'note').length >= 10) break;
      }
    }

    results = found;
    searching = false;
  }

  function go(result: SearchResult) {
    navigate(result.route);
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { open = false; }
  }

  const typeIcons: Record<string, string> = {
    deck: '🃏',
    card: '📇',
    notebook: '📓',
    note: '📝',
  };
</script>

<button class="search-toggle nav-btn" onclick={toggle} aria-label="Search" title="Search">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
</button>

{#if open}
  <div class="search-overlay" onclick={() => open = false} onkeydown={handleKeydown}>
    <div class="search-modal" onclick={(e) => e.stopPropagation()}>
      <input
        bind:this={inputEl}
        type="search"
        bind:value={query}
        oninput={doSearch}
        placeholder="Search decks, notebooks, notes, cards…"
        class="search-input"
      />

      {#if results.length > 0}
        <div class="search-results">
          {#each results as r (r.type + r.id)}
            <button class="search-result" onclick={() => go(r)}>
              <span class="result-icon">{typeIcons[r.type]}</span>
              <div class="result-info">
                <span class="result-title">{r.title}</span>
                <span class="result-sub">{r.subtitle}</span>
              </div>
            </button>
          {/each}
        </div>
      {:else if query.trim().length >= 2 && !searching}
        <div class="search-empty">No results found</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .search-toggle {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
  }
  .search-toggle:hover {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .search-overlay {
    position: fixed;
    inset: 0;
    z-index: 500;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
  }

  .search-modal {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    width: 90%;
    max-width: 32rem;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .search-input {
    width: 100%;
    padding: 0.9rem 1rem;
    border: none;
    border-bottom: 1px solid var(--color-border);
    background: none;
    color: var(--color-text);
    font-family: var(--font);
    font-size: 1rem;
    outline: none;
    box-sizing: border-box;
  }

  .search-results {
    max-height: 20rem;
    overflow-y: auto;
  }

  .search-result {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    width: 100%;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font-family: var(--font);
    color: var(--color-text);
    transition: background 0.1s;
  }

  .search-result:hover { background: var(--color-surface-hover); }

  .result-icon { font-size: 1.1rem; flex-shrink: 0; }

  .result-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .result-title {
    font-size: 0.85rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-sub {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
  }

  .search-empty {
    padding: 1.5rem;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }
</style>
