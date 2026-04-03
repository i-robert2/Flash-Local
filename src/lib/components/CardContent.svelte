<script lang="ts">
  import { marked } from 'marked';
  import { markedHighlight } from 'marked-highlight';
  import hljs from 'highlight.js';
  import DOMPurify from 'dompurify';

  let { content }: { content: string } = $props();

  // Allow iframes for YouTube embeds
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'iframe') {
      const src = node.getAttribute('src') || '';
      if (!src.startsWith('https://www.youtube-nocookie.com/embed/')) {
        node.remove();
      }
    }
  });

  const YOUTUBE_RE = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})(?:[&?].*)?$/;

  /** Extract YouTube video ID from a URL */
  function extractYouTubeId(url: string): string | null {
    const m = url.match(YOUTUBE_RE);
    return m ? m[1] : null;
  }

  // Custom renderer: turn bare YouTube links (on their own line) into embeds
  const youtubeExtension: marked.MarkedExtension = {
    renderer: {
      paragraph(token) {
        // token.text is the raw text of the paragraph
        const text = (token as any).text ?? '';
        const trimmed = text.trim();
        const videoId = extractYouTubeId(trimmed);
        if (videoId) {
          return `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
        }
        // Also handle markdown links wrapping a YouTube URL
        const linkMatch = trimmed.match(/^<a href="(https?:\/\/[^"]+)"[^>]*>.*?<\/a>$/);
        if (linkMatch) {
          const vid = extractYouTubeId(linkMatch[1]);
          if (vid) {
            return `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${vid}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
          }
        }
        return false; // fall back to default
      },
    },
  };

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
    youtubeExtension,
  );

  let html = $derived(DOMPurify.sanitize(marked.parse(content) as string, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'loading'],
  }));
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

  .card-content :global(.video-embed) {
    position: relative;
    padding-bottom: 56.25%; /* 16:9 */
    height: 0;
    overflow: hidden;
    border-radius: 8px;
    margin: 0.5rem 0;
  }

  .card-content :global(.video-embed iframe) {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 8px;
  }

  .card-content :global(blockquote) {
    border-left: 3px solid var(--color-primary);
    margin-left: 0;
    padding-left: 1rem;
    color: var(--color-text-secondary);
  }
</style>
