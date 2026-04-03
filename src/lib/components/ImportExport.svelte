<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '../core/storage';
  import { importJSON, importCSV, importFlashLocal, exportDecks, downloadFile } from '../core/io';
  import { showToast } from '../stores';
  import type { Deck, FlashLocalFile } from '../core/types';

  let decks = $state<Deck[]>([]);
  let selectedDeckIds = $state<Set<string>>(new Set());
  let importing = $state(false);
  let deckNameForImport = $state('Imported Deck');

  // Folder reading
  let folderSupported = $state(typeof window !== 'undefined' && 'showDirectoryPicker' in window);
  let folderHandle = $state<FileSystemDirectoryHandle | null>(null);
  let folderName = $state('');
  let folderFiles = $state<string[]>([]);

  onMount(async () => {
    decks = await db.decks.toArray();
    // Restore saved folder handle from IndexedDB if available
    const saved = localStorage.getItem('flashlocal-folder-name');
    if (saved) folderName = saved;
  });

  async function pickFolder() {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'read' });
      folderHandle = handle;
      folderName = handle.name;
      localStorage.setItem('flashlocal-folder-name', handle.name);
      await scanFolder();
    } catch (e: any) {
      if (e.name !== 'AbortError') showToast('Could not open folder', 'error');
    }
  }

  async function scanFolder() {
    if (!folderHandle) return;
    const files: string[] = [];
    for await (const entry of (folderHandle as any).values()) {
      if (entry.kind === 'file') {
        const name = entry.name as string;
        if (name.endsWith('.flashlocal') || name.endsWith('.json') || name.endsWith('.csv') || name.endsWith('.tsv')) {
          files.push(name);
        }
      }
    }
    folderFiles = files.sort();
  }

  async function importFromFolder(fileName: string) {
    if (!folderHandle) return;
    importing = true;
    try {
      const fileHandle = await folderHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const text = await file.text();

      if (fileName.endsWith('.flashlocal') || fileName.endsWith('.json')) {
        const data = JSON.parse(text);
        if (data.app === 'FlashLocal') {
          const result = await importFlashLocal(data as FlashLocalFile);
          showToast(`Imported ${result.decks} deck(s), ${result.cards} cards`, 'success');
        } else {
          const result = await importJSON(text, deckNameForImport);
          showToast(`Imported ${result.cards} cards`, 'success');
        }
      } else {
        const result = await importCSV(text, deckNameForImport);
        showToast(`Imported ${result.cards} cards`, 'success');
      }
      decks = await db.decks.toArray();
    } catch (e: any) {
      showToast(e.message || 'Import failed', 'error');
    } finally {
      importing = false;
    }
  }

  async function handleFileImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    importing = true;
    try {
      const text = await file.text();

      if (file.name.endsWith('.flashlocal') || file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        if (data.app === 'FlashLocal') {
          const result = await importFlashLocal(data as FlashLocalFile);
          showToast(`Imported ${result.decks} deck(s), ${result.cards} cards`, 'success');
        } else {
          const result = await importJSON(text, deckNameForImport);
          showToast(`Imported ${result.cards} cards`, 'success');
        }
      } else if (
        file.name.endsWith('.csv') ||
        file.name.endsWith('.tsv') ||
        file.name.endsWith('.txt')
      ) {
        const result = await importCSV(text, deckNameForImport);
        showToast(`Imported ${result.cards} cards`, 'success');
      } else {
        showToast('Unsupported file format', 'error');
      }

      decks = await db.decks.toArray();
    } catch (e: any) {
      showToast(e.message || 'Import failed', 'error');
    } finally {
      importing = false;
      input.value = '';
    }
  }

  async function handleExport() {
    if (selectedDeckIds.size === 0) {
      showToast('Select at least one deck to export', 'error');
      return;
    }
    const data = await exportDecks([...selectedDeckIds]);
    const json = JSON.stringify(data, null, 2);
    const name =
      data.decks.length === 1
        ? `${data.decks[0].name.replace(/[^a-zA-Z0-9]/g, '-')}.flashlocal`
        : 'flashlocal-export.flashlocal';
    downloadFile(json, name);
    showToast('Export downloaded', 'success');
  }

  function toggleDeck(id: string) {
    const next = new Set(selectedDeckIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedDeckIds = next;
  }

  function selectAll() {
    selectedDeckIds = new Set(decks.map(d => d.id));
  }
</script>

<div class="import-export">
  <section>
    <h2>Import</h2>
    <p class="hint">Supports <strong>.flashlocal</strong>, <strong>.json</strong>, <strong>.csv</strong>, and <strong>.tsv</strong> files.</p>

    <label class="field">
      <span>Deck name (for CSV/JSON imports)</span>
      <input type="text" bind:value={deckNameForImport} placeholder="Imported Deck" />
    </label>

    <label class="file-input">
      <input type="file" accept=".flashlocal,.json,.csv,.tsv,.txt" onchange={handleFileImport} disabled={importing} />
      <span class="btn btn-primary">{importing ? 'Importing...' : 'Choose File'}</span>
    </label>

    <div class="format-info">
      <h4>Supported formats:</h4>
      <ul>
        <li><strong>.flashlocal / .json</strong> — FlashLocal native format or array of <code>{`{front, back, tags?}`}</code></li>
        <li><strong>.csv / .tsv</strong> — Tab or comma-separated: front, back, tags (optional)</li>
      </ul>
    </div>
  </section>

  <hr />

  <section>
    <h2>Local Folder</h2>
    {#if folderSupported}
      <p class="hint">Pick a folder on your device to read .flashlocal, .json, .csv, and .tsv files directly.</p>
      <div class="folder-row">
        <button class="btn btn-secondary" onclick={pickFolder}>
          📁 {folderHandle ? 'Change Folder' : 'Select Folder'}
        </button>
        {#if folderHandle}
          <span class="folder-name">📂 {folderName}</span>
          <button class="btn btn-ghost btn-sm" onclick={scanFolder}>↻ Refresh</button>
        {/if}
      </div>

      {#if folderFiles.length > 0}
        <div class="folder-files">
          {#each folderFiles as file}
            <div class="folder-file">
              <span class="file-name">{file}</span>
              <button class="btn btn-primary btn-sm" onclick={() => importFromFolder(file)} disabled={importing}>
                Import
              </button>
            </div>
          {/each}
        </div>
      {:else if folderHandle}
        <p class="hint">No supported files found in this folder.</p>
      {/if}
    {:else}
      <p class="hint">Folder access is available on desktop browsers (Chrome, Edge). On mobile, use the file import above.</p>
    {/if}
  </section>

  <hr />

  <section>
    <h2>Export</h2>
    {#if decks.length === 0}
      <p class="hint">No decks to export. Create some cards first!</p>
    {:else}
      <div class="export-actions">
        <button class="btn btn-ghost btn-sm" onclick={selectAll}>Select all</button>
      </div>
      <div class="deck-select">
        {#each decks as deck (deck.id)}
          <label class="deck-option">
            <input type="checkbox" checked={selectedDeckIds.has(deck.id)} onchange={() => toggleDeck(deck.id)} />
            <span>{deck.name}</span>
          </label>
        {/each}
      </div>
      <button class="btn btn-primary" onclick={handleExport} disabled={selectedDeckIds.size === 0}>
        Export {selectedDeckIds.size > 0 ? `(${selectedDeckIds.size})` : ''}
      </button>
    {/if}
  </section>
</div>

<style>
  .import-export { display: flex; flex-direction: column; gap: 1.5rem; }
  section { display: flex; flex-direction: column; gap: 0.75rem; }
  h2 { margin: 0; }
  hr { border: none; border-top: 1px solid var(--color-border); margin: 0.5rem 0; }
  .hint { color: var(--color-text-secondary); font-size: 0.9rem; margin: 0; }

  .field { display: flex; flex-direction: column; gap: 0.35rem; }
  .field span { font-weight: 500; font-size: 0.9rem; }

  .file-input { cursor: pointer; display: inline-flex; }
  .file-input input { display: none; }

  .format-info {
    background: var(--color-surface);
    border-radius: var(--radius);
    padding: 1rem;
    font-size: 0.85rem;
  }
  .format-info h4 { margin: 0 0 0.5rem 0; }
  .format-info ul { margin: 0; padding-left: 1.25rem; }
  .format-info li { margin-bottom: 0.25rem; }

  .deck-select { display: flex; flex-direction: column; gap: 0.25rem; }
  .deck-option {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem; border-radius: 8px; cursor: pointer;
  }
  .deck-option:hover { background: var(--color-surface); }
  .export-actions { display: flex; justify-content: flex-end; }

  .folder-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .folder-name {
    font-size: 0.85rem;
    color: var(--color-primary);
  }

  .folder-files {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .folder-file {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.6rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .file-name {
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
