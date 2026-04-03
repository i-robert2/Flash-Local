import { writable } from 'svelte/store';
import { getSettings, saveSettings } from './core/storage';
import type { AppSettings } from './core/types';

// ── Routing (hash-based — works on GitHub Pages + Tauri) ──────

export type Route =
  | { page: 'home' }
  | { page: 'study'; deckId: string }
  | { page: 'deck'; deckId: string }
  | { page: 'card'; deckId: string; cardId?: string }
  | { page: 'import' }
  | { page: 'settings' }
  | { page: 'notes' }
  | { page: 'note'; noteId?: string }
  | { page: 'knowledge-map' };

function parseHash(): Route {
  const hash = window.location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);

  if (parts[0] === 'study' && parts[1])
    return { page: 'study', deckId: parts[1] };
  if (parts[0] === 'deck' && parts[1])
    return { page: 'deck', deckId: parts[1] };
  if (parts[0] === 'card' && parts[1])
    return { page: 'card', deckId: parts[1], cardId: parts[2] };
  if (parts[0] === 'import') return { page: 'import' };
  if (parts[0] === 'settings') return { page: 'settings' };
  if (parts[0] === 'notes') return { page: 'notes' };
  if (parts[0] === 'note') return { page: 'note', noteId: parts[1] };
  if (parts[0] === 'knowledge-map') return { page: 'knowledge-map' };
  return { page: 'home' };
}

export const route = writable<Route>(parseHash());

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => route.set(parseHash()));
}

export function navigate(path: string): void {
  window.location.hash = path;
}

// ── Settings ──────────────────────────────────────────────────

export const settings = writable<AppSettings>(getSettings());

settings.subscribe(value => {
  saveSettings(value);
  applyTheme(value.theme);
});

function applyTheme(theme: AppSettings['theme']): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'auto') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

// ── Toast notifications ───────────────────────────────────────

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
export const toasts = writable<Toast[]>([]);

export function showToast(
  message: string,
  type: Toast['type'] = 'info',
): void {
  const id = ++toastId;
  toasts.update(t => [...t, { id, message, type }]);
  setTimeout(() => {
    toasts.update(t => t.filter(toast => toast.id !== id));
  }, 3000);
}
