<script lang="ts">
  import { onMount } from 'svelte';
  import { db, getDueCards, getNewCards, getSettings } from '../core/storage';
  import { scheduleCard } from '../core/scheduler';
  import { Rating, type Card } from '../core/types';
  import { navigate, showToast, settings } from '../stores';
  import CardContent from './CardContent.svelte';
  import type { Note, Notebook } from '../core/types';
  import { depthLabel } from '../core/types';

  let { deckId }: { deckId: string } = $props();

  // Learn-more note info for current card
  let learnMoreInfo = $state<{ noteId: string; title: string; notebookName: string; notebookId: string } | null>(null);

  let cards = $state<Card[]>([]);
  let currentIndex = $state(0);
  let flipped = $state(false);
  let deckName = $state('');
  let sessionStats = $state({ reviewed: 0, correct: 0 });
  let finished = $state(false);

  let currentCard = $derived(cards[currentIndex]);

  onMount(async () => {
    const deck = await db.decks.get(deckId);
    if (!deck) {
      showToast('Deck not found', 'error');
      navigate('/');
      return;
    }
    deckName = deck.name;

    const s = getSettings();
    const dueCards = await getDueCards(deckId);
    const newCards = await getNewCards(deckId, s.newCardsPerDay);

    // Combine and shuffle
    cards = [...dueCards, ...newCards].sort(() => Math.random() - 0.5);
    if (cards.length === 0) finished = true;
  });

  async function rate(rating: Rating) {
    if (!currentCard) return;

    const algo = $settings.algorithm;
    const updates = scheduleCard(currentCard, rating, algo);

    await db.cards.update(currentCard.id, { ...updates, modified: Date.now() });
    await db.reviewLogs.add({
      id: crypto.randomUUID(),
      cardId: currentCard.id,
      deckId,
      rating,
      timestamp: Date.now(),
      interval: updates.interval ?? currentCard.interval,
      easeFactor: updates.easeFactor ?? currentCard.easeFactor,
      algorithm: algo,
    });

    sessionStats.reviewed++;
    if (rating !== Rating.Again) sessionStats.correct++;

    flipped = false;
    if (currentIndex + 1 >= cards.length) {
      finished = true;
    } else {
      currentIndex++;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (finished) return;
    if (!flipped) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipped = true; }
    } else {
      if (e.key === '1') rate(Rating.Again);
      if (e.key === '2') rate(Rating.Hard);
      if (e.key === '3') rate(Rating.Good);
      if (e.key === '4') rate(Rating.Easy);
    }
  }

  // Load learn-more info when card changes
  $effect(() => {
    const card = currentCard;
    if (card?.noteRef) {
      db.notes.get(card.noteRef).then(async (note) => {
        if (note) {
          const nb = await db.notebooks.get(note.notebookId);
          learnMoreInfo = {
            noteId: note.id,
            title: note.title,
            notebookName: nb?.name ?? 'Notebook',
            notebookId: note.notebookId,
          };
        } else {
          learnMoreInfo = null;
        }
      });
    } else {
      learnMoreInfo = null;
    }
  });

  function openLearnMore() {
    if (!learnMoreInfo) return;
    // Open in new tab so the study session is not disrupted
    const url = `${window.location.origin}${window.location.pathname}#/notebook/${learnMoreInfo.notebookId}/note/${learnMoreInfo.noteId}`;
    window.open(url, '_blank');
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="study-view">
  <div class="study-header">
    <h2>{deckName}</h2>
    <span class="progress">{currentIndex + (finished ? 0 : 1)} / {cards.length}</span>
  </div>

  {#if finished}
    <div class="finished">
      <div class="finished-icon">🎉</div>
      <h3>Session Complete!</h3>
      <p>Reviewed: {sessionStats.reviewed} cards</p>
      {#if sessionStats.reviewed > 0}
        <p>Accuracy: {Math.round((sessionStats.correct / sessionStats.reviewed) * 100)}%</p>
      {/if}
      <button class="btn btn-primary" onclick={() => navigate('/')}>Back to Decks</button>
    </div>
  {:else if currentCard}
    <div class="card-container" role="button" tabindex="0" onclick={() => { if (!flipped) flipped = true; }} onkeydown={(e) => { if (e.key === 'Enter' && !flipped) flipped = true; }}>
      <div class="card" class:flipped>
        <div class="card-face card-front">
          <CardContent content={currentCard.front} />
          <p class="tap-hint">Tap to reveal answer</p>
        </div>
        <div class="card-face card-back">
          <CardContent content={currentCard.back} />
          {#if learnMoreInfo && flipped}
            <button class="learn-more-btn" onclick={(e: MouseEvent) => { e.stopPropagation(); openLearnMore(); }}>
              📓 Learn More: {learnMoreInfo.notebookName} → {learnMoreInfo.title}
            </button>
          {/if}
        </div>
      </div>
    </div>

    {#if flipped}
      <div class="rating-buttons">
        <button class="rating-btn again" onclick={() => rate(Rating.Again)}>
          <span class="rating-label">Again</span>
          <span class="rating-key">1</span>
        </button>
        <button class="rating-btn hard" onclick={() => rate(Rating.Hard)}>
          <span class="rating-label">Hard</span>
          <span class="rating-key">2</span>
        </button>
        <button class="rating-btn good" onclick={() => rate(Rating.Good)}>
          <span class="rating-label">Good</span>
          <span class="rating-key">3</span>
        </button>
        <button class="rating-btn easy" onclick={() => rate(Rating.Easy)}>
          <span class="rating-label">Easy</span>
          <span class="rating-key">4</span>
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .study-view {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    height: calc(100vh - 8rem);
    height: calc(100dvh - 8rem);
  }

  .study-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .study-header h2 { margin: 0; font-size: 1.25rem; }
  .progress { color: var(--color-text-secondary); font-size: 0.9rem; }

  .card-container {
    flex: 1;
    perspective: 1000px;
    cursor: pointer;
    min-height: 200px;
  }

  .card {
    position: relative;
    width: 100%;
    height: 100%;
    transition: transform 0.5s;
    transform-style: preserve-3d;
  }
  .card.flipped { transform: rotateY(180deg); }

  .card-face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
  }
  .card-back { transform: rotateY(180deg); }

  .tap-hint {
    position: absolute;
    bottom: 1rem;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .learn-more-btn {
    position: absolute;
    bottom: 0.75rem;
    left: 1rem;
    right: 1rem;
    background: var(--color-surface-hover);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    color: var(--color-primary);
    font-size: 0.8rem;
    font-family: var(--font);
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .learn-more-btn:hover {
    background: var(--color-surface);
    border-color: var(--color-primary);
  }

  .rating-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    animation: slideUp 0.2s ease-out;
  }

  .rating-btn {
    border: none;
    border-radius: var(--radius);
    padding: 0.75rem 0.5rem;
    cursor: pointer;
    font-weight: 600;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    transition: opacity 0.15s, transform 0.1s;
    color: white;
    min-height: 3.5rem;
  }
  .rating-btn:active { transform: scale(0.95); }

  .rating-label { font-size: 0.9rem; }
  .rating-key  { font-size: 0.7rem; opacity: 0.7; }

  .again { background: var(--color-again); }
  .hard  { background: var(--color-hard); color: #000; }
  .good  { background: var(--color-good); }
  .easy  { background: var(--color-easy); }

  .finished {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    text-align: center;
  }
  .finished-icon { font-size: 4rem; margin-bottom: 1rem; }
  .finished h3   { margin: 0; font-size: 1.5rem; }
  .finished p    { margin: 0; color: var(--color-text-secondary); }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(1rem); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
