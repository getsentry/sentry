import {
  filterPaths,
  globToRegExp,
  grepCandidates,
  parseGrepCommand,
  planPreview,
  seededShuffle,
} from 'sentry/views/codeConventions/filterPreview';

describe('globToRegExp', () => {
  it('spans directories with ** and stays within one with *', () => {
    const re = globToRegExp('static/**/*.tsx', {dot: false});
    expect(re.test('static/app/a.tsx')).toBe(true);
    expect(re.test('static/a.tsx')).toBe(true);
    expect(re.test('static/app/a.ts')).toBe(false);
    expect(globToRegExp('static/*.tsx', {dot: false}).test('static/app/a.tsx')).toBe(
      false
    );
  });

  it('skips dot segments unless dot is set', () => {
    expect(globToRegExp('**/*.ts', {dot: false}).test('.github/a.ts')).toBe(false);
    expect(globToRegExp('**/*.ts', {dot: true}).test('.github/a.ts')).toBe(true);
  });

  it('expands braces', () => {
    const re = globToRegExp('**/*.{ts,tsx}', {dot: false});
    expect(re.test('a/b.ts')).toBe(true);
    expect(re.test('a/b.tsx')).toBe(true);
    expect(re.test('a/b.js')).toBe(false);
  });
});

describe('filterPaths', () => {
  const paths = [
    'static/app/a.tsx',
    'static/app/a.spec.tsx',
    'static/app/__fixtures__/b.tsx',
    'static/gsAdmin/c.tsx',
    'src/d.py',
  ];

  it('applies include and exclude globs', () => {
    expect(
      filterPaths(paths, ['static/**/*.tsx'], ['**/*.spec.*', '**/__fixtures__/**'])
    ).toEqual(['static/app/a.tsx', 'static/gsAdmin/c.tsx']);
  });

  it('treats !-prefixed includes as excludes and prunes literal directories', () => {
    expect(
      filterPaths(paths, ['static/**/*.tsx', '!**/*.spec.*'], ['static/gsAdmin'])
    ).toEqual(['static/app/a.tsx', 'static/app/__fixtures__/b.tsx']);
  });
});

describe('parseGrepCommand', () => {
  it('parses an extended pattern with includes and repo paths', () => {
    const result = parseGrepCommand(
      "grep -rl --include='*.tsx' --include='*.ts' -E 'extends (React\\.)?(Pure)?Component' {repo_path}/static/"
    );
    if (!result.ok) {
      throw new Error(result.reason);
    }
    expect(result.grep.includes).toEqual(['*.tsx', '*.ts']);
    expect(result.grep.paths).toEqual(['static']);
    expect(result.grep.regex.test('class A extends React.PureComponent<P> {}')).toBe(
      true
    );
    expect(result.grep.regex.test('class A extends Base {}')).toBe(false);
  });

  it('accepts options after the pattern and POSIX character classes', () => {
    const result = parseGrepCommand(
      "grep -rlE '^[[:space:]]*(export )?function render[A-Z]' --include='*.spec.tsx' {repo_path}/static/"
    );
    if (!result.ok) {
      throw new Error(result.reason);
    }
    expect(
      result.grep.regex.test('const x = 1;\n  export function renderComponent() {}')
    ).toBe(true);
    expect(result.grep.regex.test('const renderComponent = 1;')).toBe(false);
  });

  it('treats parentheses as literals in basic regular expressions', () => {
    const result = parseGrepCommand("grep -rl 'api.request(' {repo_path}");
    if (!result.ok) {
      throw new Error(result.reason);
    }
    expect(result.grep.paths).toEqual(['']);
    expect(result.grep.regex.test('this.api.request(url)')).toBe(true);
  });

  it('rejects pipelines and unknown options', () => {
    expect(parseGrepCommand("grep -rl 'a' . | xargs grep 'b'").ok).toBe(false);
    expect(parseGrepCommand("grep -P 'a' .").ok).toBe(false);
    expect(parseGrepCommand("rg 'a' .").ok).toBe(false);
  });
});

describe('grepCandidates', () => {
  it('limits files to the search paths and --include base names', () => {
    const result = parseGrepCommand(
      "grep -rl --include='*.ts' --exclude-dir=node_modules 'x' {repo_path}/static/app/"
    );
    if (!result.ok) {
      throw new Error(result.reason);
    }
    expect(
      grepCandidates(
        [
          'static/app/a.ts',
          'static/app/a.tsx',
          'static/gsApp/b.ts',
          'static/app/node_modules/c.ts',
        ],
        result.grep
      )
    ).toEqual(['static/app/a.ts']);
  });
});

describe('planPreview', () => {
  it('uses the default extensions when there is no prefilter or include', () => {
    const plan = planPreview(['a.ts', 'b.py', 'c/d.jsx'], {exclude: ['c/**']});
    expect(plan).toEqual({kind: 'glob', candidates: ['a.ts']});
  });

  it('cannot preview a detect_command', () => {
    expect(planPreview(['a.ts'], {detect_command: 'bash detect.sh'}).kind).toBe(
      'unsupported'
    );
  });
});

describe('seededShuffle', () => {
  it('returns the same order for the same seed', () => {
    const items = Array.from({length: 20}, (_, i) => i);
    expect(seededShuffle(items, 'a')).toEqual(seededShuffle(items, 'a'));
    expect(seededShuffle(items, 'a')).not.toEqual(items);
    expect([...seededShuffle(items, 'a')].sort((x, y) => x - y)).toEqual(items);
  });
});
