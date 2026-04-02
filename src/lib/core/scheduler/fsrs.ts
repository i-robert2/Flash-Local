import { Rating, type Card } from '../types';

/**
 * FSRS v4 spaced repetition algorithm.
 * Default parameters from open-source FSRS research.
 */
const W = [
  0.4, 0.6, 2.4, 5.8,   // w0–w3: initial stability per first-rating
  4.93,                    // w4:  initial difficulty mean
  0.94,                    // w5:  initial difficulty spread
  0.86,                    // w6:  difficulty update rate
  0.01,                    // w7:  difficulty mean reversion
  1.49,                    // w8:  stability success base
  0.14,                    // w9:  stability success decay
  0.94,                    // w10: stability recall factor
  2.18,                    // w11: stability forget base
  0.05,                    // w12: stability forget difficulty
  0.34,                    // w13: stability forget stability
  1.26,                    // w14: stability forget retrievability
  0.29,                    // w15: hard penalty
  2.61,                    // w16: easy bonus
];

const REQUEST_RETENTION = 0.9;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/** FSRS uses grades 1-4 (Again=1, Hard=2, Good=3, Easy=4) */
function ratingToGrade(r: Rating): number {
  return r + 1;
}

function initStability(grade: number): number {
  return W[grade - 1];
}

function initDifficulty(grade: number): number {
  return clamp(W[4] - (grade - 3) * W[5], 1, 10);
}

/** Power-law forgetting curve */
function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/** Next interval from stability + desired retention */
function nextInterval(stability: number): number {
  return Math.max(1, Math.round(9 * stability * (1 / REQUEST_RETENTION - 1)));
}

function nextDifficulty(d: number, grade: number): number {
  const d0 = initDifficulty(3);
  return clamp(W[7] * d0 + (1 - W[7]) * (d - W[6] * (grade - 3)), 1, 10);
}

function nextStabilitySuccess(d: number, s: number, r: number, grade: number): number {
  let modifier = 1;
  if (grade === 2) modifier = W[15]; // Hard
  if (grade === 4) modifier = W[16]; // Easy

  return s * (
    Math.exp(W[8]) *
    (11 - d) *
    Math.pow(s, -W[9]) *
    (Math.exp(W[10] * (1 - r)) - 1) *
    modifier + 1
  );
}

function nextStabilityFailure(d: number, s: number, r: number): number {
  return W[11] *
    Math.pow(d, -W[12]) *
    (Math.pow(s + 1, W[13]) - 1) *
    Math.exp(W[14] * (1 - r));
}

export function scheduleFSRS(card: Card, rating: Rating): Partial<Card> {
  const grade = ratingToGrade(rating);
  const now = Date.now();

  let { stability = 0, difficulty = 0, lapses } = card;
  let newStability: number;
  let newDifficulty: number;
  let newLapses = lapses;

  const isNew = card.repetitions === 0;

  if (isNew) {
    newStability = initStability(grade);
    newDifficulty = initDifficulty(grade);
    if (grade === 1) newLapses++;
  } else {
    const elapsedDays = card.lastReview
      ? (now - card.lastReview) / (24 * 60 * 60 * 1000)
      : 0;
    const r = retrievability(elapsedDays, stability);

    newDifficulty = nextDifficulty(difficulty, grade);

    if (grade === 1) {
      newStability = nextStabilityFailure(newDifficulty, stability, r);
      newLapses++;
    } else {
      newStability = nextStabilitySuccess(newDifficulty, stability, r, grade);
    }
  }

  const interval = nextInterval(newStability);
  const due = now + interval * 24 * 60 * 60 * 1000;

  return {
    stability: newStability,
    difficulty: newDifficulty,
    interval,
    easeFactor: card.easeFactor,
    repetitions: card.repetitions + 1,
    lapses: newLapses,
    due,
    lastReview: now,
  };
}
