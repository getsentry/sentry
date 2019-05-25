import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {diffChars, diffWords, diffLines} from 'diff';

const diffFnMap = {
  chars: diffChars,
  words: diffWords,
  lines: diffLines,
};

class SplitDiff extends React.Component {
  static propTypes = {
    base: PropTypes.string,
    target: PropTypes.string,
    type: PropTypes.oneOf(['lines', 'words', 'chars']),
  };

  static defaultProps = {
    type: 'lines',
  };

  render() {
    const {className, type, base, target} = this.props;
    const diffFn = diffFnMap[type];

    if (typeof diffFn !== 'function') {
      return null;
    }

    const baseLines = base.split('\n');
    const targetLines = target.split('\n');
    const [largerArray] =
      baseLines.length > targetLines.length
        ? [baseLines, targetLines]
        : [targetLines, baseLines];
    const results = largerArray.map((line, index) =>
      diffFn(baseLines[index] || '', targetLines[index] || '', {newlineIsToken: true})
    );

    return (
      <SplitTable className={className}>
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
                      .map((result, i) => {
                        return (
                          <Word key={i} isRemoved={result.removed}>
                            {result.value}
                          </Word>
                        );
                      })}
                  </Line>
                </Cell>

                <Gap />

                <Cell isAdded={highlightAdded}>
                  <Line>
                    {line
                      .filter(result => !result.removed)
                      .map((result, i) => {
                        return (
                          <Word key={i} isAdded={result.added}>
                            {result.value}
                          </Word>
                        );
                      })}
                  </Line>
                </Cell>
              </tr>
            );
          })}
        </SplitBody>
      </SplitTable>
    );
  }
}

const SplitTable = styled('table')`
  table-layout: fixed;
  border-collapse: collapse;
  width: 100%;
`;

const SplitBody = styled('tbody')`
  font-family: Monaco, Consolas, 'Courier New', monospace;
  font-size: 13px;
`;

const Cell = styled('td')`
  vertical-align: top;
  ${p => p.isRemoved && `background-color: ${p.theme.diff.removedRow}`};
  ${p => p.isAdded && `background-color: ${p.theme.diff.addedRow}`};
`;

const Gap = styled('td')`
  width: 20px;
`;

const Line = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const Word = styled('span')`
  white-space: pre-wrap;
  word-break: break-all;
  ${p => p.isRemoved && `background-color: ${p.theme.diff.removed}`};
  ${p => p.isAdded && `background-color: ${p.theme.diff.added}`};
`;

export default SplitDiff;
