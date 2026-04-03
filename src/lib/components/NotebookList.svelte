<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../core/storage';
  import { navigate, showToast } from '../stores';
  import type { Notebook } from '../core/types';

  let notebooks = $state<Notebook[]>([]);
  let noteCounts = $state<Record<string, number>>({});
  let showNew = $state(false);
  let newName = $state('');
  let newDesc = $state('');

  const sub = liveQuery(() => db.notebooks.toArray());
  $effect(() => {
    const subscription = sub.subscribe(async (val) => {
      notebooks = val.sort((a, b) => b.modified - a.modified);
      const counts: Record<string, number> = {};
      for (const nb of val) {
        counts[nb.id] = await db.notes.where('notebookId').equals(nb.id).count();
      }
      noteCounts = counts;
    });
    return () => subscription.unsubscribe();
  });

  async function createNotebook() {
    if (!newName.trim()) { showToast('Name is required', 'error'); return; }
    const now = Date.now();
    const nb: Notebook = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      description: newDesc.trim(),
      created: now,
      modified: now,
    };
    await db.notebooks.add(nb);
    showToast('Notebook created', 'success');
    newName = '';
    newDesc = '';
    showNew = false;
    navigate(`/notebook/${nb.id}`);
  }

  async function deleteNotebook(id: string) {
    const noteIds = await db.notes.where('notebookId').equals(id).primaryKeys();
    for (const nid of noteIds) {
      await db.noteLinks.where('sourceId').equals(nid).delete();
      await db.noteLinks.where('targetId').equals(nid).delete();
    }
    await db.notes.where('notebookId').equals(id).delete();
    await db.notebooks.delete(id);
    showToast('Notebook deleted', 'success');
  }
</script>

<div class="notebook-list">
  <div class="top-row">
    <h2>Notebooks</h2>
    <button class="btn btn-primary btn-sm" onclick={() => showNew = !showNew}>
      {showNew ? 'Cancel' : '+ New Notebook'}
    </button>
  </div>

  {#if showNew}
    <div class="new-form">
      <input type="text" bind:value={newName} placeholder="Notebook name…" />
      <input type="text" bind:value={newDesc} placeholder="Description (optional)" />
      <button class="btn btn-primary btn-sm" onclick={createNotebook}>Create</button>
    </div>
  {/if}

  {#if notebooks.length === 0 && !showNew}
    <div class="empty">
      <p>No notebooks yet. Create one to start organising your notes!</p>
    </div>
  {:else}
    <div class="nb-grid">
      {#each notebooks as nb (nb.id)}
        <div class="nb-card">
          <button class="nb-card-main" onclick={() => navigate(`/notebook/${nb.id}`)}>
            <span class="nb-icon">📓</span>
            <div class="nb-info">
              <h3>{nb.name}</h3>
              {#if nb.description}
                <p class="nb-desc">{nb.description}</p>
              {/if}
              <span class="nb-meta">{noteCounts[nb.id] ?? 0} notes</span>
            </div>
          </button>
          <div class="nb-actions">
            <button class="btn btn-ghost btn-sm" onclick={() => navigate(`/notebook/${nb.id}/map`)} title="Knowledge Map">🗺</button>
            <button class="btn btn-danger-ghost btn-sm" onclick={() => deleteNotebook(nb.id)} title="Delete">🗑</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .notebook-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 { margin: 0; font-size: 1.4rem; }

  .new-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .empty {
    text-align: center;
    color: var(--color-text-secondary);
    padding: 3rem 1rem;
  }

  .nb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: 0.75rem;
  }

  .nb-card {
    display: flex;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .nb-card:hover { border-color: var(--color-primary); }

  .nb-card-main {
    flex: 1;
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.9rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: var(--font);
    color: var(--color-text);
  }

  .nb-icon { font-size: 1.6rem; flex-shrink: 0; margin-top: 0.1rem; }

  .nb-info { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
  .nb-info h3 { margin: 0; font-size: 0.95rem; font-weight: 600; }
  .nb-desc {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nb-meta { font-size: 0.7rem; color: var(--color-text-secondary); }

  .nb-actions {
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--color-border);
  }
</style>
