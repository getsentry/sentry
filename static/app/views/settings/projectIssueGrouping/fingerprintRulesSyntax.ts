/**
 * Tokenizer for fingerprint rules, used to highlight them and to point out mistakes before
 * they're saved. It follows the grammar in `src/sentry/grouping/fingerprinting/parser.py`,
 * so a config gets an error diagnostic when the backend would reject it.
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
  | 'unknown-attribute'
  | 'unknown-matcher'
  // Warnings, these save but probably don't do what was intended
  | 'inline-comment'
  | 'multiline-quote'
  | 'unknown-variable'
  | 'unquoted-title';

export interface FingerprintDiagnostic {
  code: FingerprintDiagnosticCode;
  end: number;
  severity: 'error' | 'warning';
  start: number;
  /**
   * The text the diagnostic is about, such as an unknown matcher name
   */
  text?: string;
}

const WARNING_CODES = new Set<FingerprintDiagnosticCode>([
  'inline-comment',
  'multiline-quote',
  'unknown-variable',
  'unquoted-title',
]);

// `MATCHERS` in src/sentry/grouping/fingerprinting/matchers.py, plus any `tags.*`
const MATCHERS = new Set([
  'error.type',
  'error.value',
  'stack.module',
  'stack.abs_path',
  'stack.package',
  'stack.function',
  'message',
  'logger',
  'level',
  'type',
  'value',
  'module',
  'path',
  'package',
  'function',
  'family',
  'app',
  'sdk',
  'release',
]);

// `resolve_fingerprint_variable` in src/sentry/grouping/fingerprinting/utils.py, plus any
// `tags.*`. `{{ default }}` is only valid as a fingerprint value, not inside a title.
const VARIABLES = new Set([
  'transaction',
  'message',
  'raw_message',
  'type',
  'error.type',
  'value',
  'raw_value',
  'error.value',
  'error.raw_value',
  'function',
  'stack.function',
  'path',
  'stack.abs_path',
  'stack.filename',
  'module',
  'stack.module',
  'package',
  'stack.package',
  'level',
  'logger',
]);

// Sticky versions of the backend grammar's regexes. `[^\n]` stands in for Python's `.`
const KEY = /[\w.-]+/y;
const QUOTED_KEY = /"([\w.:-]+)"/y;
const QUOTED = /"([^"\\]*(?:\\[^\n][^"\\]*)*)"/y;
const UNQUOTED = /\S+/y;
const UNQUOTED_NO_COMMA = /\{\{\s*\S+\s*\}\}|[^\s{,]+/y;
const COMMENT = /#[^\r\n]*/y;
const NON_NEWLINE_WHITESPACE = /[^\S\r\n]+/y;
const INVALID_FINGERPRINT_TEXT = /[^\s,]+/y;
const LOOKALIKE_ARROW = /[→⟶⇒➔]|=>|—>|–>/y;

const VARIABLE = /\{\{\s*(\S+)\s*\}\}/g;
const WHOLE_VARIABLE = /^\{\{\s*(\S+)\s*\}\}$/;
const ANY_ARROW = /->|[→⟶⇒➔]|=>|—>|–>/;

function matchAt(regex: RegExp, text: string, pos: number) {
  regex.lastIndex = pos;
  return regex.exec(text);
}

function isKnownVariable(name: string, {inTitle}: {inTitle: boolean}) {
  return (
    VARIABLES.has(name) || name.startsWith('tags.') || (!inTitle && name === 'default')
  );
}

export function tokenizeFingerprintRules(text: string) {
  const tokens: FingerprintToken[] = [];
  const diagnostics: FingerprintDiagnostic[] = [];

  const addToken = (type: FingerprintTokenType, start: number, end: number) =>
    tokens.push({type, start, end});
  const addDiagnostic = (
    code: FingerprintDiagnosticCode,
    start: number,
    end: number,
    diagnosticText?: string
  ) =>
    diagnostics.push({
      code,
      severity: WARNING_CODES.has(code) ? 'warning' : 'error',
      start,
      end,
      text: diagnosticText,
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

  // Quoted strings can span lines, which is almost always a missing closing quote
  const checkMultiline = (start: number, end: number) => {
    if (/[\r\n]/.test(text.slice(start, end))) {
      addDiagnostic('multiline-quote', start, end);
    }
  };

  const checkVariable = (name: string, start: number, end: number, inTitle = false) => {
    if (!isKnownVariable(name, {inTitle})) {
      addDiagnostic('unknown-variable', start, end, name);
    }
  };

  // A quoted attribute value, with any variables in it highlighted
  const scanTemplate = (start: number, end: number, inTitle: boolean) => {
    let pos = start;
    for (const match of text.slice(start, end).matchAll(VARIABLE)) {
      const variableStart = start + match.index;
      const variableEnd = variableStart + match[0].length;
      if (variableStart > pos) {
        addToken('string', pos, variableStart);
      }
      addToken('variable', variableStart, variableEnd);
      checkVariable(match[1]!, variableStart, variableEnd, inTitle);
      pos = variableEnd;
    }
    if (pos < end) {
      addToken('string', pos, end);
    }
    checkMultiline(start, end);
  };

  // matcher = negation? matcher_type sep argument
  const scanMatcher = (
    pos: number,
    {splitArrow}: {splitArrow: boolean}
  ): {end: number; arrowStart?: number; hasArrow?: boolean} => {
    let cursor = pos;
    if (text[cursor] === '!') {
      cursor++;
    }
    const quotedKey = matchAt(QUOTED_KEY, text, cursor);
    const key = quotedKey ?? matchAt(KEY, text, cursor);
    const keyEnd = key ? cursor + key[0].length : cursor;
    const valueStart = keyEnd + 1;
    const quoted = matchAt(QUOTED, text, valueStart);
    const value =
      key && text[keyEnd] === ':'
        ? (quoted ?? matchAt(UNQUOTED, text, valueStart))
        : null;

    if (!key || !value) {
      const end = pos + matchAt(UNQUOTED, text, pos)![0].length;
      addToken('invalid', pos, end);
      addDiagnostic('invalid-syntax', pos, end);
      return {end};
    }

    if (cursor > pos) {
      addToken('negation', pos, cursor);
    }
    addToken('matcher', cursor, keyEnd);
    const name = quotedKey ? quotedKey[1]! : key[0];
    if (!MATCHERS.has(name) && !name.startsWith('tags.')) {
      addDiagnostic('unknown-matcher', cursor, keyEnd, name);
    }
    addToken('punctuation', keyEnd, valueStart);

    // An unquoted value runs until the next space, so it swallows an arrow written right
    // after it. The rule is scanned again with `splitArrow` if it turns out to have no other.
    const valueEnd = valueStart + value[0].length;
    const glued = quoted ? null : ANY_ARROW.exec(value[0]);
    if (glued && splitArrow) {
      const arrowStart = valueStart + glued.index;
      const arrowEnd = arrowStart + glued[0].length;
      const isArrow = glued[0] === '->';
      if (glued.index > 0) {
        addToken('pattern', valueStart, arrowStart);
      }
      addToken(isArrow ? 'arrow' : 'invalid', arrowStart, arrowEnd);
      if (!isArrow) {
        addDiagnostic('lookalike-arrow', arrowStart, arrowEnd, glued[0]);
      } else if (glued.index > 0) {
        addDiagnostic('glued-arrow', arrowStart, arrowEnd, glued[0]);
      } else {
        addDiagnostic('invalid-syntax', pos, arrowEnd);
      }
      return {end: arrowEnd, arrowStart};
    }

    addToken('pattern', valueStart, valueEnd);
    checkMultiline(valueStart, valueEnd);
    return {end: valueEnd, hasArrow: glued !== null};
  };

  // fp_argument = fp_attribute / quoted / unquoted_no_comma
  const scanFingerprintValue = (pos: number) => {
    const key = matchAt(KEY, text, pos)?.[0];
    const attributeValue = key && matchAt(QUOTED, text, pos + key.length + 1);
    if (key && text[pos + key.length] === '=' && attributeValue) {
      const equals = pos + key.length;
      addToken('attribute', pos, equals);
      addToken('punctuation', equals, equals + 1);
      if (key !== 'title') {
        addDiagnostic('unknown-attribute', pos, equals, key);
      }
      const end = equals + 1 + attributeValue[0].length;
      scanTemplate(equals + 1, end, key === 'title');
      return end;
    }

    const quoted = matchAt(QUOTED, text, pos);
    const word = quoted?.[0] ?? matchAt(UNQUOTED_NO_COMMA, text, pos)?.[0];
    if (!word) {
      return null;
    }
    const end = pos + word.length;
    // A quoted value is a variable too, as long as the whole value is one
    const variable = WHOLE_VARIABLE.exec(quoted ? quoted[1]! : word)?.[1];
    addToken(variable === undefined ? 'value' : 'variable', pos, end);
    if (variable !== undefined) {
      checkVariable(variable, pos, end);
    }
    if (quoted) {
      checkMultiline(pos, end);
    } else if (word.startsWith('#')) {
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
  const scanFingerprint = (pos: number, arrowStart: number, arrowEnd: number) => {
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
    let gluedArrow: {diagnosticCount: number; pos: number; tokenCount: number} | null =
      null;
    while (true) {
      pos = skipSpaces(pos);
      if (isLineEnd(pos)) {
        break;
      }
      const lookalike = matchAt(LOOKALIKE_ARROW, text, pos)?.[0];
      if (text.startsWith('->', pos) || lookalike) {
        const end = pos + (lookalike ?? '->').length;
        addToken(lookalike ? 'invalid' : 'arrow', pos, end);
        if (lookalike) {
          addDiagnostic('lookalike-arrow', pos, end, lookalike);
        }
        if (pos === start) {
          addDiagnostic('invalid-syntax', pos, end);
        }
        return scanFingerprint(end, pos, end);
      }
      if (/\s/.test(text[pos]!)) {
        pos = scanWhitespace(pos);
        continue;
      }
      const checkpoint = {
        pos,
        tokenCount: tokens.length,
        diagnosticCount: diagnostics.length,
      };
      const matcher = scanMatcher(pos, {splitArrow: false});
      gluedArrow ??= matcher.hasArrow ? checkpoint : null;
      pos = lastEnd = matcher.end;
    }

    if (gluedArrow) {
      tokens.length = gluedArrow.tokenCount;
      diagnostics.length = gluedArrow.diagnosticCount;
      const matcher = scanMatcher(gluedArrow.pos, {splitArrow: true});
      return scanFingerprint(matcher.end, matcher.arrowStart!, matcher.end);
    }

    // Without an arrow, report the whole rule once instead of each piece of it
    const kept = diagnostics
      .splice(firstDiagnostic)
      .filter(({code}) => code !== 'invalid-syntax');
    diagnostics.push(...kept);
    addDiagnostic('missing-arrow', start, lastEnd);
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
