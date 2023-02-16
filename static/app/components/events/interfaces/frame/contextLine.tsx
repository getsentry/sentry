import styled from '@emotion/styled';
import classNames from 'classnames';

import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';

interface Props {
  colorClass: string;
  isActive: boolean;
  line: [lineNo: number, content: string];
  children?: React.ReactNode;
  className?: string;
}

function ContextLine({line, isActive, children, className, colorClass}: Props) {
  let lineWs = '';
  let lineCode = '';
  if (typeof line[1] === 'string') {
    [, lineWs, lineCode] = line[1].match(/^(\s*)(.*?)$/m)!;
  }
  const hasCoverage = colorClass !== '';

  return (
    <StyledLi
      className={classNames(
        className,
        'expandable',
        hasCoverage ? colorClass : {active: isActive}
      )}
      key={line[0]}
    >
      <LineContent>
        {/* TODO: not use classname as title */}
        <Tooltip skipWrapper title={colorClass} delay={200}>
          <div className="lineNo">{line[0]}</div>
        </Tooltip>
        <div style={{flexGrow: 1}}>
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

  .lineNo {
    display: flex;
    align-items: center;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: center;
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

  &.covered .lineNo {
    background: ${p => p.theme.green100};
  }

  &.uncovered .lineNo {
    background: ${p => p.theme.red100};
    border-right-color: ${p => p.theme.red300};
  }

  &.partial .lineNo {
    background: ${p => p.theme.yellow100};
    border-right-style: dashed;
    border-right-color: ${p => p.theme.yellow300};
  }

  &.active {
    background: ${p => p.theme.stacktraceActiveBackground};
    color: ${p => p.theme.stacktraceActiveText};
  }

  &.active.partial .lineNo {
    mix-blend-mode: screen;
    background: ${p => p.theme.yellow200};
  }

  &.active.covered .lineNo {
    mix-blend-mode: screen;
    background: ${p => p.theme.green200};
  }

  &.active.uncovered .lineNo {
    mix-blend-mode: screen;
    background: ${p => p.theme.red200};
  }
`;

const LineContent = styled('div')`
  display: grid;
  grid-template-columns: 58px 1fr;
`;
