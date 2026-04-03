<script lang="ts">
  import { db } from '../core/storage';
  import { navigate } from '../stores';
  import type { Note } from '../core/types';
  import { depthLabel, depthColor as getDepthColor } from '../core/types';

  interface Props {
    notebookId: string;
  }

  let { notebookId }: Props = $props();

  let notes = $state<Note[]>([]);
  let search = $state('');

  $effect(() => {
    db.notes.where('notebookId').equals(notebookId).toArray().then(n => { notes = n; });
  });

  let filtered = $derived(
    search.trim()
      ? notes.filter(n =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
        )
      : notes
  );

  function getColor(depth: number): string {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return getDepthColor(depth, isDark ? 'dark' : 'light');
  }
</script>

<div class="note-list">
  <div class="top-row">
    <h2>All Notes</h2>
    <div class="top-actions">
      <button class="btn btn-secondary btn-sm" onclick={() => navigate(`/notebook/${notebookId}/map`)}>
        🗺 Knowledge Map
      </button>
    </div>
  </div>

  {#if notes.length > 0}
    <input type="search" bind:value={search} placeholder="Search notes…" />
  {/if}

  {#if filtered.length === 0}
    <div class="empty">
      {#if notes.length === 0}
        <p>No notes yet. Use the sidebar to create chapters!</p>
      {:else}
        <p>No notes match your search.</p>
      {/if}
    </div>
  {:else}
    <div class="notes-grid">
      {#each filtered.sort((a, b) => a.depth - b.depth || a.created - b.created) as note (note.id)}
        <button class="note-card" onclick={() => navigate(`/notebook/${notebookId}/note/${note.id}`)}>
          <div class="note-depth-bar" style="background: {getColor(note.depth)}"></div>
          <div class="note-body">
            <span class="note-badge" style="color: {getColor(note.depth)}">{depthLabel(note.depth)}</span>
            <h3 class="note-title">{note.title}</h3>
            <p class="note-preview">{note.content.slice(0, 100)}{note.content.length > 100 ? '…' : ''}</p>
            {#if note.tags.length > 0}
              <div class="note-tags">
                {#each note.tags.slice(0, 3) as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .note-list { display: flex; flex-direction: column; gap: 1rem; }

  .top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .top-actions { display: flex; gap: 0.5rem; }
  h2 { margin: 0; font-size: 1.3rem; }

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

  @media (max-width: 640px) {
    .notes-grid { grid-template-columns: 1fr; }
    .top-row { flex-direction: column; align-items: stretch; }
    .top-actions { justify-content: flex-end; }
  }

  .note-card {
    display: flex;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s;
    font-family: var(--font);
    color: var(--color-text);
  }

  .note-card:hover { border-color: var(--color-primary); }

  .note-depth-bar {
    width: 4px;
    flex-shrink: 0;
  }

  .note-body {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.75rem;
    min-width: 0;
  }

  .note-badge {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .note-title {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.3;
  }

  .note-preview {
    margin: 0;
    font-size: 0.78rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .note-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; }

  .tag {
    font-size: 0.65rem;
    background: rgba(79, 70, 229, 0.1);
    color: var(--color-primary);
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
  }
</style>
