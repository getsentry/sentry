/**
 * Tokenizer for fingerprint rules, used to highlight them and to point out mistakes before
 * they're saved. It follows the grammar in `src/sentry/grouping/fingerprinting/parser.py`,
 * so a config gets an error diagnostic when the backend can't parse it. Matcher and
 * variable names aren't checked, so it doesn't need updating when the backend adds one.
 */

export type FingerprintTokenType =
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

const WARNING_CODES = new Set<FingerprintDiagnosticCode>([
  'inline-comment',
  'unquoted-title',
]);

// Sticky versions of the backend grammar's regexes. `[^\n]` stands in for Python's `.`
const KEY = /[\w.-]+/y;
const QUOTED_KEY = /"[\w.:-]+"/y;
const QUOTED = /"([^"\\]*(?:\\[^\n][^"\\]*)*)"/y;
const UNQUOTED = /\S+/y;
const UNQUOTED_NO_COMMA = /\{\{\s*\S+\s*\}\}|[^\s{,]+/y;
const COMMENT = /#[^\r\n]*/y;
const NON_NEWLINE_WHITESPACE = /[^\S\r\n]+/y;
const INVALID_FINGERPRINT_TEXT = /[^\s,]+/y;

const VARIABLE = /\{\{\s*\S+\s*\}\}/g;
const WHOLE_VARIABLE = /^\{\{\s*\S+\s*\}\}$/;

// The same hints as `_describe_syntax_error` in src/sentry/grouping/fingerprinting/__init__.py
const QUOTED_STRINGS = new RegExp(QUOTED.source, 'g');
const LOOKALIKE_ARROW = /[→⟶⇒➔]|=>|—>|–>/;
const GLUED_ARROW = /[^\s-]->/;

function matchAt(regex: RegExp, text: string, pos: number) {
  regex.lastIndex = pos;
  return regex.exec(text);
}

export function tokenizeFingerprintRules(rules: string) {
  // The backend's `\s` is Unicode White_Space, which includes \x85 but not \ufeff, the
  // reverse of JavaScript's. Swap both for characters JavaScript sees the same way, keeping
  // every offset where it was.
  const text = rules.replaceAll('\x85', '\t').replaceAll('\uFEFF', '\u200B');
  const tokens: FingerprintToken[] = [];
  const diagnostics: FingerprintDiagnostic[] = [];

  const addToken = (type: FingerprintTokenType, start: number, end: number) =>
    tokens.push({type, start, end});
  const addDiagnostic = (code: FingerprintDiagnosticCode, start: number, end: number) =>
    diagnostics.push({
      code,
      severity: WARNING_CODES.has(code) ? 'warning' : 'error',
      start,
      end,
    });

  const isLineEnd = (pos: number) =>
    pos >= text.length || text[pos] === '\n' || text[pos] === '\r';
  const skipSpaces = (pos: number) => {
    while (text[pos] === ' ') {
      pos++;
    }
    return pos;
  };

  // The grammar only allows spaces between tokens, so tabs and other whitespace are errors
  const scanWhitespace = (pos: number) => {
    const end = pos + matchAt(NON_NEWLINE_WHITESPACE, text, pos)![0].length;
    addToken('invalid', pos, end);
    addDiagnostic('invalid-syntax', pos, end);
    return end;
  };

  // A quoted attribute value, with any variables in it highlighted
  const scanTemplate = (start: number, end: number) => {
    let pos = start;
    for (const match of text.slice(start, end).matchAll(VARIABLE)) {
      const variableStart = start + match.index;
      const variableEnd = variableStart + match[0].length;
      if (variableStart > pos) {
        addToken('string', pos, variableStart);
      }
      addToken('variable', variableStart, variableEnd);
      pos = variableEnd;
    }
    if (pos < end) {
      addToken('string', pos, end);
    }
  };

  // matcher = negation? matcher_type sep argument
  const scanMatcher = (pos: number) => {
    let cursor = pos;
    if (text[cursor] === '!') {
      cursor++;
    }
    const key = matchAt(QUOTED_KEY, text, cursor) ?? matchAt(KEY, text, cursor);
    const keyEnd = key ? cursor + key[0].length : cursor;
    const valueStart = keyEnd + 1;
    const value =
      key && text[keyEnd] === ':'
        ? (matchAt(QUOTED, text, valueStart) ?? matchAt(UNQUOTED, text, valueStart))
        : null;

    if (!key || !value) {
      const end = pos + matchAt(UNQUOTED, text, pos)![0].length;
      addToken('invalid', pos, end);
      addDiagnostic('invalid-syntax', pos, end);
      return end;
    }

    if (cursor > pos) {
      addToken('negation', pos, cursor);
    }
    addToken('matcher', cursor, keyEnd);
    addToken('punctuation', keyEnd, valueStart);
    const valueEnd = valueStart + value[0].length;
    addToken('pattern', valueStart, valueEnd);
    return valueEnd;
  };

  // fp_argument = fp_attribute / quoted / unquoted_no_comma
  const scanFingerprintValue = (pos: number) => {
    const key = matchAt(KEY, text, pos)?.[0];
    const attributeValue = key && matchAt(QUOTED, text, pos + key.length + 1);
    if (key && text[pos + key.length] === '=' && attributeValue) {
      const equals = pos + key.length;
      addToken('attribute', pos, equals);
      addToken('punctuation', equals, equals + 1);
      const end = equals + 1 + attributeValue[0].length;
      scanTemplate(equals + 1, end);
      return end;
    }

    const quoted = matchAt(QUOTED, text, pos);
    const word = quoted?.[0] ?? matchAt(UNQUOTED_NO_COMMA, text, pos)?.[0];
    if (!word) {
      return null;
    }
    const end = pos + word.length;
    // A quoted value is a variable too, as long as the whole value is one
    const isVariable = WHOLE_VARIABLE.test(quoted ? quoted[1]! : word);
    addToken(isVariable ? 'variable' : 'value', pos, end);
    if (word.startsWith('#')) {
      let lineEnd = end;
      while (!isLineEnd(lineEnd)) {
        lineEnd++;
      }
      addDiagnostic('inline-comment', pos, lineEnd);
    } else if (word.startsWith('title=')) {
      addDiagnostic('unquoted-title', pos, end);
    }
    return end;
  };

  // fingerprint = fp_value+, where fp_value = fp_argument ","?
  const scanFingerprint = (arrowStart: number, arrowEnd: number) => {
    let pos = arrowEnd;
    let valueCount = 0;
    let canComma = false;
    while (true) {
      pos = skipSpaces(pos);
      if (isLineEnd(pos)) {
        break;
      }
      if (/\s/.test(text[pos]!)) {
        pos = scanWhitespace(pos);
        canComma = false;
        continue;
      }
      if (text[pos] === ',') {
        addToken(canComma ? 'punctuation' : 'invalid', pos, pos + 1);
        if (!canComma) {
          addDiagnostic('invalid-syntax', pos, pos + 1);
        }
        canComma = false;
        pos++;
        continue;
      }
      const end = scanFingerprintValue(pos);
      if (end === null) {
        const invalidEnd = pos + matchAt(INVALID_FINGERPRINT_TEXT, text, pos)![0].length;
        addToken('invalid', pos, invalidEnd);
        addDiagnostic('invalid-syntax', pos, invalidEnd);
        canComma = false;
        pos = invalidEnd;
        continue;
      }
      valueCount++;
      canComma = true;
      pos = end;
    }
    if (valueCount === 0) {
      addDiagnostic('invalid-syntax', arrowStart, arrowEnd);
    }
    return pos;
  };

  // rule = matchers _ follow _ fingerprint
  const scanRule = (start: number) => {
    const firstDiagnostic = diagnostics.length;
    let pos = start;
    let lastEnd = start;
    while (true) {
      pos = skipSpaces(pos);
      if (isLineEnd(pos)) {
        break;
      }
      if (text.startsWith('->', pos)) {
        addToken('arrow', pos, pos + 2);
        if (pos === start) {
          addDiagnostic('invalid-syntax', pos, pos + 2);
        }
        return scanFingerprint(pos, pos + 2);
      }
      if (/\s/.test(text[pos]!)) {
        pos = scanWhitespace(pos);
      } else {
        pos = lastEnd = scanMatcher(pos);
      }
    }

    // Without an arrow, report the whole rule once instead of each piece of it, pointing
    // at a lookalike or glued arrow outside of quotes like the backend does
    const kept = diagnostics
      .splice(firstDiagnostic)
      .filter(({code}) => code !== 'invalid-syntax');
    diagnostics.push(...kept);
    const rule = text
      .slice(start, lastEnd)
      .replace(QUOTED_STRINGS, quoted => ' '.repeat(quoted.length));
    const lookalike = rule.includes('->') ? null : LOOKALIKE_ARROW.exec(rule);
    const glued = GLUED_ARROW.exec(rule);
    if (lookalike) {
      const lookalikeStart = start + lookalike.index;
      addDiagnostic(
        'lookalike-arrow',
        lookalikeStart,
        lookalikeStart + lookalike[0].length
      );
    } else if (glued) {
      addDiagnostic('glued-arrow', start + glued.index + 1, start + glued.index + 3);
    } else {
      addDiagnostic('missing-arrow', start, lastEnd);
    }
    return pos;
  };

  // line = _ (comment / rule / empty) newline?
  let pos = 0;
  while (pos < text.length) {
    pos = skipSpaces(pos);
    const comment = matchAt(COMMENT, text, pos)?.[0];
    if (comment) {
      addToken('comment', pos, pos + comment.length);
      pos += comment.length;
    } else if (!isLineEnd(pos) && /\s/.test(text[pos]!)) {
      pos = scanWhitespace(pos);
      continue;
    } else if (!isLineEnd(pos)) {
      pos = scanRule(pos);
    }
    // Every branch above stops at the end of a line
    pos++;
  }

  diagnostics.sort((a, b) => a.start - b.start);
  return {tokens, diagnostics};
}
