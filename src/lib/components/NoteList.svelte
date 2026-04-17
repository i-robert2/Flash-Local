<script lang="ts">
  import { db } from '../core/storage';
  import { navigate, showToast } from '../stores';
  import type { Note, Notebook } from '../core/types';
  import { depthLabel, depthColor as getDepthColor } from '../core/types';

  interface Props {
    notebookId: string;
  }

  let { notebookId }: Props = $props();

  let notebook = $state<Notebook | null>(null);
  let notes = $state<Note[]>([]);
  let search = $state('');
  let collapsed = $state<Set<string>>(new Set());

  $effect(() => {
    let cancelled = false;
    db.notebooks.get(notebookId).then(nb => {
      if (!cancelled) notebook = nb ?? null;
    });
    db.notes.where('notebookId').equals(notebookId).toArray().then(n => {
      if (!cancelled) notes = n;
    });
    return () => { cancelled = true; };
  });

  function getColor(depth: number): string {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return getDepthColor(depth, isDark ? 'dark' : 'light');
  }

  function getChildren(parentId: string | null): Note[] {
    return notes
      .filter(n => n.parentId === parentId)
      .sort((a, b) => a.created - b.created);
  }

  function hasChildren(id: string): boolean {
    return notes.some(n => n.parentId === id);
  }

  function toggleCollapse(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    collapsed = next;
  }

  // For search: flatten matching notes + their ancestors
  let matchingIds = $derived<Set<string>>(() => {
    if (!search.trim()) return new Set<string>();
    const q = search.toLowerCase();
    const matches = notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.replace(/!\[[^\]]*\]\([^)]*\)/g, '').toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    );
    // Include all ancestors so the tree stays navigable
    const ids = new Set<string>();
    for (const m of matches) {
      ids.add(m.id);
      let parent = m.parentId;
      while (parent) {
        ids.add(parent);
        const p = notes.find(n => n.id === parent);
        parent = p?.parentId ?? null;
      }
    }
    return ids;
  });

  function isVisible(note: Note): boolean {
    if (!search.trim()) return true;
    return matchingIds().has(note.id);
  }

  function isMatch(note: Note): boolean {
    if (!search.trim()) return false;
    const q = search.toLowerCase();
    return note.title.toLowerCase().includes(q) ||
      note.content.replace(/!\[[^\]]*\]\([^)]*\)/g, '').toLowerCase().includes(q) ||
      note.tags.some(t => t.toLowerCase().includes(q));
  }

  async function addChild(parentId: string | null, depth: number) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const note: Note = {
      id,
      notebookId,
      parentId,
      depth,
      title: 'Untitled',
      content: '',
      tags: [],
      created: now,
      modified: now,
    };
    await db.notes.add(note);
    showToast(`${depthLabel(depth)} created`, 'success');
    notes = await db.notes.where('notebookId').equals(notebookId).toArray();
    navigate(`/notebook/${notebookId}/note/${id}/edit`);
  }
</script>

<div class="note-tree-page">
  <div class="top-row">
    <h2>{notebook?.name ?? 'Notebook'}</h2>
    <div class="top-actions">
      <button class="btn btn-primary btn-sm" onclick={() => addChild(null, 0)}>+ Chapter</button>
      <button class="btn btn-secondary btn-sm" onclick={() => navigate(`/notebook/${notebookId}/map`)}>
        🗺 Map
      </button>
    </div>
  </div>

  <input type="search" bind:value={search} placeholder="Search notes by title or content…" />

  {#if notes.length === 0}
    <div class="empty">
      <p>No chapters yet. Click <strong>+ Chapter</strong> to start building your notebook.</p>
    </div>
  {:else}
    <div class="tree">
      {#each getChildren(null) as note (note.id)}
        {#if isVisible(note)}
          {@render treeNode(note)}
        {/if}
      {/each}
    </div>
  {/if}
</div>

{#snippet treeNode(note: Note)}
  <div class="tree-item">
    <div class="tree-row" class:tree-match={isMatch(note)} style="padding-left: {note.depth * 1.2}rem">
      <div class="row-left">
        {#if hasChildren(note.id)}
          <button class="toggle" onclick={() => toggleCollapse(note.id)}>
            {collapsed.has(note.id) ? '▸' : '▾'}
          </button>
        {:else}
          <span class="toggle-spacer"></span>
        {/if}
        <span class="depth-dot" style="background: {getColor(note.depth)}"></span>
        <button class="tree-label" onclick={() => navigate(`/notebook/${notebookId}/note/${note.id}`)}>
          <span class="label-title">{note.title}</span>
          <span class="label-badge" style="color: {getColor(note.depth)}">{depthLabel(note.depth)}</span>
        </button>
      </div>
      <button
        class="add-child-btn"
        onclick={() => addChild(note.id, note.depth + 1)}
        title="Add {depthLabel(note.depth + 1)}"
      >+</button>
    </div>
    {#if !collapsed.has(note.id)}
      {#each getChildren(note.id) as child (child.id)}
        {#if isVisible(child)}
          {@render treeNode(child)}
        {/if}
      {/each}
    {/if}
  </div>
{/snippet}

<style>
  .note-tree-page { display: flex; flex-direction: column; gap: 0.75rem; }

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

  .tree { display: flex; flex-direction: column; }

  .tree-item { display: flex; flex-direction: column; }

  .tree-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.3rem;
    padding: 0.4rem 0.5rem;
    border-radius: 8px;
    transition: background 0.1s;
  }

  .tree-row:hover { background: var(--color-surface-hover); }
  .tree-match { background: rgba(79, 70, 229, 0.08); }

  .row-left {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex: 1;
    min-width: 0;
  }

  .toggle {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    width: 1.2rem;
    text-align: center;
    padding: 0;
    flex-shrink: 0;
    font-family: var(--font);
  }

  .toggle-spacer { width: 1.2rem; flex-shrink: 0; }

  .depth-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tree-label {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text);
    font-family: var(--font);
    text-align: left;
    flex: 1;
    min-width: 0;
    padding: 0.2rem 0;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }
  .tree-label:hover .label-title { color: var(--color-primary); }

  .label-title {
    font-size: 0.9rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.1s;
  }

  .label-badge {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    flex-shrink: 0;
    opacity: 0.7;
  }

  .add-child-btn {
    background: var(--color-surface-hover);
    border: 1px solid var(--color-border);
    cursor: pointer;
    color: var(--color-primary);
    font-size: 0.75rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s;
    font-family: var(--font);
  }
  .tree-row:hover .add-child-btn { opacity: 1; }

  @media (max-width: 640px) {
    .add-child-btn { opacity: 1; }
    .tree-row { padding: 0.5rem 0.4rem; }
    .top-row { flex-direction: column; align-items: stretch; }
    .top-actions { justify-content: flex-end; }
  }
</style>
