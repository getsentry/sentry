import styled from '@emotion/styled';
import classNames from 'classnames';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Coverage} from 'sentry/types';

interface Props {
  isActive: boolean;
  line: [lineNo: number, content: string];
  children?: React.ReactNode;
  coverage?: Coverage | '';
}

const coverageText: Record<Coverage, string | undefined> = {
  [Coverage.NOT_COVERED]: t('Uncovered'),
  [Coverage.COVERED]: t('Covered'),
  [Coverage.PARTIAL]: t('Partially Covered'),
  [Coverage.NOT_APPLICABLE]: undefined,
};
const coverageClass: Record<Coverage, string | undefined> = {
  [Coverage.NOT_COVERED]: 'uncovered',
  [Coverage.COVERED]: 'covered',
  [Coverage.PARTIAL]: 'partial',
  [Coverage.NOT_APPLICABLE]: undefined,
};

function ContextLine({line, isActive, children, coverage = ''}: Props) {
  let lineWs = '';
  let lineCode = '';
  if (typeof line[1] === 'string') {
    [, lineWs, lineCode] = line[1].match(/^(\s*)(.*?)$/m)!;
  }

  return (
    <StyledLi
      className={classNames(
        'expandable',
        coverageClass[coverage],
        isActive ? 'active' : ''
      )}
    >
      <LineContent>
        <Tooltip skipWrapper title={coverageText[coverage]} delay={200}>
          <div className="line-number">{line[0]}</div>
        </Tooltip>
        <div>
          <span className="ws">{lineWs}</span>
          <span className="contextline">{lineCode}</span>
        </div>
      </LineContent>
      {children}
    </StyledLi>
  );
}

export default ContextLine;

const StyledLi = styled('li')`
  background: inherit;
  z-index: 1000;
  list-style: none;

  &::marker {
    content: none;
  }

  .line-number {
    display: flex;
    align-items: center;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: end;
    height: 100%;
    text-align: right;
    padding-left: ${space(2)};
    padding-right: ${space(2)};
    margin-right: ${space(1.5)};
    background: transparent;
    z-index: 1;
    min-width: 58px;
    border-right-style: solid;
    border-right-color: transparent;
    user-select: none;
  }

  &.covered .line-number {
    background: ${p => p.theme.green100};
  }

  &.uncovered .line-number {
    background: ${p => p.theme.red100};
    border-right-color: ${p => p.theme.red300};
  }

  &.partial .line-number {
    background: ${p => p.theme.yellow100};
    border-right-style: dashed;
    border-right-color: ${p => p.theme.yellow300};
  }

  &.active {
    background: ${p => p.theme.stacktraceActiveBackground};
    color: ${p => p.theme.stacktraceActiveText};
  }

  &.active.partial .line-number {
    mix-blend-mode: screen;
    background: ${p => p.theme.yellow200};
  }

  &.active.covered .line-number {
    mix-blend-mode: screen;
    background: ${p => p.theme.green200};
  }

  &.active.uncovered .line-number {
    mix-blend-mode: screen;
    background: ${p => p.theme.red300};
  }
`;

// TODO(scttcper): The parent component should be a grid, currently has too many other children
// If the grid was higher up we wouldn't have to hardcode the line number width and could fit larger line numbers
const lineNumberWidth = '58px';
const padding = space(2);
const LineContent = styled('div')`
  display: grid;
  grid-template-columns: ${lineNumberWidth} calc(100% - ${lineNumberWidth} - ${padding});
  gap: ${space(0.5)};
`;
