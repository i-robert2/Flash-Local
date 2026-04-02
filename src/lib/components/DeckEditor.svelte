<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '../core/storage';
  import { navigate, showToast } from '../stores';
  import type { Card, Deck } from '../core/types';

  let { deckId }: { deckId: string } = $props();

  let deck = $state<Deck | null>(null);
  let cards = $state<Card[]>([]);
  let editingName = $state(false);
  let nameInput = $state('');
  let searchQuery = $state('');

  let filteredCards = $derived(
    searchQuery
      ? cards.filter(c =>
          c.front.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.back.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())),
        )
      : cards,
  );

  onMount(loadDeck);

  async function loadDeck() {
    deck = (await db.decks.get(deckId)) ?? null;
    if (!deck) {
      showToast('Deck not found', 'error');
      navigate('/');
      return;
    }
    nameInput = deck.name;
    cards = await db.cards.where('deckId').equals(deckId).toArray();
    cards.sort((a, b) => b.modified - a.modified);
  }

  async function saveName() {
    if (!deck || !nameInput.trim()) return;
    await db.decks.update(deck.id, { name: nameInput.trim(), modified: Date.now() });
    deck.name = nameInput.trim();
    editingName = false;
    showToast('Deck renamed', 'success');
  }

  async function deleteCard(card: Card) {
    if (!confirm('Delete this card?')) return;
    await db.cards.delete(card.id);
    cards = cards.filter(c => c.id !== card.id);
    showToast('Card deleted', 'info');
  }

  function truncate(text: string, len = 80): string {
    return text.length > len ? text.slice(0, len) + '...' : text;
  }
</script>

<div class="deck-editor">
  <div class="deck-header">
    {#if editingName}
      <div class="edit-name">
        <input bind:value={nameInput} onkeydown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') editingName = false; }} />
        <button class="btn btn-primary btn-sm" onclick={saveName}>Save</button>
      </div>
    {:else}
      <button class="deck-name-btn" onclick={() => (editingName = true)} title="Click to rename">{deck?.name ?? 'Loading...'}</button>
    {/if}

    <div class="header-actions">
      {#if cards.length > 0}
        <button class="btn btn-study" onclick={() => navigate(`/study/${deckId}`)}>Study</button>
      {/if}
      <button class="btn btn-primary" onclick={() => navigate(`/card/${deckId}`)}>+ Add Card</button>
    </div>
  </div>

  {#if cards.length > 5}
    <input type="search" class="search-input" placeholder="Search cards..." bind:value={searchQuery} />
  {/if}

  {#if cards.length === 0}
    <div class="empty-state">
      <p>No cards yet. Add your first card to start studying!</p>
    </div>
  {:else}
    <div class="card-list">
      {#each filteredCards as card (card.id)}
        <div class="card-item" role="button" tabindex="0" onclick={() => navigate(`/card/${deckId}/${card.id}`)} onkeydown={(e) => e.key === 'Enter' && navigate(`/card/${deckId}/${card.id}`)}>
          <div class="card-preview">
            <span class="front">{truncate(card.front)}</span>
            <span class="separator">→</span>
            <span class="back">{truncate(card.back, 60)}</span>
          </div>
          {#if card.tags.length > 0}
            <div class="card-tags">
              {#each card.tags.slice(0, 3) as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}
          <button class="btn btn-icon btn-danger-ghost" onclick={(e) => { e.stopPropagation(); deleteCard(card); }} aria-label="Delete card">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .deck-editor { display: flex; flex-direction: column; gap: 1rem; }

  .deck-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .deck-name-btn {
    margin: 0;
    cursor: pointer;
    font-size: 1.5rem;
    font-weight: 700;
    background: none;
    border: none;
    color: var(--color-text);
    padding: 0;
    font-family: var(--font);
  }
  .deck-name-btn:hover { color: var(--color-primary); }

  .edit-name { display: flex; gap: 0.5rem; flex: 1; }
  .edit-name input { flex: 1; }

  .header-actions { display: flex; gap: 0.5rem; }
  .search-input { width: 100%; }

  .card-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .card-item {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: border-color 0.15s;
  }
  .card-item:hover { border-color: var(--color-primary); }

  .card-preview {
    flex: 1;
    display: flex;
    gap: 0.5rem;
    min-width: 0;
    font-size: 0.9rem;
  }
  .front {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .separator { color: var(--color-text-secondary); flex-shrink: 0; }
  .back {
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-tags { display: flex; gap: 0.25rem; flex-shrink: 0; }
  .tag {
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    background: var(--color-border);
    color: var(--color-text-secondary);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--color-text-secondary);
  }
</style>
