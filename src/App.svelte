<script lang="ts">
  import { route, toasts } from './lib/stores';
  import DeckList from './lib/components/DeckList.svelte';
  import StudyView from './lib/components/StudyView.svelte';
  import DeckEditor from './lib/components/DeckEditor.svelte';
  import CardEditor from './lib/components/CardEditor.svelte';
  import ImportExport from './lib/components/ImportExport.svelte';
  import Settings from './lib/components/Settings.svelte';
  import Header from './lib/components/Header.svelte';
  import Toast from './lib/components/Toast.svelte';
  import NotebookList from './lib/components/NotebookList.svelte';
  import NotebookSidebar from './lib/components/NotebookSidebar.svelte';
  import NoteList from './lib/components/NoteList.svelte';
  import NoteEditor from './lib/components/NoteEditor.svelte';
  import NoteView from './lib/components/NoteView.svelte';
  import KnowledgeMap from './lib/components/KnowledgeMap.svelte';

  // Get the notebookId from notebook-scoped routes
  let activeNotebookId = $derived(
    $route.page === 'notebook' ? $route.notebookId :
    $route.page === 'note' ? $route.notebookId :
    $route.page === 'note-view' ? $route.notebookId :
    $route.page === 'knowledge-map' ? $route.notebookId :
    ''
  );

  let hasNotebookSidebar = $derived(!!activeNotebookId);
  let sidebarOpen = $state(false);

  // Close sidebar on route change (mobile)
  $effect(() => {
    $route; // subscribe
    sidebarOpen = false;
  });
</script>

<div class="app">
  <Header />

  {#if hasNotebookSidebar}
    <div class="notebook-layout">
      <div class="sidebar-wrap" class:sidebar-open={sidebarOpen}>
        <NotebookSidebar notebookId={activeNotebookId} />
      </div>
      {#if sidebarOpen}
        <button class="sidebar-backdrop" onclick={() => sidebarOpen = false} aria-label="Close sidebar"></button>
      {/if}
      <main class="main notebook-main" class:main-full={$route.page === 'knowledge-map'}>
        <button class="mobile-sidebar-toggle btn btn-ghost btn-sm" onclick={() => sidebarOpen = !sidebarOpen}>
          ☰
        </button>
        {#if $route.page === 'notebook'}
          <NoteList notebookId={$route.notebookId} />
        {:else if $route.page === 'note'}
          <NoteEditor notebookId={$route.notebookId} noteId={$route.noteId} />
        {:else if $route.page === 'note-view'}
          <NoteView noteId={$route.noteId} />
        {:else if $route.page === 'knowledge-map'}
          <KnowledgeMap notebookId={$route.notebookId} />
        {/if}
      </main>
    </div>
  {:else}
    <main class="main">
      {#if $route.page === 'home'}
        <DeckList />
      {:else if $route.page === 'study'}
        <StudyView deckId={$route.deckId} />
      {:else if $route.page === 'deck'}
        <DeckEditor deckId={$route.deckId} />
      {:else if $route.page === 'card'}
        <CardEditor deckId={$route.deckId} cardId={$route.cardId} />
      {:else if $route.page === 'import'}
        <ImportExport />
      {:else if $route.page === 'settings'}
        <Settings />
      {:else if $route.page === 'notebooks'}
        <NotebookList />
      {/if}
    </main>
  {/if}

  {#if $toasts.length > 0}
    <div class="toast-container">
      {#each $toasts as toast (toast.id)}
        <Toast {toast} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
  }

  .main {
    flex: 1;
    padding: 1rem;
    max-width: 48rem;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }

  .main-full {
    max-width: 100%;
  }

  .notebook-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .sidebar-wrap {
    flex-shrink: 0;
  }

  .sidebar-backdrop {
    display: none;
  }

  .mobile-sidebar-toggle {
    display: none;
  }

  .notebook-main {
    flex: 1;
    overflow-y: auto;
    margin: 0;
    max-width: none;
  }

  /* ── Mobile: sidebar becomes slide-over drawer ── */
  @media (max-width: 640px) {
    .sidebar-wrap {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 200;
      transform: translateX(-100%);
      transition: transform 0.25s ease;
    }

    .sidebar-wrap.sidebar-open {
      transform: translateX(0);
    }

    .sidebar-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 199;
      background: rgba(0, 0, 0, 0.4);
      border: none;
      cursor: pointer;
    }

    .mobile-sidebar-toggle {
      display: inline-flex;
      position: sticky;
      top: 0;
      z-index: 10;
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
    }

    .main {
      padding: 0.75rem;
    }
  }

  .toast-container {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
