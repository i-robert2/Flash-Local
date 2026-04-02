import type { Card, AppSettings } from '../types';
import { Rating } from '../types';
import { scheduleSM2 } from './sm2';
import { scheduleFSRS } from './fsrs';

export function scheduleCard(
  card: Card,
  rating: Rating,
  algorithm: AppSettings['algorithm'],
): Partial<Card> {
  return algorithm === 'fsrs'
    ? scheduleFSRS(card, rating)
    : scheduleSM2(card, rating);
}

export { Rating };
