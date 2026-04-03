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
  let collapsed = $state<Set<string>>(new Set());

  $effect(() => { loadData(); });

  async function loadData() {
    notebook = (await db.notebooks.get(notebookId)) ?? null;
    notes = await db.notes.where('notebookId').equals(notebookId).toArray();
  }

  function getChildren(parentId: string | null): Note[] {
    return notes
      .filter(n => n.parentId === parentId)
      .sort((a, b) => a.created - b.created);
  }

  function toggleCollapse(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    collapsed = next;
  }

  function getColor(depth: number): string {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return getDepthColor(depth, isDark ? 'dark' : 'light');
  }

  function hasChildren(id: string): boolean {
    return notes.some(n => n.parentId === id);
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
    await loadData();
    navigate(`/notebook/${notebookId}/note/${id}/edit`);
  }
</script>

<aside class="sidebar">
  <div class="sidebar-header">
    <button class="back-link" onclick={() => navigate('/notebooks')}>← Notebooks</button>
    <h3 class="nb-title">{notebook?.name ?? '…'}</h3>
  </div>

  <div class="tree">
    {#each getChildren(null) as note (note.id)}
      {@render treeNode(note)}
    {/each}
  </div>

  <div class="sidebar-footer">
    <button class="btn btn-primary btn-sm sidebar-btn" onclick={() => addChild(null, 0)}>+ Chapter</button>
    <button class="btn btn-secondary btn-sm sidebar-btn" onclick={() => navigate(`/notebook/${notebookId}/map`)}>🗺 Map</button>
  </div>
</aside>

{#snippet treeNode(note: Note)}
  <div class="tree-item" style="padding-left: {note.depth * 1}rem">
    <div class="tree-row">
      {#if hasChildren(note.id)}
        <button class="toggle" onclick={() => toggleCollapse(note.id)}>
          {collapsed.has(note.id) ? '▸' : '▾'}
        </button>
      {:else}
        <span class="toggle-spacer"></span>
      {/if}
      <span class="depth-dot" style="background: {getColor(note.depth)}"></span>
      <button class="tree-label" onclick={() => navigate(`/notebook/${notebookId}/note/${note.id}`)}>
        {note.title}
      </button>
        <button
          class="add-child"
          onclick={() => addChild(note.id, note.depth + 1)}
          title="Add {depthLabel(note.depth + 1)}"
        >+</button>
    </div>
    {#if !collapsed.has(note.id)}
      {#each getChildren(note.id) as child (child.id)}
        {@render treeNode(child)}
      {/each}
    {/if}
  </div>
{/snippet}

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    width: 16rem;
    min-width: 16rem;
    height: calc(100vh - 3.5rem);
    height: calc(100dvh - 3.5rem);
    border-right: 1px solid var(--color-border);
    background: var(--color-surface);
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .sidebar {
      width: 80vw;
      min-width: 80vw;
      max-width: 20rem;
      height: 100vh;
      height: 100dvh;
      box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
    }
  }

  .sidebar-header {
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-border);
  }

  .back-link {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
    font-family: var(--font);
  }
  .back-link:hover { color: var(--color-primary); }

  .nb-title {
    margin: 0.3rem 0 0;
    font-size: 1rem;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .tree-item { display: flex; flex-direction: column; }

  .tree-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    min-height: 1.8rem;
  }

  .tree-row:hover { background: var(--color-surface-hover); }

  .toggle {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: 0.7rem;
    width: 1rem;
    text-align: center;
    padding: 0;
    flex-shrink: 0;
    font-family: var(--font);
  }

  .toggle-spacer { width: 1rem; flex-shrink: 0; }

  .depth-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tree-label {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text);
    font-size: 0.82rem;
    font-family: var(--font);
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    padding: 0;
  }
  .tree-label:hover { color: var(--color-primary); }

  .add-child {
    background: none;
    border: 1px solid transparent;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    padding: 0 0.3rem;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s;
    font-family: var(--font);
    border-radius: 4px;
    flex-shrink: 0;
  }
  .tree-row:hover .add-child { opacity: 1; }
  .add-child:hover { color: var(--color-primary); }

  @media (max-width: 640px) {
    .add-child {
      opacity: 1;
      color: var(--color-primary);
      border-color: var(--color-border);
      padding: 0.15rem 0.4rem;
      font-size: 0.75rem;
      background: var(--color-surface-hover);
    }

    .tree-row {
      min-height: 2.2rem;
      padding: 0.3rem 0.5rem;
    }
  }

  .sidebar-footer {
    padding: 0.5rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: 0.4rem;
  }

  .sidebar-btn { flex: 1; }
</style>
