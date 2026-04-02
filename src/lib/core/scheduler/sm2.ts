import { Rating, type Card } from '../types';

/**
 * SM-2 spaced repetition algorithm.
 * Maps our 4-point rating to SM-2 quality scale (0-5).
 */
function ratingToQuality(rating: Rating): number {
  switch (rating) {
    case Rating.Again: return 1;
    case Rating.Hard:  return 3;
    case Rating.Good:  return 4;
    case Rating.Easy:  return 5;
  }
}

export function scheduleSM2(card: Card, rating: Rating): Partial<Card> {
  const quality = ratingToQuality(rating);
  const now = Date.now();

  let { interval, easeFactor, repetitions, lapses } = card;

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  } else {
    // Incorrect — reset
    repetitions = 0;
    interval = 1;
    lapses++;
  }

  // Update ease factor (SM-2 formula)
  easeFactor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  if (easeFactor < 1.3) easeFactor = 1.3;

  const due = now + interval * 24 * 60 * 60 * 1000;

  return { interval, easeFactor, repetitions, lapses, due, lastReview: now };
}
