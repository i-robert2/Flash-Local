/** Card difficulty ratings used during review */
export enum Rating {
  Again = 0,
  Hard = 1,
  Good = 2,
  Easy = 3,
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  tags: string[];
  created: number;
  modified: number;
  /** Unix timestamp ms — when the card is next due */
  due: number;
  /** Interval in days */
  interval: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  /** FSRS stability */
  stability?: number;
  /** FSRS difficulty (1-10) */
  difficulty?: number;
  lastReview?: number;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  created: number;
  modified: number;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  deckId: string;
  rating: Rating;
  timestamp: number;
  interval: number;
  easeFactor: number;
  algorithm: 'sm2' | 'fsrs';
}

export interface AppSettings {
  algorithm: 'sm2' | 'fsrs';
  theme: 'light' | 'dark' | 'auto';
  newCardsPerDay: number;
  reviewsPerDay: number;
}

// ── .flashlocal portable file format ──────────────────────────

export interface FlashLocalFile {
  version: 1;
  app: 'FlashLocal';
  exportedAt: string;
  decks: FlashLocalDeck[];
  settings?: Partial<AppSettings>;
}

export interface FlashLocalDeck {
  id: string;
  name: string;
  description: string;
  created: string;
  modified: string;
  cards: FlashLocalCard[];
}

export interface FlashLocalCard {
  id: string;
  front: string;
  back: string;
  tags: string[];
  created: string;
  modified: string;
  review: {
    due: string;
    interval: number;
    easeFactor: number;
    repetitions: number;
    lapses: number;
    stability?: number;
    difficulty?: number;
    lastReview?: string | null;
  };
}

// ── Notes & Knowledge Maps ────────────────────────────────────

export interface Note {
  id: string;
  title: string;
  content: string;             // Markdown
  tags: string[];
  created: number;
  modified: number;
  /** Position on the knowledge map canvas */
  mapX?: number;
  mapY?: number;
}

export interface NoteLink {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  created: number;
}
