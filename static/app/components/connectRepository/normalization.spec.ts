import {
  normalizedPathMappingSchema,
  normalizeRoot,
  resolveBranch,
  sanitizeBranch,
} from './normalization';

describe('normalizeRoot', () => {
  it('leaves an empty string empty', () => {
    expect(normalizeRoot('')).toBe('');
  });

  it('adds a trailing slash when missing', () => {
    expect(normalizeRoot('src')).toBe('src/');
  });

  it('leaves an existing trailing slash in place', () => {
    expect(normalizeRoot('src/')).toBe('src/');
  });

  it('collapses repeated slashes', () => {
    expect(normalizeRoot('src////')).toBe('src/');
    expect(normalizeRoot('src/app//')).toBe('src/app/');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeRoot('hello  ')).toBe('hello/');
    expect(normalizeRoot('  src/app  ')).toBe('src/app/');
  });

  it('treats a whitespace-only string as empty', () => {
    expect(normalizeRoot('   ')).toBe('');
  });
});

describe('resolveBranch', () => {
  it('returns the default branch for an empty string', () => {
    expect(resolveBranch('')).toBe('main');
  });

  it('replaces spaces with dashes', () => {
    expect(resolveBranch('my branch')).toBe('my-branch');
  });

  it('strips trailing dots and slashes', () => {
    expect(resolveBranch('feat/.')).toBe('feat');
  });
});

describe('sanitizeBranch', () => {
  it('replaces invalid characters with a dash', () => {
    expect(sanitizeBranch('feat@branch')).toBe('feat-branch');
  });

  it('collapses repeated slashes', () => {
    expect(sanitizeBranch('feat//branch')).toBe('feat/branch');
  });
});

describe('normalizedPathMappingSchema', () => {
  it('treats src and src/ as the same root', () => {
    const a = normalizedPathMappingSchema.parse({
      stackRoot: 'src',
      sourceRoot: '',
      branch: 'main',
    });
    const b = normalizedPathMappingSchema.parse({
      stackRoot: 'src/',
      sourceRoot: '',
      branch: 'main',
    });
    expect(a.stackRoot).toBe(b.stackRoot);
  });

  it('treats an empty branch as the default', () => {
    const result = normalizedPathMappingSchema.parse({
      stackRoot: '',
      sourceRoot: '',
      branch: '',
    });
    expect(result.branch).toBe('main');
  });
});
