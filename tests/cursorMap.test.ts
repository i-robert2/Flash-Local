import { mapRenderedToRaw } from '../src/lib/core/cursorMap';

/**
 * Test helper: given raw markdown, simulate what the browser renders
 * and verify mapRenderedToRaw returns the expected raw position.
 *
 * Convention:
 *   We describe the click as (blockIndex, inBlockOffset)
 *   blockIndex = which <p> element (0-based) in the rendered HTML
 *   inBlockOffset = character offset within that <p>'s textContent
 */

interface TestCase {
  name: string;
  raw: string;
  blockIndex: number;
  inBlockOffset: number;
  expectedRawOffset: number;
}

const tests: TestCase[] = [
  // ─── Basic single paragraph ───────────────────────
  {
    name: 'Single word, click at start',
    raw: 'hello',
    blockIndex: 0,
    inBlockOffset: 0,
    expectedRawOffset: 0,
  },
  {
    name: 'Single word, click at end',
    raw: 'hello',
    blockIndex: 0,
    inBlockOffset: 5,
    expectedRawOffset: 5,
  },
  {
    name: 'Single word, click in middle',
    raw: 'hello',
    blockIndex: 0,
    inBlockOffset: 3,
    expectedRawOffset: 3,
  },

  // ─── Two paragraphs, same word ────────────────────
  {
    name: 'Two "test" paragraphs, click start of 1st',
    raw: 'test\n\ntest',
    blockIndex: 0,
    inBlockOffset: 0,
    expectedRawOffset: 0,  // start of first "test"
  },
  {
    name: 'Two "test" paragraphs, click end of 1st',
    raw: 'test\n\ntest',
    blockIndex: 0,
    inBlockOffset: 4,
    expectedRawOffset: 4,  // end of first "test"
  },
  {
    name: 'Two "test" paragraphs, click start of 2nd',
    raw: 'test\n\ntest',
    blockIndex: 1,
    inBlockOffset: 0,
    expectedRawOffset: 6,  // start of second "test"
  },
  {
    name: 'Two "test" paragraphs, click end of 2nd',
    raw: 'test\n\ntest',
    blockIndex: 1,
    inBlockOffset: 4,
    expectedRawOffset: 10, // end of second "test"
  },

  // ─── Multiple paragraphs with different words ─────
  {
    name: 'Three paragraphs, click middle of 2nd',
    raw: 'alpha\n\nbeta\n\ngamma',
    blockIndex: 1,
    inBlockOffset: 2,
    expectedRawOffset: 9,  // "be|ta" → position 7 (start of beta) + 2
  },
  {
    name: 'Three paragraphs, click start of 3rd',
    raw: 'alpha\n\nbeta\n\ngamma',
    blockIndex: 2,
    inBlockOffset: 0,
    expectedRawOffset: 13, // start of "gamma"
  },

  // ─── With extra blank lines ───────────────────────
  {
    name: 'Triple newline separator',
    raw: 'test\n\n\ntest',
    blockIndex: 1,
    inBlockOffset: 0,
    expectedRawOffset: 7,  // start of second "test"
  },
  {
    name: 'Quadruple newline separator',
    raw: 'test\n\n\n\ntest',
    blockIndex: 1,
    inBlockOffset: 2,
    expectedRawOffset: 10, // "te|st" in second paragraph
  },

  // ─── Many duplicate "test" paragraphs ─────────────
  {
    name: 'Four "test" blocks, click start of 3rd',
    raw: 'test\n\ntest\n\ntest\n\ntest',
    blockIndex: 2,
    inBlockOffset: 0,
    expectedRawOffset: 12, // start of third "test"
  },
  {
    name: 'Four "test" blocks, click end of 3rd',
    raw: 'test\n\ntest\n\ntest\n\ntest',
    blockIndex: 2,
    inBlockOffset: 4,
    expectedRawOffset: 16, // end of third "test"
  },
  {
    name: 'Four "test" blocks, click middle of 4th',
    raw: 'test\n\ntest\n\ntest\n\ntest',
    blockIndex: 3,
    inBlockOffset: 2,
    expectedRawOffset: 20, // "te|st" in 4th
  },

  // ─── Mixed content with unique words ──────────────
  {
    name: 'Mixed: test, apa test, alt, test, ce, test, test — click "ce"',
    raw: 'test\n\napa\ntest\n\nalt\n\ntest\n\nce\n\ntest\n\ntest',
    blockIndex: 4,
    inBlockOffset: 0,
    expectedRawOffset: 27, // start of "ce"
  },
  {
    name: 'Mixed: click end of "ce"',
    raw: 'test\n\napa\ntest\n\nalt\n\ntest\n\nce\n\ntest\n\ntest',
    blockIndex: 4,
    inBlockOffset: 2,
    expectedRawOffset: 29, // end of "ce"
  },

  // ─── With embedded images ─────────────────────────
  {
    name: 'Text before image, click on text',
    raw: 'hello\n\n![img](data:image/png;base64,abc123)\n\nworld',
    blockIndex: 0,
    inBlockOffset: 3,
    expectedRawOffset: 3,  // "hel|lo"
  },
  {
    name: 'Text after image, click on text',
    raw: 'hello\n\n![img](data:image/png;base64,abc123)\n\nworld',
    // The image-only block is skipped, so "world" is block index 1
    blockIndex: 1,
    inBlockOffset: 0,
    expectedRawOffset: 45, // start of "world"
  },
  {
    name: 'Text after image, click end of text',
    raw: 'hello\n\n![img](data:image/png;base64,abc123)\n\nworld',
    blockIndex: 1,
    inBlockOffset: 5,
    expectedRawOffset: 50, // end of "world"
  },

  // ─── Image inline with text in same paragraph ─────
  {
    name: 'Inline image in paragraph, click after image',
    raw: 'before![img](data:x)after',
    blockIndex: 0,
    inBlockOffset: 6,  // "before" = 6 visible chars, then "after" starts
    expectedRawOffset: 20, // skip past ![img](data:x)
  },

  // ─── Block index out of range (clamped) ───────────
  {
    name: 'Block index beyond end, should clamp to last',
    raw: 'first\n\nsecond',
    blockIndex: 99,
    inBlockOffset: 3,
    expectedRawOffset: 10, // "sec|ond" → 7 + 3
  },

  // ─── Empty/edge cases ─────────────────────────────
  {
    name: 'Empty string',
    raw: '',
    blockIndex: 0,
    inBlockOffset: 0,
    expectedRawOffset: 0,
  },
  {
    name: 'Single char, click at end',
    raw: 'a',
    blockIndex: 0,
    inBlockOffset: 1,
    expectedRawOffset: 1,
  },
];

// ─── Run tests ──────────────────────────────────────────────

let passed = 0;
let failed = 0;

for (const t of tests) {
  const result = mapRenderedToRaw(t.raw, t.blockIndex, t.inBlockOffset);
  if (result === t.expectedRawOffset) {
    passed++;
    console.log(`  ✓ ${t.name}`);
  } else {
    failed++;
    console.error(`  ✗ ${t.name}`);
    console.error(`    raw: ${JSON.stringify(t.raw)}`);
    console.error(`    blockIndex=${t.blockIndex}, inBlockOffset=${t.inBlockOffset}`);
    console.error(`    expected=${t.expectedRawOffset}, got=${result}`);
    // Show what character is at each position
    if (t.expectedRawOffset <= t.raw.length) {
      console.error(`    expected char: ${JSON.stringify(t.raw.slice(t.expectedRawOffset, t.expectedRawOffset + 5))}`);
    }
    if (result <= t.raw.length) {
      console.error(`    actual char:   ${JSON.stringify(t.raw.slice(result, result + 5))}`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests`);
if (failed > 0) process.exit(1);
