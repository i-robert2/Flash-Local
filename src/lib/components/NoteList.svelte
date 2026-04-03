<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../core/storage';
  import { navigate } from '../stores';
  import type { Note } from '../core/types';

  let notes = $state<Note[]>([]);
  let search = $state('');

  const sub = liveQuery(() => db.notes.orderBy('modified').reverse().toArray());
  $effect(() => {
    const subscription = sub.subscribe(val => { notes = val; });
    return () => subscription.unsubscribe();
  });

  let filtered = $derived(
    search.trim()
      ? notes.filter(n =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
        )
      : notes
  );
</script>

<div class="note-list">
  <div class="top-row">
    <h2>Notes</h2>
    <div class="top-actions">
      <button class="btn btn-secondary btn-sm" onclick={() => navigate('/knowledge-map')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="6" cy="18" r="3"/>
          <line x1="8.5" y1="7.5" x2="15.5" y2="16.5"/><line x1="15.5" y1="7.5" x2="8.5" y2="16.5"/>
        </svg>
        Knowledge Map
      </button>
      <button class="btn btn-primary btn-sm" onclick={() => navigate('/note')}>+ New Note</button>
    </div>
  </div>

  {#if notes.length > 0}
    <input type="search" bind:value={search} placeholder="Search notes…" />
  {/if}

  {#if filtered.length === 0}
    <div class="empty">
      {#if notes.length === 0}
        <p>No notes yet. Create your first note to get started!</p>
      {:else}
        <p>No notes match your search.</p>
      {/if}
    </div>
  {:else}
    <div class="notes-grid">
      {#each filtered as note (note.id)}
        <button class="note-card" onclick={() => navigate(`/note/${note.id}`)}>
          <h3 class="note-title">{note.title}</h3>
          <p class="note-preview">{note.content.slice(0, 120)}{note.content.length > 120 ? '…' : ''}</p>
          {#if note.tags.length > 0}
            <div class="note-tags">
              {#each note.tags.slice(0, 4) as tag}
                <span class="tag">{tag}</span>
              {/each}
              {#if note.tags.length > 4}
                <span class="tag tag-more">+{note.tags.length - 4}</span>
              {/if}
            </div>
          {/if}
          <time class="note-date">{new Date(note.modified).toLocaleDateString()}</time>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .note-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .top-actions {
    display: flex;
    gap: 0.5rem;
  }

  h2 {
    margin: 0;
    font-size: 1.4rem;
  }

  .empty {
    text-align: center;
    color: var(--color-text-secondary);
    padding: 3rem 1rem;
  }

  .notes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.75rem;
  }

  .note-card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 0.9rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
    font-family: var(--font);
    color: var(--color-text);
  }

  .note-card:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-primary);
  }

  .note-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.3;
  }

  .note-preview {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  .note-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .tag {
    font-size: 0.7rem;
    background: rgba(79, 70, 229, 0.1);
    color: var(--color-primary);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }

  .tag-more {
    background: var(--color-surface-hover);
    color: var(--color-text-secondary);
  }

  .note-date {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
    margin-top: 0.2rem;
  }
</style>
