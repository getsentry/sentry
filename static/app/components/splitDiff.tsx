import styled from '@emotion/styled';
import type {Change} from 'diff';
import {diffChars, diffLines, diffWords} from 'diff';

// @TODO(jonasbadalic): This used to be defined on the theme, but is component specific and lacks dark mode.
export const DIFF_COLORS = {
  removedRow: 'hsl(358deg 89% 65% / 15%)',
  removed: 'hsl(358deg 89% 65% / 30%)',
  addedRow: 'hsl(100deg 100% 87% / 18%)',
  added: 'hsl(166deg 58% 47% / 32%)',
} as const;

const diffFnMap = {
  chars: diffChars,
  words: diffWords,
  lines: diffLines,
} as const;

type Props = {
  base: string;
  target: string;
  className?: string;
  type?: keyof typeof diffFnMap;
};

function SplitDiff({className, type = 'lines', base, target}: Props) {
  const diffFn = diffFnMap[type];

  const baseLines = base.split('\n');
  const targetLines = target.split('\n');
  const [largerArray] =
    baseLines.length > targetLines.length
      ? [baseLines, targetLines]
      : [targetLines, baseLines];
  const results = largerArray.map((_line, index) =>
    diffFn(baseLines[index] || '', targetLines[index] || '', {newlineIsToken: true})
  );

  return (
    <SplitTable className={className} data-test-id="split-diff">
      <SplitBody>
        {results.map((line, j) => {
          const highlightAdded = line.find(result => result.added);
          const highlightRemoved = line.find(result => result.removed);

          return (
            <tr key={j}>
              <Cell isRemoved={highlightRemoved}>
                <Line>
                  {line
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
                  {line
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
  font-size: ${p => p.theme.fontSizeSmall};
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
