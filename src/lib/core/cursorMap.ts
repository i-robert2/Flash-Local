/**
 * Maps a click position in rendered markdown to the corresponding
 * cursor position in the raw markdown source.
 *
 * @param raw           The raw markdown string
 * @param blockIndex    Which rendered block (0-based) was clicked
 *                      (each <p>, <h1>, etc = one block)
 * @param inBlockOffset Character offset within that block's visible text
 * @returns             Cursor position in the raw markdown string
 */
export function mapRenderedToRaw(
  raw: string,
  blockIndex: number,
  inBlockOffset: number,
): number {
  // Split raw markdown into blocks separated by blank lines (\n\n+).
  // Track each block's start position in the raw string.
  const rawBlocks: { text: string; start: number }[] = [];
  const blockSplitRe = /\n\n+/g;
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = blockSplitRe.exec(raw)) !== null) {
    const blockText = raw.slice(lastEnd, match.index);
    if (hasVisibleText(blockText)) {
      rawBlocks.push({ text: blockText, start: lastEnd });
    }
    lastEnd = match.index + match[0].length;
  }
  // Last block (no trailing \n\n)
  const lastBlock = raw.slice(lastEnd);
  if (lastBlock.length > 0 && hasVisibleText(lastBlock)) {
    rawBlocks.push({ text: lastBlock, start: lastEnd });
  }

  // If no blocks found, return 0
  if (rawBlocks.length === 0) return 0;

  // Clamp block index
  const safeBlockIndex = Math.min(blockIndex, rawBlocks.length - 1);
  const targetBlock = rawBlocks[safeBlockIndex];

  // Map the in-block offset (in visible text) to raw offset (in block text)
  const rawInBlockOffset = mapVisibleToRaw(targetBlock.text, inBlockOffset);

  return targetBlock.start + rawInBlockOffset;
}

/**
 * Check if a raw markdown block has any visible text
 * (i.e. it's not just an image or empty)
 */
function hasVisibleText(blockText: string): boolean {
  // Remove image syntax and check if anything remains
  const stripped = blockText.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
  return stripped.length > 0;
}

/**
 * Map a character offset in visible/rendered text to the corresponding
 * position in raw markdown within a single block.
 * Skips over image markdown syntax `![...](...)`.
 */
function mapVisibleToRaw(blockText: string, visibleOffset: number): number {
  // Collect image syntax ranges to skip
  const imgRe = /!\[[^\]]*\]\([^)]*\)/g;
  const skipRanges: [number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(blockText)) !== null) {
    skipRanges.push([m.index, m.index + m[0].length]);
  }

  let rawIdx = 0;
  let visibleCount = 0;

  while (rawIdx < blockText.length && visibleCount < visibleOffset) {
    // Check if current position is inside an image syntax range — skip past it
    const skip = skipRanges.find(([s, e]) => rawIdx >= s && rawIdx < e);
    if (skip) {
      rawIdx = skip[1]; // jump past it
      continue;
    }
    visibleCount++;
    rawIdx++;
  }

  // After counting, we may have landed at the start of an image — skip past it
  const finalSkip = skipRanges.find(([s, e]) => rawIdx >= s && rawIdx < e);
  if (finalSkip) {
    rawIdx = finalSkip[1];
  }

  return rawIdx;
}
