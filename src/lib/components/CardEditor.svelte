<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '../core/storage';
  import { newCard } from '../core/io';
  import { navigate, showToast } from '../stores';
  import CardContent from './CardContent.svelte';

  let { deckId, cardId }: { deckId: string; cardId?: string } = $props();

  let front = $state('');
  let back = $state('');
  let tagsInput = $state('');
  let isEditing = $derived(!!cardId);
  let preview = $state(false);

  onMount(async () => {
    if (cardId) {
      const card = await db.cards.get(cardId);
      if (card) {
        front = card.front;
        back = card.back;
        tagsInput = card.tags.join(', ');
      }
    }
  });

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
        modified: Date.now(),
      });
      showToast('Card updated', 'success');
    } else {
      const card = newCard(deckId, front.trim(), back.trim(), tags);
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
    await db.cards.add(card);
    showToast('Card added', 'success');
    front = '';
    back = '';
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
</style>
