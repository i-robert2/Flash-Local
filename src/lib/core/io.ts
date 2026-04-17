import { db } from './storage';
import type { Card, Deck, FlashLocalFile, FlashLocalDeck, FlashLocalCard } from './types';

// ── Helpers ───────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function newCard(
  deckId: string,
  front: string,
  back: string,
  tags: string[] = [],
): Card {
  const now = Date.now();
  return {
    id: generateId(),
    deckId,
    front,
    back,
    tags,
    created: now,
    modified: now,
    due: now,
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    lapses: 0,
  };
}

// ── Export ─────────────────────────────────────────────────────

function cardToExport(card: Card): FlashLocalCard {
  return {
    id: card.id,
    front: card.front,
    back: card.back,
    tags: card.tags,
    created: new Date(card.created).toISOString(),
    modified: new Date(card.modified).toISOString(),
    review: {
      due: new Date(card.due).toISOString(),
      interval: card.interval,
      easeFactor: card.easeFactor,
      repetitions: card.repetitions,
      lapses: card.lapses,
      stability: card.stability,
      difficulty: card.difficulty,
      lastReview: card.lastReview
        ? new Date(card.lastReview).toISOString()
        : null,
    },
  };
}

export async function exportDecks(deckIds: string[]): Promise<FlashLocalFile> {
  const decks: FlashLocalDeck[] = [];

  for (const deckId of deckIds) {
    const deck = await db.decks.get(deckId);
    if (!deck) continue;

    const cards = await db.cards.where('deckId').equals(deckId).toArray();

    decks.push({
      id: deck.id,
      name: deck.name,
      description: deck.description,
      created: new Date(deck.created).toISOString(),
      modified: new Date(deck.modified).toISOString(),
      cards: cards.map(cardToExport),
    });
  }

  return {
    version: 1,
    app: 'FlashLocal',
    exportedAt: new Date().toISOString(),
    decks,
  };
}

// ── Import .flashlocal ────────────────────────────────────────

export async function importFlashLocal(
  file: FlashLocalFile,
): Promise<{ decks: number; cards: number }> {
  let deckCount = 0;
  let cardCount = 0;

  for (const ed of file.decks) {
    const deck: Deck = {
      id: generateId(),
      name: ed.name,
      description: ed.description,
      created: new Date(ed.created).getTime(),
      modified: Date.now(),
    };

    await db.decks.add(deck);
    deckCount++;

    const cards: Card[] = ed.cards.map(ec => ({
      id: generateId(),
      deckId: deck.id,
      front: ec.front,
      back: ec.back,
      tags: ec.tags,
      created: new Date(ec.created).getTime(),
      modified: Date.now(),
      due: new Date(ec.review.due).getTime(),
      interval: ec.review.interval,
      easeFactor: ec.review.easeFactor,
      repetitions: ec.review.repetitions,
      lapses: ec.review.lapses,
      // FSRS fields: default to neutral starting values so the scheduler
      // doesn't treat missing data as 0 (which breaks the algorithm).
      stability: ec.review.stability ?? 0.5,
      difficulty: ec.review.difficulty ?? 5,
      lastReview: ec.review.lastReview
        ? new Date(ec.review.lastReview).getTime()
        : undefined,
    }));

    try {
      await db.cards.bulkAdd(cards);
    } catch (err: any) {
      throw new Error(`Failed to import cards for deck "${deck.name}": ${err?.message ?? err}`);
    }
    cardCount += cards.length;
  }

  return { decks: deckCount, cards: cardCount };
}

// ── Import CSV / TSV ──────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export async function importCSV(
  text: string,
  deckName: string,
): Promise<{ deckId: string; cards: number }> {
  const lines = text.trim().split('\n');
  if (lines.length === 0) throw new Error('Empty file');

  const separator = lines[0].includes('\t') ? '\t' : ',';

  // Skip header row if detected
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes('front') || first.includes('question');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const deck: Deck = {
    id: generateId(),
    name: deckName,
    description: '',
    created: Date.now(),
    modified: Date.now(),
  };
  await db.decks.add(deck);

  const cards: Card[] = [];
  for (const line of dataLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts =
      separator === ',' ? parseCSVLine(trimmed) : trimmed.split('\t');

    if (parts.length >= 2) {
      cards.push(
        newCard(
          deck.id,
          parts[0].trim(),
          parts[1].trim(),
          parts.slice(2).map(t => t.trim()).filter(Boolean),
        ),
      );
    }
  }

  if (cards.length > 0) await db.cards.bulkAdd(cards);
  return { deckId: deck.id, cards: cards.length };
}

// ── Import JSON ───────────────────────────────────────────────

export async function importJSON(
  text: string,
  deckName: string,
): Promise<{ deckId: string; cards: number }> {
  const data = JSON.parse(text);

  // Detect FlashLocal native format
  if (data.app === 'FlashLocal' && data.version) {
    const result = await importFlashLocal(data as FlashLocalFile);
    return { deckId: '', cards: result.cards };
  }

  const items: Array<{ front: string; back: string; tags?: string[] }> =
    Array.isArray(data) ? data : data.cards || [];

  if (items.length === 0) throw new Error('No cards found in JSON');

  const deck: Deck = {
    id: generateId(),
    name: deckName || data.name || 'Imported Deck',
    description: data.description || '',
    created: Date.now(),
    modified: Date.now(),
  };
  await db.decks.add(deck);

  const cards: Card[] = items.map(item =>
    newCard(deck.id, item.front, item.back, item.tags || []),
  );
  await db.cards.bulkAdd(cards);

  return { deckId: deck.id, cards: cards.length };
}

// ── Download helper ───────────────────────────────────────────

export function downloadFile(
  content: string,
  filename: string,
  type = 'application/json',
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { newCard, generateId };
