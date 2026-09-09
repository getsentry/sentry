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

describe('buildResult location header', () => {
  it('falls back to the bare URL when no location is passed', () => {
    const grid = createGridHelpers(2, 4);
    grid.writeOverlay(0, 0, 'hi');

    const result = buildResult(grid, [], []);

    expect(result.split('\n')[0]).toBe(window.location.href);
  });

  it('leads with the full location so the reader need not parse the URL', () => {
    const grid = createGridHelpers(2, 4);
    grid.writeOverlay(0, 0, 'hi');

    const result = buildResult(grid, [], [], {
      url: 'https://sentry.io/issues/123/?statsPeriod=14d',
      name: '/issues/:groupId/',
      params: {groupId: '123'},
      query: {statsPeriod: '14d'},
    });

    expect(result).toContain('https://sentry.io/issues/123/?statsPeriod=14d');
    expect(result).toContain('Route: /issues/:groupId/');
    expect(result).toContain('Route params: {"groupId":"123"}');
    expect(result).toContain('Query params: {"statsPeriod":"14d"}');
    // Body still follows the header.
    expect(result).toContain('hi');
  });

  it('omits empty location fields rather than emitting blank lines', () => {
    const grid = createGridHelpers(2, 4);
    grid.writeOverlay(0, 0, 'hi');

    const result = buildResult(grid, [], [], {
      url: 'https://sentry.io/insights/',
      name: '',
      params: {},
      query: {},
    });

    expect(result.split('\n')[0]).toBe('https://sentry.io/insights/');
    expect(result).not.toContain('Route:');
    expect(result).not.toContain('Route params:');
    expect(result).not.toContain('Query params:');
  });
});

describe('buildResult selected projects footnotes', () => {
  it('includes the explicit project-selection instruction', () => {
    const grid = createGridHelpers(2, 4);
    grid.writeOverlay(0, 0, 'hi');

    const result = buildResult(grid, [], {
      selectionMode: 'explicit',
      isAllProjects: false,
      projectIds: ['4509062593708032'],
      projectSlugs: ['mcp-server'],
      projects: [{id: '4509062593708032', slug: 'mcp-server'}],
      instruction:
        'Page filter pins these projects — scope queries to them unless the user asks otherwise: mcp-server (id: 4509062593708032).',
    });

    expect(result).toContain(
      'Page filter pins these projects — scope queries to them unless the user asks otherwise: mcp-server (id: 4509062593708032).'
    );
  });

  it('includes the My Projects instruction when no hard project filter is set', () => {
    const grid = createGridHelpers(2, 4);
    grid.writeOverlay(0, 0, 'hi');

    const result = buildResult(grid, [], {
      selectionMode: 'my-projects',
      isAllProjects: false,
      projectIds: [],
      projectSlugs: [],
      projects: [],
      instruction:
        'Page filter is My Projects: no hard single-project pin. Scope queries to projects the user is a member of (org default). Empty projectIds/projectSlugs is expected — not missing data. Do not invent a specific project slug unless the user names one.',
    });

    expect(result).toContain('Page filter is My Projects');
    expect(result).toContain('Empty projectIds/projectSlugs is expected');
  });
});
