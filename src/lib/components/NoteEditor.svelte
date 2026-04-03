<script lang="ts">
  import { db } from '../core/storage';
  import { navigate, showToast } from '../stores';
  import type { Note } from '../core/types';
  import CardContent from './CardContent.svelte';

  interface Props {
    noteId?: string;
  }

  let { noteId }: Props = $props();

  let title = $state('');
  let content = $state('');
  let tagsInput = $state('');
  let saving = $state(false);
  let previewing = $state(false);
  let loaded = $state(false);

  $effect(() => {
    if (noteId) {
      db.notes.get(noteId).then(note => {
        if (note) {
          title = note.title;
          content = note.content;
          tagsInput = note.tags.join(', ');
        }
        loaded = true;
      });
    } else {
      loaded = true;
    }
  });

  function parseTags(input: string): string[] {
    return input.split(',').map(t => t.trim()).filter(Boolean);
  }

  async function save() {
    if (!title.trim()) {
      showToast('Title is required', 'error');
      return;
    }

    saving = true;
    const now = Date.now();
    const tags = parseTags(tagsInput);

    if (noteId) {
      await db.notes.update(noteId, {
        title: title.trim(),
        content,
        tags,
        modified: now,
      });
      showToast('Note updated', 'success');
    } else {
      const id = crypto.randomUUID();
      const note: Note = {
        id,
        title: title.trim(),
        content,
        tags,
        created: now,
        modified: now,
      };
      await db.notes.add(note);
      showToast('Note created', 'success');
    }
    saving = false;
    navigate('/notes');
  }

  async function deleteNote() {
    if (!noteId) return;
    // Remove links referencing this note
    await db.noteLinks.where('sourceId').equals(noteId).delete();
    await db.noteLinks.where('targetId').equals(noteId).delete();
    await db.notes.delete(noteId);
    showToast('Note deleted', 'success');
    navigate('/notes');
  }
</script>

{#if loaded}
  <div class="note-editor">
    <h2>{noteId ? 'Edit Note' : 'New Note'}</h2>

    <label class="field">
      <span class="label">Title</span>
      <input type="text" bind:value={title} placeholder="Note title…" />
    </label>

    <div class="field">
      <div class="label-row">
        <span class="label">Content (Markdown)</span>
        <button class="btn btn-ghost btn-sm" onclick={() => previewing = !previewing}>
          {previewing ? 'Edit' : 'Preview'}
        </button>
      </div>
      {#if previewing}
        <div class="preview-box">
          <CardContent text={content} />
        </div>
      {:else}
        <textarea bind:value={content} rows={12} placeholder="Write your note in Markdown…"></textarea>
      {/if}
    </div>

    <label class="field">
      <span class="label">Tags (comma-separated)</span>
      <input type="text" bind:value={tagsInput} placeholder="e.g. biology, chapter-1" />
    </label>

    <div class="actions">
      <button class="btn btn-primary" onclick={save} disabled={saving}>
        {saving ? 'Saving…' : noteId ? 'Save Changes' : 'Create Note'}
      </button>
      <button class="btn btn-secondary" onclick={() => navigate('/notes')}>Cancel</button>
      {#if noteId}
        <button class="btn btn-danger-ghost" onclick={deleteNote}>Delete</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .note-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  h2 {
    margin: 0;
    font-size: 1.4rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  textarea {
    resize: vertical;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .preview-box {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.75rem;
    min-height: 12rem;
    background: var(--color-surface);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>
