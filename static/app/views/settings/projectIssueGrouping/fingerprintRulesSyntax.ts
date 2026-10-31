import {parse} from 'sentry/views/settings/projectIssueGrouping/fingerprintRules.pegjs';

/**
 * Tokenizes fingerprint rules to highlight them and point out mistakes before they're saved.
 * `fingerprintRules.pegjs` mirrors the backend grammar, so a line gets an error when the
 * backend can't parse it. Matcher and variable names aren't checked, so it doesn't need
 * updating when the backend adds one.
 */

type FingerprintTokenType =
  | 'arrow'
  | 'attribute'
  | 'comment'
  | 'invalid'
  | 'matcher'
  | 'negation'
  | 'pattern'
  | 'punctuation'
  | 'string'
  | 'value'
  | 'variable';

export interface FingerprintToken {
  end: number;
  start: number;
  type: FingerprintTokenType;
}

export type FingerprintDiagnosticCode =
  // Errors, the backend rejects these
  | 'glued-arrow'
  | 'invalid-syntax'
  | 'lookalike-arrow'
  | 'missing-arrow'
  // Warnings, these save but probably don't do what was intended
  | 'inline-comment'
  | 'unquoted-title';

export interface FingerprintDiagnostic {
  code: FingerprintDiagnosticCode;
  end: number;
  severity: 'error' | 'warning';
  start: number;
}

// The same hints as `_describe_syntax_error` in src/sentry/grouping/fingerprinting/__init__.py
const QUOTED_STRINGS = /"(?:[^"\\]|\\[^\n])*"/g;
const LOOKALIKE_ARROW = /[→⟶⇒➔]|=>|—>|–>/;
const GLUED_ARROW = /[^\s-]->/;

// Point at a lookalike or glued arrow when there is one, otherwise the whole line
function describeInvalidLine(
  text: string,
  start: number,
  end: number
): Omit<FingerprintDiagnostic, 'severity'> {
  // Blank out quoted strings without shifting offsets
  const line = text.slice(start, end).replace(QUOTED_STRINGS, s => ' '.repeat(s.length));

  if (!line.includes('->')) {
    const lookalike = LOOKALIKE_ARROW.exec(line);
    if (!lookalike) {
      return {code: 'missing-arrow', start, end};
    }
    const at = start + lookalike.index;
    return {code: 'lookalike-arrow', start: at, end: at + lookalike[0].length};
  }

  const glued = GLUED_ARROW.exec(line);
  if (!glued) {
    return {code: 'invalid-syntax', start, end};
  }
  const at = start + glued.index + 1;
  return {code: 'glued-arrow', start: at, end: at + 2};
}

export function tokenizeFingerprintRules(rules: string) {
  // The backend's `\s` is Unicode White_Space, which includes \x85 but not \ufeff, the
  // reverse of JavaScript's. Swap both for characters JavaScript sees the same way, keeping
  // every offset where it was.
  const text = rules.replaceAll('\x85', '\t').replaceAll('\uFEFF', '\u200B');
  const tokens: FingerprintToken[] = parse(text);
  const diagnostics: FingerprintDiagnostic[] = [];

  for (const {type, start, end} of tokens) {
    const value = text.slice(start, end);
    if (type === 'invalid') {
      diagnostics.push({severity: 'error', ...describeInvalidLine(text, start, end)});
    } else if (type === 'value' && value.startsWith('#')) {
      // Runs to the end of the line
      const eol = start + text.slice(start).search(/[\r\n]|$/);
      diagnostics.push({code: 'inline-comment', severity: 'warning', start, end: eol});
    } else if (type === 'value' && value.startsWith('title=')) {
      diagnostics.push({code: 'unquoted-title', severity: 'warning', start, end});
    }
  }

  return {tokens, diagnostics};
}
