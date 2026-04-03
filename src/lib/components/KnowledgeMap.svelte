<script lang="ts">
  import cytoscape from 'cytoscape';
  import type { Core, EventObject } from 'cytoscape';
  import { db } from '../core/storage';
  import { navigate, showToast } from '../stores';
  import type { Note, NoteLink } from '../core/types';

  let container: HTMLDivElement;
  let cy: Core | null = null;
  let notes = $state<Note[]>([]);
  let noteLinks = $state<NoteLink[]>([]);

  // ── Link creation mode ──────────────────────────────────
  let linkMode = $state(false);
  let linkSource = $state<string | null>(null);

  // ── Zoom display ────────────────────────────────────────
  let zoomLevel = $state(1);

  $effect(() => {
    loadData();
    return () => { cy?.destroy(); };
  });

  async function loadData() {
    notes = await db.notes.toArray();
    noteLinks = await db.noteLinks.toArray();
    initGraph();
  }

  function initGraph() {
    if (!container) return;
    cy?.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const nodeColor = isDark ? '#6366F1' : '#4F46E5';
    const nodeLabelColor = isDark ? '#F9FAFB' : '#111827';
    const edgeColor = isDark ? '#4B5563' : '#9CA3AF';
    const bgColor = isDark ? '#111827' : '#F9FAFB';

    const nodeElements = notes.map(n => ({
      data: { id: n.id, label: n.title },
      position: { x: n.mapX ?? Math.random() * 600, y: n.mapY ?? Math.random() * 400 },
    }));

    const edgeElements = noteLinks
      .filter(l => notes.some(n => n.id === l.sourceId) && notes.some(n => n.id === l.targetId))
      .map(l => ({
        data: { id: l.id, source: l.sourceId, target: l.targetId, label: l.label || '' },
      }));

    cy = cytoscape({
      container,
      elements: [...nodeElements.map(n => ({ group: 'nodes' as const, ...n })),
                  ...edgeElements.map(e => ({ group: 'edges' as const, ...e }))],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': nodeColor,
            'label': 'data(label)',
            'color': nodeLabelColor,
            'font-size': '12px',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'width': 30,
            'height': 30,
            'text-max-width': '100px',
            'text-wrap': 'ellipsis',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#F59E0B',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': edgeColor,
            'target-arrow-color': edgeColor,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'color': edgeColor,
            'text-rotation': 'autorotate',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#EF4444',
            'target-arrow-color': '#EF4444',
            'width': 3,
          },
        },
      ],
      layout: notes.some(n => n.mapX != null) ? { name: 'preset' } : { name: 'cose', animate: false },
      minZoom: 0.2,
      maxZoom: 5,
      wheelSensitivity: 0.3,
    });

    container.style.background = bgColor;

    zoomLevel = cy.zoom();
    cy.on('zoom', () => { zoomLevel = cy!.zoom(); });

    // Save node positions when dragged
    cy.on('dragfree', 'node', async (e: EventObject) => {
      const node = e.target;
      const pos = node.position();
      await db.notes.update(node.id(), { mapX: pos.x, mapY: pos.y, modified: Date.now() });
    });

    // Double-click node to open note editor
    cy.on('dbltap', 'node', (e: EventObject) => {
      navigate(`/note/${e.target.id()}`);
    });

    // Link creation mode: click nodes to link
    cy.on('tap', 'node', (e: EventObject) => {
      if (!linkMode) return;
      const nodeId = e.target.id();
      if (!linkSource) {
        linkSource = nodeId;
        showToast('Now click the target note', 'info');
      } else if (linkSource !== nodeId) {
        createLink(linkSource, nodeId);
        linkSource = null;
        linkMode = false;
      }
    });
  }

  async function createLink(sourceId: string, targetId: string) {
    const existing = await db.noteLinks
      .where('sourceId').equals(sourceId)
      .and(l => l.targetId === targetId)
      .first();
    if (existing) {
      showToast('Link already exists', 'error');
      return;
    }
    const link: NoteLink = {
      id: crypto.randomUUID(),
      sourceId,
      targetId,
      created: Date.now(),
    };
    await db.noteLinks.add(link);
    showToast('Link created', 'success');
    await loadData();
  }

  async function deleteSelected() {
    if (!cy) return;
    const selectedEdges = cy.$('edge:selected');
    const selectedNodes = cy.$('node:selected');

    for (const edge of selectedEdges.toArray()) {
      await db.noteLinks.delete(edge.id());
    }
    for (const node of selectedNodes.toArray()) {
      await db.noteLinks.where('sourceId').equals(node.id()).delete();
      await db.noteLinks.where('targetId').equals(node.id()).delete();
      await db.notes.delete(node.id());
    }

    if (selectedEdges.length || selectedNodes.length) {
      showToast('Deleted selected items', 'success');
      await loadData();
    }
  }

  function zoomIn() { cy?.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: container.clientWidth / 2, y: container.clientHeight / 2 } }); }
  function zoomOut() { cy?.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: container.clientWidth / 2, y: container.clientHeight / 2 } }); }
  function fitAll() { cy?.fit(undefined, 40); }

  function toggleLinkMode() {
    linkMode = !linkMode;
    linkSource = null;
    if (linkMode) showToast('Click a source note, then a target note', 'info');
  }
</script>

<div class="knowledge-map">
  <div class="toolbar">
    <h2>Knowledge Map</h2>
    <div class="toolbar-actions">
      <button class="btn btn-secondary btn-sm" onclick={() => navigate('/note')}>+ Note</button>
      <button class="btn btn-sm" class:btn-primary={linkMode} class:btn-secondary={!linkMode} onclick={toggleLinkMode}>
        {linkMode ? '✕ Cancel Link' : '🔗 Link Notes'}
      </button>
      <button class="btn btn-danger-ghost btn-sm" onclick={deleteSelected} title="Delete selected">🗑</button>
      <span class="separator"></span>
      <button class="btn btn-ghost btn-sm" onclick={zoomOut} title="Zoom out">−</button>
      <span class="zoom-label">{Math.round(zoomLevel * 100)}%</span>
      <button class="btn btn-ghost btn-sm" onclick={zoomIn} title="Zoom in">+</button>
      <button class="btn btn-ghost btn-sm" onclick={fitAll} title="Fit all">⊞</button>
    </div>
  </div>

  <div class="canvas-wrap">
    <div class="cy-container" bind:this={container}></div>
    {#if notes.length === 0}
      <div class="empty-overlay">
        <p>No notes yet. Create notes first, then visualise their connections here.</p>
        <button class="btn btn-primary" onclick={() => navigate('/note')}>+ New Note</button>
      </div>
    {/if}
  </div>

  <div class="hint">
    Scroll to zoom · Drag nodes to rearrange · Double-click to edit · Select + 🗑 to delete
  </div>
</div>

<style>
  .knowledge-map {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: calc(100vh - 5rem);
    height: calc(100dvh - 5rem);
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .separator {
    width: 1px;
    height: 1.2rem;
    background: var(--color-border);
    margin: 0 0.2rem;
  }

  .zoom-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    min-width: 3rem;
    text-align: center;
  }

  .canvas-wrap {
    flex: 1;
    position: relative;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .cy-container {
    width: 100%;
    height: 100%;
  }

  .empty-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--color-text-secondary);
    pointer-events: none;
  }

  .empty-overlay .btn {
    pointer-events: auto;
  }

  .hint {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    text-align: center;
  }
</style>
