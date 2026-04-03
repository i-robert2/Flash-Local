<script lang="ts">
  import { db } from '../core/storage';
  import { navigate, showToast } from '../stores';
  import type { Note } from '../core/types';
  import { depthLabel, depthColor as getDepthColor } from '../core/types';
  import CardContent from './CardContent.svelte';

  interface Props {
    noteId: string;
  }

  let { noteId }: Props = $props();

  let note = $state<Note | null>(null);
  let loaded = $state(false);
  let contentBodyEl: HTMLDivElement;

  // Search within note
  let showSearch = $state(false);
  let searchQuery = $state('');
  let matchCount = $state(0);
  let currentMatch = $state(0);

  $effect(() => {
    db.notes.get(noteId).then(n => {
      note = n ?? null;
      loaded = true;
    });
  });

  function getColor(depth: number): string {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return getDepthColor(depth, isDark ? 'dark' : 'light');
  }

  function goEdit(event?: MouseEvent) {
    if (!note) return;

    let clickOffset = -1;
    if (event && contentBodyEl) {
      // Use caretRangeFromPoint to get the EXACT click position.
      // getSelection() is unreliable here because dblclick selects the whole word.
      let caretNode: Node | undefined;
      let caretOff = 0;
      if (document.caretRangeFromPoint) {
        const r = document.caretRangeFromPoint(event.clientX, event.clientY);
        if (r) { caretNode = r.startContainer; caretOff = r.startOffset; }
      } else if ((document as any).caretPositionFromPoint) {
        const p = (document as any).caretPositionFromPoint(event.clientX, event.clientY);
        if (p) { caretNode = p.offsetNode; caretOff = p.offset; }
      }

      if (caretNode && caretNode.nodeType === Node.TEXT_NODE && contentBodyEl.contains(caretNode)) {
        // Collect all rendered text before the exact click point
        const walker = document.createTreeWalker(contentBodyEl, NodeFilter.SHOW_TEXT);
        let precedingText = '';
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (node === caretNode) {
            precedingText += caretNode.textContent!.slice(0, caretOff);
            break;
          }
          precedingText += node.textContent ?? '';
        }

        const raw = note.content;

        // Strip image markdown syntax, build position map
        const imgRe = /!\[[^\]]*\]\([^)]*\)/g;
        let stripped = '';
        const posMap: number[] = [];
        let lastEnd = 0;
        let m: RegExpExecArray | null;
        while ((m = imgRe.exec(raw)) !== null) {
          for (let i = lastEnd; i < m.index; i++) {
            posMap.push(i);
            stripped += raw[i];
          }
          lastEnd = m.index + m[0].length;
        }
        for (let i = lastEnd; i < raw.length; i++) {
          posMap.push(i);
          stripped += raw[i];
        }

        // Align rendered text with stripped markdown, handling whitespace flexibly.
        // Rendered text has spaces/no-gaps where raw has \n or \n\n.
        const isWs = (c: string) => c === ' ' || c === '\n' || c === '\r' || c === '\t';

        let strippedIdx = 0;
        let renderedIdx = 0;
        while (renderedIdx < precedingText.length && strippedIdx < stripped.length) {
          const rc = precedingText[renderedIdx];
          const sc = stripped[strippedIdx];

          if (rc === sc) {
            renderedIdx++;
            strippedIdx++;
          } else if (isWs(rc) && isWs(sc)) {
            // Both whitespace but different chars — consume both
            renderedIdx++;
            strippedIdx++;
          } else if (isWs(sc)) {
            // Extra whitespace in raw markdown (\n\n between paragraphs)
            strippedIdx++;
          } else if (isWs(rc)) {
            // Extra whitespace in rendered text
            renderedIdx++;
          } else {
            // Non-whitespace mismatch — skip markdown syntax (e.g. #, *, _)
            strippedIdx++;
          }
        }

        // After alignment, if we consumed all rendered text and landed on
        // whitespace in the raw markdown, skip to the next content char.
        // This happens when clicking at the START of a word — the preceding
        // text ends before the paragraph break, so we need to jump past \n\n.
        if (renderedIdx >= precedingText.length) {
          while (strippedIdx < stripped.length && (stripped[strippedIdx] === '\n' || stripped[strippedIdx] === '\r')) {
            strippedIdx++;
          }
        }

        clickOffset = strippedIdx < posMap.length ? posMap[strippedIdx] : raw.length;
      }
    }

    const param = clickOffset >= 0 ? `?cursor=${clickOffset}` : '';
    navigate(`/notebook/${note.notebookId}/note/${note.id}/edit${param}`);
  }

  function toggleSearch() {
    showSearch = !showSearch;
    if (!showSearch) clearHighlights();
  }

  function doSearch() {
    clearHighlights();
    if (!searchQuery.trim() || !contentBodyEl) { matchCount = 0; currentMatch = 0; return; }

    const walker = document.createTreeWalker(contentBodyEl, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

    const query = searchQuery.toLowerCase();
    let count = 0;

    for (const node of textNodes) {
      const text = node.textContent || '';
      const lower = text.toLowerCase();
      let idx = lower.indexOf(query);
      if (idx === -1) continue;

      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      while (idx !== -1) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.dataset.matchIdx = String(count);
        mark.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(mark);
        count++;
        lastIdx = idx + query.length;
        idx = lower.indexOf(query, lastIdx);
      }
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      node.parentNode?.replaceChild(frag, node);
    }

    matchCount = count;
    currentMatch = count > 0 ? 1 : 0;
    if (count > 0) scrollToMatch(0);
  }

  function scrollToMatch(idx: number) {
    const marks = contentBodyEl?.querySelectorAll('mark.search-highlight');
    if (!marks?.length) return;
    marks.forEach(m => m.classList.remove('search-current'));
    const target = marks[idx];
    if (target) {
      target.classList.add('search-current');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function nextMatch() {
    if (matchCount === 0) return;
    currentMatch = (currentMatch % matchCount) + 1;
    scrollToMatch(currentMatch - 1);
  }

  function prevMatch() {
    if (matchCount === 0) return;
    currentMatch = currentMatch <= 1 ? matchCount : currentMatch - 1;
    scrollToMatch(currentMatch - 1);
  }

  function clearHighlights() {
    if (!contentBodyEl) return;
    const marks = contentBodyEl.querySelectorAll('mark.search-highlight');
    for (const mark of marks) {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    }
    matchCount = 0;
    currentMatch = 0;
  }

  async function deleteNote() {
    if (!note) return;
    const children = await db.notes.where('parentId').equals(note.id).toArray();
    for (const child of children) {
      await db.notes.update(child.id, { parentId: note.parentId, depth: Math.max(0, child.depth - 1) });
    }
    await db.noteLinks.where('sourceId').equals(note.id).delete();
    await db.noteLinks.where('targetId').equals(note.id).delete();
    const nbId = note.notebookId;
    await db.notes.delete(note.id);
    showToast('Note deleted', 'success');
    navigate(`/notebook/${nbId}`);
  }
</script>

{#if loaded}
  {#if note}
    <div class="note-view">
      <div class="note-header">
        <div class="header-left">
          <span class="depth-badge" style="color: {getColor(note.depth)}; border-color: {getColor(note.depth)}">
            {depthLabel(note.depth)}
          </span>
          <h2>{note.title}</h2>
        </div>
        <div class="actions">
          <button class="btn btn-ghost btn-sm" onclick={toggleSearch} title="Search in note">🔍</button>
          <button class="btn btn-primary btn-sm" onclick={goEdit}>Edit</button>
          <button class="btn btn-danger-ghost btn-sm" onclick={deleteNote}>Delete</button>
        </div>
      </div>

      {#if showSearch}
        <div class="search-bar">
          <input
            type="search"
            bind:value={searchQuery}
            oninput={doSearch}
            placeholder="Search in note…"
            autofocus
          />
          {#if matchCount > 0}
            <span class="match-count">{currentMatch}/{matchCount}</span>
            <button class="btn btn-ghost btn-sm" onclick={prevMatch}>▲</button>
            <button class="btn btn-ghost btn-sm" onclick={nextMatch}>▼</button>
          {:else if searchQuery.trim()}
            <span class="match-count">0 results</span>
          {/if}
        </div>
      {/if}

      {#if note.tags.length > 0}
        <div class="tags">
          {#each note.tags as tag}
            <span class="tag">{tag}</span>
          {/each}
        </div>
      {/if}

      <time class="date">Last modified {new Date(note.modified).toLocaleDateString()}</time>

      <div class="content-body" bind:this={contentBodyEl} ondblclick={(e: MouseEvent) => goEdit(e)}>
        <CardContent content={note.content} />
      </div>
    </div>
  {:else}
    <div class="not-found">
      <p>Note not found.</p>
      <button class="btn btn-secondary" onclick={() => navigate('/notebooks')}>Back to Notebooks</button>
    </div>
  {/if}
{/if}

<style>
  .note-view {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .note-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex: 1;
    min-width: 0;
  }

  .depth-badge {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: 1px solid;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    width: fit-content;
  }

  h2 {
    margin: 0;
    font-size: 1.5rem;
    line-height: 1.3;
    flex: 1;
  }

  .actions {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.6rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .search-bar input {
    flex: 1;
    border: none;
    background: none;
    outline: none;
    font-size: 0.85rem;
    color: var(--color-text);
    font-family: var(--font);
    padding: 0;
  }

  .match-count {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .tag {
    font-size: 0.75rem;
    background: rgba(79, 70, 229, 0.1);
    color: var(--color-primary);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .date {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  .content-body {
    border-top: 1px solid var(--color-border);
    padding-top: 1rem;
    cursor: text;
  }

  /* Search highlight styles */
  .content-body :global(mark.search-highlight) {
    background: rgba(245, 158, 11, 0.3);
    color: inherit;
    padding: 0.05rem 0;
    border-radius: 2px;
  }

  .content-body :global(mark.search-current) {
    background: rgba(245, 158, 11, 0.7);
    outline: 2px solid var(--color-warning);
  }

  .not-found {
    text-align: center;
    color: var(--color-text-secondary);
    padding: 3rem 1rem;
  }
</style>
