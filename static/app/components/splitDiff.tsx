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

  const displayRows = useMemo(
    () =>
      groupedChanges.map(line => {
        const highlightAdded = line.find(result => result.added);
        const highlightRemoved = line.find(result => result.removed);
        const displayData = getDisplayData(line, highlightAdded, highlightRemoved);

        return {
          highlightAdded,
          highlightRemoved,
          leftSegments: displayData.filter(result => !result.added),
          rightSegments: displayData.filter(result => !result.removed),
        };
      }),
    [groupedChanges]
  );

  return (
    <SplitDiffContainer className={className} data-test-id="split-diff">
      <SplitBody>
        {displayRows.map((row, j) => {
          return (
            <Cell
              key={`left-${j}`}
              data-test-id="split-diff-left-cell"
              row={j + 1}
              side="left"
              isRemoved={row.highlightRemoved}
            >
              <Line>
                {row.leftSegments.map((result, i) => (
                  <Word key={i} isRemoved={result.removed}>
                    {result.value}
                  </Word>
                ))}
              </Line>
            </Cell>
          );
        })}

        {displayRows.map((row, j) => {
          return (
            <Cell
              key={`right-${j}`}
              data-test-id="split-diff-right-cell"
              row={j + 1}
              side="right"
              isAdded={row.highlightAdded}
            >
              <Line>
                {row.rightSegments.map((result, i) => (
                  <Word key={i} isAdded={result.added}>
                    {result.value}
                  </Word>
                ))}
              </Line>
            </Cell>
          );
        })}
      </SplitBody>
    </SplitDiffContainer>
  );
}

const SplitDiffContainer = styled('div')`
  width: 100%;
`;

const SplitBody = styled('div')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr);
`;

const Cell = styled('div')<{
  row: number;
  side: 'left' | 'right';
  isAdded?: Change;
  isRemoved?: Change;
}>`
  grid-row: ${p => p.row};
  grid-column: ${p => (p.side === 'left' ? 1 : 3)};
  min-width: 0;
  min-height: 1.4em;
  overflow: hidden;
  ${p => p.isRemoved && `background-color: ${DIFF_COLORS.removedRow}`};
  ${p => p.isAdded && `background-color: ${DIFF_COLORS.addedRow}`};
`;

const Line = styled('div')`
  white-space: pre-wrap;
`;

const Word = styled('span')<{isAdded?: boolean; isRemoved?: boolean}>`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  ${p => p.isRemoved && `background-color: ${DIFF_COLORS.removed}`};
  ${p => p.isAdded && `background-color: ${DIFF_COLORS.added}`};
`;

export default SplitDiff;
