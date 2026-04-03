<script lang="ts">
  import { db } from '../core/storage';
  import { navigate, showToast } from '../stores';
  import type { Note } from '../core/types';
  import { depthLabel } from '../core/types';
  import CardContent from './CardContent.svelte';

  interface Props {
    notebookId: string;
    noteId?: string;
  }

  let { notebookId, noteId }: Props = $props();

  let title = $state('');
  let content = $state('');
  let tagsInput = $state('');
  let depth = $state(0);
  let parentId = $state<string | null>(null);
  let saving = $state(false);
  let previewing = $state(false);
  let loaded = $state(false);
  let textareaEl: HTMLTextAreaElement;
  let fileInputEl: HTMLInputElement;

  // Read cursor position from URL query param (passed from NoteView on double-click)
  function getCursorParam(): number {
    const hash = window.location.hash;
    const match = hash.match(/[?&]cursor=(\d+)/);
    return match ? parseInt(match[1], 10) : -1;
  }

  const initialCursor = getCursorParam();

  $effect(() => {
    if (noteId) {
      db.notes.get(noteId).then(note => {
        if (note) {
          title = note.title;
          content = note.content;
          tagsInput = note.tags.join(', ');
          depth = note.depth;
          parentId = note.parentId;
        }
        loaded = true;
        // Place cursor at the position from NoteView double-click
        if (initialCursor >= 0) {
          // Double rAF to ensure Svelte has rendered the textarea
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (textareaEl) {
              const pos = Math.min(initialCursor, content.length);
              textareaEl.focus();
              textareaEl.setSelectionRange(pos, pos);

              // Scroll textarea so the cursor line is visible near the middle
              const textBefore = content.slice(0, pos);
              const linesBefore = textBefore.split('\n').length;
              const lineHeight = parseFloat(getComputedStyle(textareaEl).lineHeight) || 24;
              const targetScroll = (linesBefore * lineHeight) - (textareaEl.clientHeight / 2);
              textareaEl.scrollTop = Math.max(0, targetScroll);
            }
          }));
        }
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
        notebookId,
        parentId,
        depth,
        title: title.trim(),
        content,
        tags,
        created: now,
        modified: now,
      };
      await db.notes.add(note);
      noteId = id;
      showToast('Note created', 'success');
    }
    saving = false;
    navigate(`/notebook/${notebookId}/note/${noteId}`);
  }

  async function deleteNote() {
    if (!noteId) return;
    // Reparent children to this note's parent
    const children = await db.notes.where('parentId').equals(noteId).toArray();
    for (const child of children) {
      await db.notes.update(child.id, { parentId, depth: Math.max(0, child.depth - 1) });
    }
    await db.noteLinks.where('sourceId').equals(noteId).delete();
    await db.noteLinks.where('targetId').equals(noteId).delete();
    await db.notes.delete(noteId);
    showToast('Note deleted', 'success');
    navigate(`/notebook/${notebookId}`);  
  }

  function insertImage() {
    fileInputEl.click();
  }

  function handleImageUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      const markdown = `![${file.name}](${dataUri})`;
      if (textareaEl) {
        const start = textareaEl.selectionStart;
        const end = textareaEl.selectionEnd;
        content = content.slice(0, start) + markdown + content.slice(end);
      } else {
        content += '\n' + markdown;
      }
      showToast('Image inserted', 'success');
    };
    reader.readAsDataURL(file);
    input.value = '';
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
        <div class="label-actions">
          <button class="btn btn-ghost btn-sm" onclick={insertImage} title="Insert image">
            🖼 Image
          </button>
          <button class="btn btn-ghost btn-sm" onclick={() => previewing = !previewing}>
            {previewing ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>
      <input type="file" accept="image/*" bind:this={fileInputEl} onchange={handleImageUpload} hidden />
      {#if previewing}
        <div class="preview-box">
          <CardContent content={content} />
        </div>
      {:else}
        <textarea bind:this={textareaEl} bind:value={content} rows={20} placeholder="Write your note in Markdown…"></textarea>
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
      <button class="btn btn-secondary" onclick={() => navigate(noteId ? `/notebook/${notebookId}/note/${noteId}` : `/notebook/${notebookId}`)}>Cancel</button>
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

  .label-actions {
    display: flex;
    gap: 0.25rem;
  }

  textarea {
    resize: vertical;
    min-height: 10rem;
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

  @media (max-width: 640px) {
    textarea { min-height: 8rem; font-size: 0.85rem; }
    .label-row { flex-wrap: wrap; gap: 0.3rem; }
    .actions { gap: 0.4rem; }
    .actions .btn { flex: 1; min-width: 0; }
  }
</style>
