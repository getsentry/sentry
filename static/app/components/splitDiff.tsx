import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {Change} from 'diff';
import {diffChars, diffLines, diffWords} from 'diff';

import {unreachable} from 'sentry/utils/unreachable';

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
  type?: 'lines' | 'words' | 'chars';
};

// this function splits the lines from diffLines into words that are diffed
function getDisplayData(
  line: Change[],
  highlightAdded: Change | undefined,
  highlightRemoved: Change | undefined
): Change[] {
  if (!highlightAdded && !highlightRemoved) {
    return line;
  }

  const leftText = line.reduce(
    (acc, result) => (result.added ? acc : acc + result.value),
    ''
  );
  const rightText = line.reduce(
    (acc, result) => (result.removed ? acc : acc + result.value),
    ''
  );

  if (!leftText && !rightText) {
    return line;
  }

  return diffWords(leftText, rightText);
}

function SplitDiff({className, type = 'lines', base, target}: Props) {
  // split one change that includes multiple lines into one change per line (for formatting)
  const groupedChanges = useMemo((): Change[][] => {
    let diffResults: Change[] | undefined;
    switch (type) {
      case 'lines':
        diffResults = diffLines(base, target, {newlineIsToken: true});
        break;
      case 'words':
        diffResults = diffWords(base, target);
        break;
      case 'chars':
        diffResults = diffChars(base, target);
        break;
      default:
        unreachable(type);
        break;
    }
    const results = diffResults ?? [];

    let currentLine: Change[] = [];
    const processedLines: Change[][] = [];
    for (const change of results) {
      const lines = change.value.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const lineValue = lines[i];
        if (lineValue !== undefined && lineValue !== '') {
          currentLine.push({
            value: lineValue,
            added: change.added,
            removed: change.removed,
            count: 1,
          });
        }
        if (i < lines.length - 1) {
          processedLines.push(currentLine);
          currentLine = [];
        }
      }
    }
    if (currentLine.length > 0) {
      processedLines.push(currentLine);
    }
    return processedLines;
  }, [base, target, type]);

  return (
    <SplitTable className={className} data-test-id="split-diff">
      <SplitBody>
        {groupedChanges.map((line, j) => {
          const highlightAdded = line.find(result => result.added);
          const highlightRemoved = line.find(result => result.removed);

          return (
            <tr key={j}>
              <Cell isRemoved={highlightRemoved}>
                <Line>
                  {getDisplayData(line, highlightAdded, highlightRemoved)
                    .filter(result => !result.added)
                    .map((result, i) => (
                      <Word key={i} isRemoved={result.removed}>
                        {result.value}
                      </Word>
                    ))}
                </Line>
              </Cell>

              <Gap />

              <Cell isAdded={highlightAdded}>
                <Line>
                  {getDisplayData(line, highlightAdded, highlightRemoved)
                    .filter(result => !result.removed)
                    .map((result, i) => (
                      <Word key={i} isAdded={result.added}>
                        {result.value}
                      </Word>
                    ))}
                </Line>
              </Cell>
            </tr>
          );
        })}
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

const Cell = styled('td')<{isAdded?: Change; isRemoved?: Change}>`
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
