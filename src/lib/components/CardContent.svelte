<script lang="ts">
  import { marked } from 'marked';
  import { markedHighlight } from 'marked-highlight';
  import hljs from 'highlight.js';
  import DOMPurify from 'dompurify';

  let { content }: { content: string } = $props();

  marked.use(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code: string, lang: string) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
    }),
  );

  let html = $derived(DOMPurify.sanitize(marked.parse(content) as string));
</script>

<div class="card-content">
  {@html html}
</div>

<style>
  .card-content {
    width: 100%;
    font-size: 1.1rem;
    line-height: 1.6;
    word-break: break-word;
  }

  .card-content :global(h1),
  .card-content :global(h2),
  .card-content :global(h3) {
    margin-top: 0;
  }

  .card-content :global(pre) {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
    overflow-x: auto;
    font-size: 0.9rem;
  }

  .card-content :global(code) {
    font-family: 'Fira Code', 'Cascadia Code', monospace;
  }

  .card-content :global(code:not(pre code)) {
    background: var(--color-bg);
    padding: 0.15em 0.4em;
    border-radius: 4px;
    font-size: 0.9em;
  }

  .card-content :global(img) {
    max-width: 100%;
    border-radius: 8px;
  }

  .card-content :global(blockquote) {
    border-left: 3px solid var(--color-primary);
    margin-left: 0;
    padding-left: 1rem;
    color: var(--color-text-secondary);
  }
</style>
