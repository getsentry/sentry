import styled from '@emotion/styled';
import {type Change, diffArrays} from 'diff';

// @TODO(jonasbadalic): This used to be defined on the theme, but is component specific and lacks dark mode.
export const DIFF_COLORS = {
  removedRow: 'hsl(358deg 89% 65% / 15%)',
  removed: 'hsl(358deg 89% 65% / 30%)',
  addedRow: 'hsl(100deg 100% 87% / 18%)',
  added: 'hsl(166deg 58% 47% / 32%)',
} as const;

type Props = {
  base: string;
  target: string;
  className?: string;
};

function SplitDiff({className, base, target}: Props) {
  function tokenizePreservingWhitespace(line: string): string[] {
    const tokens: string[] = [];
    let buffer = '';

    for (const char of line) {
      if (char === ' ' || char === '\t' || char === '\n') {
        if (buffer) {
          tokens.push(buffer);
          buffer = '';
        }
        tokens.push(char); // preserve space, tab, or newline as token
      } else {
        buffer += char;
      }
    }

    if (buffer) tokens.push(buffer);

    return tokens;
  }
  function tokenizeStackTrace(t: string): string[] {
    const trace = t.replace(/, line \d+,/g, ','); // this is ONLY FOR PYTHON
    const lines = trace.split('\n');

    return lines.flatMap((lineStr): string[] => {
      const matchWithFn = lineStr.match(/^\s*at\s+(.*?)\s+\((.*?):\d+:\d+\)$/);
      if (matchWithFn !== null && matchWithFn.length === 3) {
        const fnName = matchWithFn[1]!;
        const file = matchWithFn[2]!;
        return ['at', fnName, file, 'LINE', 'COL'];
      }

      const matchWithoutFn = lineStr.match(/^\s*at\s+(.*?):\d+:\d+$/);
      if (matchWithoutFn !== null && matchWithoutFn.length === 2) {
        const file = matchWithoutFn[1]!;
        return ['at', file, 'LINE', 'COL'];
      }

      // Fallback: basic whitespace tokenization
      return [...tokenizePreservingWhitespace(lineStr), '\n'];
    });
  }

  const tokenizedBase = tokenizeStackTrace(base);
  const tokenizedTarget = tokenizeStackTrace(target);

  const results = diffArrays(tokenizedBase, tokenizedTarget);

  function assembleLines(
    assembledLines: Change[][] = [],
    currentLine: Change[] = []
  ): Change[][] {
    for (const result of results) {
      if (result.value.includes('\n')) {
        const lineResult = result.value.join('').split('\n');
        // add the rest of the current line and push to aseembled line
        currentLine.push({
          added: result.added,
          removed: result.removed,
          value: lineResult[0] ?? '====', // this never happens??
        });
        assembledLines.push(currentLine);
        currentLine = [];

        // now add the rest of them
        lineResult.slice(1, -1).forEach(line => {
          const lineChunk: Change[] = [
            {
              added: result.added,
              removed: result.removed,
              value: line,
            },
          ];
          assembledLines.push(lineChunk);
        });

        // now add the last one
        currentLine.push({
          added: result.added,
          removed: result.removed,
          value: lineResult[lineResult.length - 1] ?? '====', // Should fix this probable
        });
      } else {
        currentLine.push({
          added: result.added,
          removed: result.removed,
          value: ' ' + result.value.join(''),
        });
      }
    }
    assembledLines.push(currentLine);
    return assembledLines;
  }

  const assembledLines = assembleLines();

  return (
    <SplitTable className={className} data-test-id="split-diff">
      <SplitBody>
        {assembledLines.map((line, i) => (
          <tr key={i}>
            <Cell isRemoved={line.some(change => change.removed)}>
              <Line>
                {line
                  .filter(change => !change.added)
                  .map((change, j) => (
                    <Word key={j} isRemoved={change.removed}>
                      {change.value}
                    </Word>
                  ))}
              </Line>
            </Cell>

            <Gap />

            <Cell isAdded={line.some(change => change.added)}>
              <Line>
                {line
                  .filter(change => !change.removed)
                  .map((change, j) => (
                    <Word key={j} isAdded={change.added}>
                      {change.value}
                    </Word>
                  ))}
              </Line>
            </Cell>
          </tr>
        ))}
      </SplitBody>
    </SplitTable>
  );
}

const SplitTable = styled('table')`
  table-layout: fixed;
  border-collapse: collapse;
  width: 100%;
`;

const SplitBody = styled('tbody')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
`;

const Cell = styled('td')<{isAdded?: boolean; isRemoved?: boolean}>`
  vertical-align: top;
  ${p => p.isRemoved && `background-color: ${DIFF_COLORS.removedRow}`};
  ${p => p.isAdded && `background-color: ${DIFF_COLORS.addedRow}`};
`;

const Gap = styled('td')`
  width: 20px;
`;

const Line = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const Word = styled('span')<{isAdded?: boolean; isRemoved?: boolean}>`
  white-space: pre-wrap;
  word-break: break-all;
  ${p => p.isRemoved && `background-color: ${DIFF_COLORS.removed}`};
  ${p => p.isAdded && `background-color: ${DIFF_COLORS.added}`};
`;

export default SplitDiff;
