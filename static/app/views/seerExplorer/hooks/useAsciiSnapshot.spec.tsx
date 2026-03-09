import {buildResult, createGridHelpers} from './useAsciiSnapshot';

describe('buildResult whitespace trimming', () => {
  it('trims trailing spaces, strips common leading indent, and collapses blank rows', () => {
    // 10 cols x 8 rows — mostly empty space with a few text cells placed
    // to simulate a sparse page snapshot.
    const grid = createGridHelpers(8, 10);

    // Place text at column 3 on rows 1 and 5, leaving rows 0, 2-4, 6-7 blank
    // and columns 0-2 as a shared leading indent.
    grid.writeOverlay(1, 3, 'Hello');
    grid.writeOverlay(5, 3, 'World');

    // Build the naive (untrimmed) version for comparison: every row is 10
    // chars wide, all 8 rows present.
    const naiveResult = grid.grid.map(row => row.join('')).join('\n');

    const result = buildResult(grid, [], []);

    // --- Step 1: trailing spaces are removed ---
    const lines = result.split('\n');
    // Skip line 0 (the URL). Every content line should have no trailing spaces.
    for (const line of lines.slice(1)) {
      if (line.length > 0) {
        expect(line).toBe(line.trimEnd());
      }
    }

    // --- Step 2: common leading indent is stripped ---
    // Original text was at column 3, so after stripping the 3-char shared
    // indent the text should start at column 0.
    const contentLines = lines.slice(1).filter(l => l.length > 0);
    expect(contentLines.some(l => l.startsWith('Hello'))).toBe(true);
    expect(contentLines.some(l => l.startsWith('World'))).toBe(true);

    // --- Step 3: blank rows are removed entirely ---
    const blankLines = lines.slice(1).filter(l => l.length === 0);
    expect(blankLines).toHaveLength(0);

    // --- Overall size reduction ---
    // The naive grid is 8 rows * 10 chars + 7 newlines = 87 chars.
    // The trimmed result should be meaningfully smaller.
    const trimmedBody = lines.slice(1).join('\n');
    expect(trimmedBody.length).toBeLessThan(naiveResult.length);
  });
});
