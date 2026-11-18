import type {DocsParams} from './types';

const INDENT = '  ';

/**
 * Walks a line of generated config, skipping quoted strings and escaped
 * characters, so a `//` inside a URL or a bracket inside a string is not
 * mistaken for a comment or for nesting.
 */
function scanLine(line: string) {
  let quote: string | null = null;
  let brackets = '';
  let leadingClosers = 0;
  let seenCode = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '\\') {
      i++;
      seenCode = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '/' && line[i + 1] === '/') {
      return {
        code: line.slice(0, i).trimEnd(),
        comment: line.slice(i),
        brackets,
        leadingClosers,
      };
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      seenCode = true;
    } else if ('{[('.includes(char)) {
      brackets += char;
      seenCode = true;
    } else if ('}])'.includes(char)) {
      brackets += char;
      if (!seenCode) {
        leadingClosers++;
      }
    } else if (char !== ' ' && char !== ',') {
      seenCode = true;
    }
  }

  return {code: line, comment: '', brackets, leadingClosers};
}

function toLines(part: string) {
  return part
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

/**
 * Ends an entry with exactly one comma. When the entry ends in a line
 * comment, the comma goes before the comment so it stays valid JavaScript.
 */
function withTrailingComma(lines: string[]) {
  const last = lines.at(-1);
  if (last === undefined) {
    return lines;
  }
  const {code, comment} = scanLine(last);
  if (!code) {
    return lines;
  }
  const codeWithComma = `${code.replace(/,$/, '')},`;
  return [...lines.slice(0, -1), comment ? `${codeWithComma} ${comment}` : codeWithComma];
}

/**
 * Parts come from template literals written at whatever indentation their
 * source file uses, so their whitespace is discarded and rebuilt from
 * nesting. Brackets opened on the same line, like `({`, share one level.
 */
function reindent(lines: string[]) {
  // The indent level of the contents of each open bracket
  const levels: number[] = [];
  return lines.map(line => {
    const {brackets, leadingClosers} = scanLine(line);
    levels.splice(Math.max(levels.length - leadingClosers, 0));
    const level = levels.at(-1) ?? 0;
    for (const bracket of brackets.slice(leadingClosers)) {
      if ('{[('.includes(bracket)) {
        levels.push(level + 1);
      } else {
        levels.pop();
      }
    }
    return INDENT.repeat(level) + line;
  });
}

/**
 * Build the Sdk configuration for the getting started docs.
 *
 * The first line is returned without indentation and every following line is
 * prefixed with `indent`, so the result can be interpolated directly after
 * the whitespace that precedes it in the surrounding snippet.
 */
export function buildSdkConfig<P extends DocsParams>({
  params,
  staticParts,
  getIntegrations,
  getDynamicParts,
  indent = INDENT,
}: {
  getDynamicParts: (params: P) => string[];
  getIntegrations: (params: P) => string[];
  params: P;
  staticParts: string[];
  indent?: string;
}) {
  const entries: string[][] = staticParts.map(toLines);

  const integrations = getIntegrations(params);
  if (integrations.length > 0) {
    entries.push([
      'integrations: [',
      ...integrations.flatMap(integration => withTrailingComma(toLines(integration))),
      ']',
    ]);
  }

  entries.push(...getDynamicParts(params).map(toLines));

  const lines = entries.filter(entry => entry.length > 0).flatMap(withTrailingComma);
  return reindent(lines).join(`\n${indent}`);
}
