/**
 * Browser approximations of how @sentry/refactor-tasks picks the files a
 * convention scans: include/exclude globs with fast-glob's rules, narrowed by a
 * `grep` prefilter. There's no checkout or shell here, so globs run against the
 * repo's git tree and grep runs against file contents fetched from GitHub.
 */

export interface ConventionFilters {
  detect_command?: string;
  exclude?: string[];
  include?: string[];
  prefilter?: string;
}

// The extensions the scanner walks when a convention has no include globs.
const DEFAULT_INCLUDE = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];

const GLOB_CHARS = /[*?[\]{}]/;

function expandBraces(pattern: string): string[] {
  const match = /\{([^{}]*,[^{}]*)\}/.exec(pattern);
  if (!match) {
    return [pattern];
  }
  const before = pattern.slice(0, match.index);
  const after = pattern.slice(match.index + match[0].length);
  return match[1]!
    .split(',')
    .flatMap(option => expandBraces(`${before}${option}${after}`));
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * Converts a glob to a RegExp with micromatch's semantics for the forms the
 * conventions use: `**` spans directories, `*` and `?` stay within one, and
 * unless `dot` is set, wildcards don't match a segment that starts with `.`.
 */
export function globToRegExp(glob: string, {dot}: {dot: boolean}): RegExp {
  const segment = dot ? '[^/]*' : '(?!\\.)[^/]*';
  const alternatives = expandBraces(glob).map(pattern => {
    let source = '';
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i]!;
      const atSegmentStart = i === 0 || pattern[i - 1] === '/';
      if (char === '*' && pattern[i + 1] === '*') {
        const isWholeSegment =
          atSegmentStart && (i + 2 === pattern.length || pattern[i + 2] === '/');
        if (isWholeSegment) {
          if (pattern[i + 2] === '/') {
            source += `(?:${segment}/)*`;
            i += 2;
          } else {
            source += `(?:${segment})(?:/${segment})*`;
            i += 1;
          }
          continue;
        }
        i += 1;
      }
      if (char === '*') {
        source += atSegmentStart ? segment : '[^/]*';
      } else if (char === '?') {
        source += atSegmentStart && !dot ? '(?!\\.)[^/]' : '[^/]';
      } else if (char === '[') {
        const end = pattern.indexOf(']', i + 1);
        if (end === -1) {
          source += '\\[';
        } else {
          source += pattern.slice(i, end + 1).replace('[!', '[^');
          i = end;
        }
      } else {
        source += escapeRegExp(char);
      }
    }
    return source;
  });
  return new RegExp(`^(?:${alternatives.join('|')})/?$`);
}

function compile(patterns: string[], dot: boolean) {
  const regexes = patterns.map(pattern => globToRegExp(pattern, {dot}));
  return (path: string) => regexes.some(re => re.test(path));
}

// fast-glob stops descending into a directory matched by an exclude ending in
// `/**` or naming a literal final segment, which drops everything beneath it.
function prunesDirectories(pattern: string) {
  const basename = pattern.split('/').pop() ?? '';
  return pattern.endsWith('/**') || !GLOB_CHARS.test(basename);
}

function parentDirectories(path: string) {
  const segments = path.split('/');
  return segments.slice(1).map((_, i) => segments.slice(0, i + 1).join('/'));
}

/**
 * Keeps repo-relative paths that pass the include/exclude globs. Includes skip
 * dotfiles, excludes don't, `!`-prefixed includes act as excludes, and an
 * excluded directory drops everything beneath it.
 */
export function filterPaths(paths: string[], include?: string[], exclude?: string[]) {
  const positive = (include ?? []).filter(pattern => !pattern.startsWith('!'));
  const negative = [
    ...(exclude ?? []),
    ...(include ?? []).filter(pattern => pattern.startsWith('!')).map(p => p.slice(1)),
  ];
  const isIncluded = compile(positive, false);
  const isExcluded = compile(negative, true);
  const isExcludedDirectory = compile(negative.filter(prunesDirectories), false);

  return paths.filter(
    path =>
      (positive.length === 0 || isIncluded(path)) &&
      !isExcluded(path) &&
      !parentDirectories(path).some(isExcludedDirectory)
  );
}

export interface GrepCommand {
  /**
   * Globs matched against directory names, like grep's `--exclude-dir`.
   */
  excludeDirs: string[];
  /**
   * Globs matched against a file's base name, like grep's `--exclude`.
   */
  excludes: string[];
  /**
   * Globs matched against a file's base name, like grep's `--include`.
   */
  includes: string[];
  /**
   * Repo-relative search roots. An empty string is the repo root.
   */
  paths: string[];
  regex: RegExp;
}

type ParseResult = {grep: GrepCommand; ok: true} | {ok: false; reason: string};

/**
 * Splits a command into words with POSIX shell quoting. Returns null if the
 * command does anything beyond a single invocation (pipes, redirects, etc).
 */
function tokenize(command: string): string[] | null {
  const words: string[] = [];
  let current: string | null = null;
  for (let i = 0; i < command.length; i++) {
    const char = command[i]!;
    if (char === "'") {
      const end = command.indexOf("'", i + 1);
      if (end === -1) {
        return null;
      }
      current = (current ?? '') + command.slice(i + 1, end);
      i = end;
    } else if (char === '"') {
      current = current ?? '';
      i++;
      for (; i < command.length && command[i] !== '"'; i++) {
        if (command[i] === '\\' && /["\\$`]/.test(command[i + 1] ?? '')) {
          i++;
        } else if (command[i] === '$' || command[i] === '`') {
          return null;
        }
        current += command[i];
      }
      if (i >= command.length) {
        return null;
      }
    } else if (char === '\\') {
      current = (current ?? '') + (command[i + 1] ?? '');
      i++;
    } else if (/\s/.test(char)) {
      if (current !== null) {
        words.push(current);
        current = null;
      }
    } else if (/[|&;<>()$`]/.test(char)) {
      return null;
    } else {
      current = (current ?? '') + char;
    }
  }
  if (current !== null) {
    words.push(current);
  }
  return words;
}

const POSIX_CLASSES: Record<string, string> = {
  alnum: 'a-zA-Z0-9',
  alpha: 'a-zA-Z',
  blank: ' \\t',
  digit: '0-9',
  lower: 'a-z',
  punct: '!-\\/:-@\\[-`{-~',
  space: '\\s',
  upper: 'A-Z',
  xdigit: '0-9A-Fa-f',
};

/**
 * Translates a grep basic regular expression, where `(`, `|`, `{`, `+` and
 * `?` are literal unless escaped, to the extended syntax JS understands.
 */
function basicToExtended(pattern: string) {
  let result = '';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]!;
    const next = pattern[i + 1];
    if (char === '\\' && next !== undefined && '(){}|+?'.includes(next)) {
      result += next;
      i++;
    } else if (char === '\\' && next !== undefined) {
      result += char + next;
      i++;
    } else if ('(){}|+?'.includes(char)) {
      result += `\\${char}`;
    } else {
      result += char;
    }
  }
  return result;
}

function toJsRegExpSource(
  pattern: string,
  mode: 'basic' | 'extended' | 'fixed',
  wholeWord: boolean
) {
  let source =
    mode === 'fixed'
      ? escapeRegExp(pattern)
      : (mode === 'basic' ? basicToExtended(pattern) : pattern).replace(
          /\[:(\w+):\]/g,
          (whole, name: string) => POSIX_CLASSES[name] ?? whole
        );
  if (wholeWord) {
    source = `\\b(?:${source})\\b`;
  }
  return source;
}

// Flags that only change grep's output format, which doesn't matter here.
const OUTPUT_FLAGS = new Set(['r', 'R', 'l', 'H', 'h', 'n', 's', 'q', 'I', 'c', 'o']);

/**
 * Parses the `grep -r` commands conventions use as prefilters, with
 * `{repo_path}` standing for the repository root.
 */
export function parseGrepCommand(command: string): ParseResult {
  const words = tokenize(command.trim());
  if (!words || words[0] !== 'grep') {
    return {ok: false, reason: 'Only a single grep command can be previewed.'};
  }

  let mode: 'basic' | 'extended' | 'fixed' = 'basic';
  let ignoreCase = false;
  let wholeWord = false;
  const patterns: string[] = [];
  const includes: string[] = [];
  const excludes: string[] = [];
  const excludeDirs: string[] = [];
  const operands: string[] = [];

  for (let i = 1; i < words.length; i++) {
    const word = words[i]!;
    if (word === '--') {
      operands.push(...words.slice(i + 1));
      break;
    }
    if (word.startsWith('--')) {
      const separator = word.indexOf('=');
      const name = separator === -1 ? word.slice(2) : word.slice(2, separator);
      const value = separator === -1 ? '' : word.slice(separator + 1);
      switch (name) {
        case 'include':
          includes.push(value);
          break;
        case 'exclude':
          excludes.push(value);
          break;
        case 'exclude-dir':
          excludeDirs.push(value);
          break;
        case 'regexp':
          patterns.push(value);
          break;
        case 'extended-regexp':
          mode = 'extended';
          break;
        case 'fixed-strings':
          mode = 'fixed';
          break;
        case 'ignore-case':
          ignoreCase = true;
          break;
        case 'word-regexp':
          wholeWord = true;
          break;
        case 'recursive':
        case 'dereference-recursive':
        case 'files-with-matches':
          break;
        default:
          return {ok: false, reason: `Unsupported grep option: ${word}`};
      }
      continue;
    }
    if (word.startsWith('-') && word.length > 1) {
      for (let j = 1; j < word.length; j++) {
        const flag = word[j]!;
        if (flag === 'e') {
          const rest = word.slice(j + 1);
          patterns.push(rest || (words[++i] ?? ''));
          break;
        }
        if (flag === 'E') {
          mode = 'extended';
        } else if (flag === 'F') {
          mode = 'fixed';
        } else if (flag === 'G') {
          mode = 'basic';
        } else if (flag === 'i') {
          ignoreCase = true;
        } else if (flag === 'w') {
          wholeWord = true;
        } else if (!OUTPUT_FLAGS.has(flag)) {
          return {ok: false, reason: `Unsupported grep option: -${flag}`};
        }
      }
      continue;
    }
    operands.push(word);
  }

  if (patterns.length === 0) {
    const pattern = operands.shift();
    if (pattern === undefined) {
      return {ok: false, reason: 'The grep command has no pattern.'};
    }
    patterns.push(pattern);
  }

  let regex: RegExp;
  try {
    // grep matches line by line, so anchors apply to each line.
    regex = new RegExp(
      patterns.map(p => toJsRegExpSource(p, mode, wholeWord)).join('|'),
      ignoreCase ? 'im' : 'm'
    );
  } catch {
    return {ok: false, reason: 'The grep pattern is not a valid regular expression.'};
  }

  const paths = (operands.length ? operands : ['{repo_path}']).map(operand =>
    operand
      .replace(/^\{repo_path\}\/?/, '')
      .replace(/^\.\/?/, '')
      .replace(/\/+$/, '')
  );

  return {ok: true, grep: {regex, includes, excludes, excludeDirs, paths}};
}

/**
 * The files grep would read: under one of its paths, with a base name that
 * passes `--include`/`--exclude`, and outside any `--exclude-dir`.
 */
export function grepCandidates(paths: string[], grep: GrepCommand) {
  const isIncluded = compile(grep.includes, true);
  const isExcluded = compile(grep.excludes, true);
  const isExcludedDir = compile(grep.excludeDirs, true);

  return paths.filter(path => {
    const inSearchPath = grep.paths.some(
      root => root === '' || path === root || path.startsWith(`${root}/`)
    );
    if (!inSearchPath) {
      return false;
    }
    const segments = path.split('/');
    const basename = segments.pop() ?? '';
    return (
      (grep.includes.length === 0 || isIncluded(basename)) &&
      !isExcluded(basename) &&
      !segments.some(isExcludedDir)
    );
  });
}

export type PreviewPlan =
  | {kind: 'unsupported'; reason: string}
  | {candidates: string[]; kind: 'glob'}
  | {candidates: string[]; grep: GrepCommand; kind: 'grep'};

/**
 * Works out which repo files a convention's filters select. A prefilter's
 * matches still have to pass the include/exclude globs, so both narrow the
 * candidates before any file contents are read.
 */
export function planPreview(paths: string[], filters: ConventionFilters): PreviewPlan {
  if (filters.prefilter) {
    const parsed = parseGrepCommand(filters.prefilter);
    if (!parsed.ok) {
      return {kind: 'unsupported', reason: parsed.reason};
    }
    const candidates = filterPaths(
      grepCandidates(paths, parsed.grep),
      filters.include,
      filters.exclude
    );
    return {kind: 'grep', candidates, grep: parsed.grep};
  }

  if (filters.detect_command) {
    return {
      kind: 'unsupported',
      reason: 'Files chosen by a detect_command script cannot be previewed.',
    };
  }

  return {
    kind: 'glob',
    candidates: filterPaths(paths, filters.include ?? DEFAULT_INCLUDE, filters.exclude),
  };
}

function hashString(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

/**
 * Shuffles with a PRNG seeded from `seed`, so the same filters always preview
 * the same sample instead of reshuffling on every render.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = hashString(seed);
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
