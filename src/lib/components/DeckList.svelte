<script lang="ts">
  import { onMount } from 'svelte';
  import { db, getDeckStats } from '../core/storage';
  import { navigate, showToast } from '../stores';
  import type { Deck } from '../core/types';

  type DeckWithStats = Deck & { stats: { total: number; due: number; new_: number } };

  let decks = $state<DeckWithStats[]>([]);
  let showNewDeck = $state(false);
  let newDeckName = $state('');
  let loading = $state(true);
  let search = $state('');

  let filteredDecks = $derived(
    search.trim()
      ? decks.filter(d =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.description.toLowerCase().includes(search.toLowerCase())
        )
      : decks
  );

  // Favorites first, then by modified date
  let sortedDecks = $derived(
    [...filteredDecks].sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return b.modified - a.modified;
    })
  );

  onMount(loadDecks);

  async function loadDecks() {
    loading = true;
    const allDecks = await db.decks.toArray();
    const withStats = await Promise.all(
      allDecks.map(async (d) => ({ ...d, stats: await getDeckStats(d.id) })),
    );
    decks = withStats;
    loading = false;
  }

  async function toggleFavorite(deck: DeckWithStats, event: Event) {
    event.stopPropagation();
    const newVal = !deck.favorite;
    await db.decks.update(deck.id, { favorite: newVal });
    deck.favorite = newVal;
    decks = [...decks]; // trigger reactivity
  }

  async function createDeck() {
    const name = newDeckName.trim();
    if (!name) return;
    const deck: Deck = {
      id: crypto.randomUUID(),
      name,
      description: '',
      created: Date.now(),
      modified: Date.now(),
    };
    await db.decks.add(deck);
    showToast(`Created "${name}"`, 'success');
    newDeckName = '';
    showNewDeck = false;
    await loadDecks();
  }

  async function deleteDeck(deck: Deck, event: Event) {
    event.stopPropagation();
    if (!confirm(`Delete "${deck.name}" and all its cards?`)) return;
    await db.cards.where('deckId').equals(deck.id).delete();
    await db.decks.delete(deck.id);
    showToast(`Deleted "${deck.name}"`, 'info');
    await loadDecks();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') createDeck();
    if (e.key === 'Escape') { showNewDeck = false; newDeckName = ''; }
  }
</script>

<div class="deck-list">
  <div class="section-header">
    <h2>Your Decks</h2>
    <button class="btn btn-primary" onclick={() => (showNewDeck = !showNewDeck)}>
      {showNewDeck ? 'Cancel' : '+ New Deck'}
    </button>
  </div>

  {#if showNewDeck}
    <div class="new-deck-form">
      <input
        type="text"
        placeholder="Deck name..."
        bind:value={newDeckName}
        onkeydown={handleKeydown}
      />
      <button class="btn btn-primary" onclick={createDeck} disabled={!newDeckName.trim()}>
        Create
      </button>
    </div>
  {/if}

  {#if decks.length > 0}
    <input type="search" bind:value={search} placeholder="Search decks…" />
  {/if}

  {#if loading}
    <p class="empty">Loading...</p>
  {:else if decks.length === 0}
    <div class="empty-state">
      <p>No decks yet</p>
      <p class="hint">Create a new deck or import cards to get started.</p>
    </div>
  {:else if sortedDecks.length === 0}
    <div class="empty-state">
      <p>No decks match your search.</p>
    </div>
  {:else}
    <div class="decks">
      {#each sortedDecks as deck (deck.id)}
        <div class="deck-card" role="button" tabindex="0" onclick={() => navigate(`/deck/${deck.id}`)} onkeydown={(e) => e.key === 'Enter' && navigate(`/deck/${deck.id}`)}>
          <button class="fav-btn" onclick={(e) => toggleFavorite(deck, e)} title={deck.favorite ? 'Remove from favorites' : 'Add to favorites'}>
            {deck.favorite ? '★' : '☆'}
          </button>
          <div class="deck-info">
            <h3>{deck.name}</h3>
            <span class="deck-count">{deck.stats.total} cards</span>
          </div>
          <div class="deck-stats">
            {#if deck.stats.new_ > 0}
              <span class="stat stat-new">{deck.stats.new_} new</span>
            {/if}
            {#if deck.stats.due > 0}
              <span class="stat stat-due">{deck.stats.due} due</span>
            {/if}
            {#if deck.stats.new_ === 0 && deck.stats.due === 0 && deck.stats.total > 0}
              <span class="stat stat-done">All caught up!</span>
            {/if}
          </div>
          <div class="deck-actions">
            {#if deck.stats.due > 0 || deck.stats.new_ > 0}
              <button class="btn btn-study" onclick={(e) => { e.stopPropagation(); navigate(`/study/${deck.id}`); }}>
                Study
              </button>
            {/if}
            <button class="btn btn-icon btn-danger-ghost" onclick={(e) => deleteDeck(deck, e)} aria-label="Delete deck" title="Delete deck">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .deck-list { display: flex; flex-direction: column; gap: 1rem; }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .section-header h2 { margin: 0; font-size: 1.5rem; }

  .new-deck-form {
    display: flex;
    gap: 0.5rem;
    animation: slideDown 0.15s ease-out;
  }
  .new-deck-form input { flex: 1; }

  .decks { display: flex; flex-direction: column; gap: 0.75rem; }

  .deck-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 1rem;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .deck-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }

  .deck-info { flex: 1; min-width: 0; }
  .deck-info h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .deck-count { font-size: 0.85rem; color: var(--color-text-secondary); }

  .deck-stats { display: flex; gap: 0.5rem; flex-shrink: 0; }

  .stat {
    font-size: 0.8rem;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    font-weight: 500;
  }
  .stat-new  { background: #DBEAFE; color: #1E40AF; }
  .stat-due  { background: #FEF3C7; color: #92400E; }
  .stat-done { background: #D1FAE5; color: #065F46; }

  :global([data-theme="dark"]) .stat-new  { background: #1E3A5F; color: #93C5FD; }
  :global([data-theme="dark"]) .stat-due  { background: #78350F; color: #FCD34D; }
  :global([data-theme="dark"]) .stat-done { background: #064E3B; color: #6EE7B7; }

  .deck-actions { display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0; }

  .fav-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    color: var(--color-warning);
    padding: 0.2rem;
    flex-shrink: 0;
    line-height: 1;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--color-text-secondary);
  }
  .empty-state p { margin: 0.25rem 0; }
  .hint { font-size: 0.9rem; }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-0.5rem); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
