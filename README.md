# FlashLocal

An offline-first spaced repetition flashcard app. Runs as a PWA (browser) or desktop app (Tauri).

![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?logo=tauri&logoColor=white)

---

## Features

- **Spaced repetition** — SM-2 (classic) and FSRS v4 (modern), user-selectable
- **Fully offline** — IndexedDB storage with PWA service worker
- **Markdown cards** — with syntax highlighting, images, and code blocks
- **Notebooks & notes** — chapter-tree structured note-taking alongside flashcards
- **Import/export** — `.flashlocal` (native), JSON, CSV/TSV
- **Knowledge map** — visual overview of your decks
- **Global search** — find cards and notes across all decks
- **Desktop app** — optional Tauri 2 build for Windows/macOS/Linux

---

## Getting Started

```bash
npm install
npm run dev
```

For the desktop build (requires Rust toolchain):

```bash
npm run tauri dev
```

---

## License

MIT

---

## Disclaimer

This project was built with AI assistance (GitHub Copilot).
