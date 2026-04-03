<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '../core/storage';
  import { newCard } from '../core/io';
  import { navigate, showToast } from '../stores';
  import CardContent from './CardContent.svelte';
  import type { Note, Notebook } from '../core/types';
  import { depthLabel } from '../core/types';

  let { deckId, cardId }: { deckId: string; cardId?: string } = $props();

  let front = $state('');
  let back = $state('');
  let tagsInput = $state('');
  let noteRef = $state<string | undefined>(undefined);
  let isEditing = $derived(!!cardId);
  let preview = $state(false);

  // Note picker state
  let showNotePicker = $state(false);
  let notebooks = $state<Notebook[]>([]);
  let allNotes = $state<Note[]>([]);
  let noteSearch = $state('');
  let selectedNote = $state<{ title: string; notebookName: string; notebookId: string } | null>(null);

  let filteredNotes = $derived(
    noteSearch.trim()
      ? allNotes.filter(n =>
          n.title.toLowerCase().includes(noteSearch.toLowerCase()) ||
          n.tags.some(t => t.toLowerCase().includes(noteSearch.toLowerCase()))
        )
      : allNotes
  );

  onMount(async () => {
    if (cardId) {
      const card = await db.cards.get(cardId);
      if (card) {
        front = card.front;
        back = card.back;
        tagsInput = card.tags.join(', ');
        noteRef = card.noteRef;
        if (card.noteRef) await loadNoteRefInfo(card.noteRef);
      }
    }
    notebooks = await db.notebooks.toArray();
    allNotes = await db.notes.toArray();
  });

  async function loadNoteRefInfo(noteId: string) {
    const note = await db.notes.get(noteId);
    if (note) {
      const nb = await db.notebooks.get(note.notebookId);
      selectedNote = {
        title: note.title,
        notebookName: nb?.name ?? 'Unknown',
        notebookId: note.notebookId,
      };
    }
  }

  function pickNote(note: Note) {
    noteRef = note.id;
    const nb = notebooks.find(n => n.id === note.notebookId);
    selectedNote = {
      title: note.title,
      notebookName: nb?.name ?? 'Unknown',
      notebookId: note.notebookId,
    };
    showNotePicker = false;
    noteSearch = '';
  }

  function clearNoteRef() {
    noteRef = undefined;
    selectedNote = null;
  }

  function getNotebookName(notebookId: string): string {
    return notebooks.find(n => n.id === notebookId)?.name ?? '';
  }

  async function save() {
    if (!front.trim() || !back.trim()) {
      showToast('Both front and back are required', 'error');
      return;
    }
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    if (isEditing && cardId) {
      await db.cards.update(cardId, {
        front: front.trim(),
        back: back.trim(),
        tags,
        noteRef: noteRef || undefined,
        modified: Date.now(),
      });
      showToast('Card updated', 'success');
    } else {
      const card = newCard(deckId, front.trim(), back.trim(), tags);
      (card as any).noteRef = noteRef || undefined;
      await db.cards.add(card);
      showToast('Card added', 'success');
    }
    navigate(`/deck/${deckId}`);
  }

  async function saveAndAddAnother() {
    if (!front.trim() || !back.trim()) {
      showToast('Both front and back are required', 'error');
      return;
    }
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const card = newCard(deckId, front.trim(), back.trim(), tags);
    (card as any).noteRef = noteRef || undefined;
    await db.cards.add(card);
    showToast('Card added', 'success');
    front = '';
    back = '';
    noteRef = undefined;
    selectedNote = null;
  }
</script>

<div class="card-editor">
  <div class="editor-header">
    <h2>{isEditing ? 'Edit Card' : 'New Card'}</h2>
    <button class="btn btn-ghost" onclick={() => (preview = !preview)}>
      {preview ? 'Edit' : 'Preview'}
    </button>
  </div>

  {#if preview}
    <div class="preview-container">
      <div class="preview-card">
        <h4>Front</h4>
        <CardContent content={front || '*empty*'} />
      </div>
      <div class="preview-card">
        <h4>Back</h4>
        <CardContent content={back || '*empty*'} />
      </div>
    </div>
  {:else}
    <div class="form">
      <label class="field">
        <span>Front</span>
        <textarea bind:value={front} placeholder="Question or prompt... (supports Markdown)" rows="4"></textarea>
      </label>
      <label class="field">
        <span>Back</span>
        <textarea bind:value={back} placeholder="Answer... (supports Markdown)" rows="4"></textarea>
      </label>
      <label class="field">
        <span>Tags <small>(comma-separated)</small></span>
        <input type="text" bind:value={tagsInput} placeholder="e.g. math, calculus, chapter-3" />
      </label>

      <div class="field">
        <span>Learn More Link <small>(optional — link to a notebook note)</small></span>
        {#if selectedNote}
          <div class="note-ref-display">
            <span class="note-ref-info">📓 {selectedNote.notebookName} → {selectedNote.title}</span>
            <button class="btn btn-ghost btn-sm" onclick={clearNoteRef}>✕</button>
          </div>
        {:else}
          <button class="btn btn-secondary btn-sm" onclick={() => showNotePicker = true}>
            + Link a Note
          </button>
        {/if}

        {#if showNotePicker}
          <div class="note-picker">
            <input type="search" bind:value={noteSearch} placeholder="Search notes…" autofocus />
            <div class="note-picker-list">
              {#each filteredNotes.slice(0, 20) as note (note.id)}
                <button class="note-picker-item" onclick={() => pickNote(note)}>
                  <span class="note-picker-title">{note.title}</span>
                  <span class="note-picker-path">{getNotebookName(note.notebookId)} · {depthLabel(note.depth)}</span>
                </button>
              {/each}
              {#if filteredNotes.length === 0}
                <div class="note-picker-empty">No notes found</div>
              {/if}
            </div>
            <button class="btn btn-ghost btn-sm" onclick={() => { showNotePicker = false; noteSearch = ''; }}>Cancel</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="actions">
    <button class="btn btn-ghost" onclick={() => navigate(`/deck/${deckId}`)}>Cancel</button>
    <div class="actions-right">
      {#if !isEditing}
        <button class="btn btn-secondary" onclick={saveAndAddAnother} disabled={!front.trim() || !back.trim()}>
          Save &amp; Add Another
        </button>
      {/if}
      <button class="btn btn-primary" onclick={save} disabled={!front.trim() || !back.trim()}>
        {isEditing ? 'Update' : 'Save'}
      </button>
    </div>
  </div>
</div>

<style>
  .card-editor { display: flex; flex-direction: column; gap: 1.25rem; }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .editor-header h2 { margin: 0; }

  .form { display: flex; flex-direction: column; gap: 1rem; }

  .field { display: flex; flex-direction: column; gap: 0.35rem; }
  .field span { font-weight: 500; font-size: 0.9rem; }
  .field small { font-weight: 400; color: var(--color-text-secondary); }

  textarea {
    resize: vertical;
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .actions-right { display: flex; gap: 0.5rem; }

  .preview-container { display: flex; flex-direction: column; gap: 1rem; }
  .preview-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 1.5rem;
  }
  .preview-card h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.85rem;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    letter-spacing: 0.05em;
  }

  .note-ref-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .note-ref-info {
    font-size: 0.85rem;
    color: var(--color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note-picker {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .note-picker-list {
    max-height: 12rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .note-picker-item {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.4rem 0.5rem;
    text-align: left;
    border: none;
    background: none;
    cursor: pointer;
    font-family: var(--font);
    color: var(--color-text);
    border-radius: 6px;
  }

  .note-picker-item:hover { background: var(--color-surface-hover); }

  .note-picker-title {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .note-picker-path {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
  }

  .note-picker-empty {
    padding: 1rem;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }
</style>
