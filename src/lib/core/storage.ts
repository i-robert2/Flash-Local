import Dexie, { type Table } from 'dexie';
import type { Card, Deck, ReviewLog, AppSettings, Notebook, Note, NoteLink } from './types';

class FlashLocalDB extends Dexie {
  cards!: Table<Card, string>;
  decks!: Table<Deck, string>;
  reviewLogs!: Table<ReviewLog, string>;
  notebooks!: Table<Notebook, string>;
  notes!: Table<Note, string>;
  noteLinks!: Table<NoteLink, string>;

  constructor() {
    super('flashlocal');
    this.version(1).stores({
      cards: 'id, deckId, due, *tags',
      decks: 'id',
      reviewLogs: 'id, cardId, deckId, timestamp',
    });
    this.version(2).stores({
      cards: 'id, deckId, due, *tags',
      decks: 'id',
      reviewLogs: 'id, cardId, deckId, timestamp',
      notes: 'id, *tags, modified',
      noteLinks: 'id, sourceId, targetId',
    });
    this.version(3).stores({
      cards: 'id, deckId, due, *tags',
      decks: 'id',
      reviewLogs: 'id, cardId, deckId, timestamp',
      notebooks: 'id',
      notes: 'id, notebookId, parentId, depth, *tags, modified',
      noteLinks: 'id, sourceId, targetId',
    }).upgrade(tx => {
      // Migrate existing notes: assign to a default notebook
      return tx.table('notes').toCollection().modify(note => {
        if (!note.notebookId) {
          note.notebookId = '__default__';
          note.parentId = null;
          note.depth = 0;
        }
      });
    });
  }
}

export const db = new FlashLocalDB();

// ── Settings (localStorage — small, sync access) ─────────────

const SETTINGS_KEY = 'flashlocal-settings';

const DEFAULT_SETTINGS: AppSettings = {
  algorithm: 'sm2',
  theme: 'auto',
  newCardsPerDay: 20,
  reviewsPerDay: 200,
};

export function getSettings(): AppSettings {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }; }
    catch { /* fall through */ }
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ── Query helpers ─────────────────────────────────────────────

export async function getDueCards(deckId: string): Promise<Card[]> {
  const now = Date.now();
  return db.cards
    .where('deckId').equals(deckId)
    .and(c => c.due <= now && c.repetitions > 0)
    .toArray();
}

export async function getNewCards(deckId: string, limit: number): Promise<Card[]> {
  return db.cards
    .where('deckId').equals(deckId)
    .and(c => c.repetitions === 0)
    .limit(limit)
    .toArray();
}

export async function getDeckStats(deckId: string): Promise<{
  total: number; due: number; new_: number;
}> {
  const now = Date.now();
  const cards = await db.cards.where('deckId').equals(deckId).toArray();
  return {
    total: cards.length,
    due: cards.filter(c => c.due <= now && c.repetitions > 0).length,
    new_: cards.filter(c => c.repetitions === 0).length,
  };
}
