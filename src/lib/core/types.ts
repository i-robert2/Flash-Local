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

/** Human-readable label for a given hierarchy depth */
export function depthLabel(depth: number): string {
  if (depth === 0) return 'Chapter';
  if (depth === 1) return 'Sub-chapter';
  return `Sub×${depth}-chapter`;
}

const COLOR_PALETTE = {
  light: ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'],
  dark:  ['#818CF8', '#38BDF8', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6', '#2DD4BF'],
};

/** Color for a given depth, cycling through the palette */
export function depthColor(depth: number, theme: 'light' | 'dark' = 'light'): string {
  const palette = COLOR_PALETTE[theme];
  return palette[depth % palette.length];
}

export interface Notebook {
  id: string;
  name: string;
  description: string;
  created: number;
  modified: number;
}

export interface Note {
  id: string;
  notebookId: string;
  parentId: string | null;      // null = top-level (chapter)
  depth: number;
  title: string;
  content: string;              // Markdown
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
