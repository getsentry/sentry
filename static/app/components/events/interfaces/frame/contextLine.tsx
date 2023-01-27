import {Fragment} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

interface Props {
  colorClass: string;
  isActive: boolean;
  line: [number, string];
  children?: React.ReactNode;
  className?: string;
}

const ContextLine = function ({line, isActive, children, className, colorClass}: Props) {
  let lineWs = '';
  let lineCode = '';
  if (typeof line[1] === 'string') {
    [, lineWs, lineCode] = line[1].match(/^(\s*)(.*?)$/m)!;
  }
  const Component = !children ? Fragment : Context;
  const hasCoverage = colorClass !== '';

  return (
    <li
      className={classNames(
        className,
        'expandable',
        hasCoverage ? colorClass : {active: isActive}
      )}
      key={line[0]}
    >
      <Component>
        <span className="ws">{lineWs}</span>
        <span className="contextline">{lineCode}</span>
      </Component>
      {children}
    </li>
  );
};

export default ContextLine;

const Context = styled('div')`
  display: inline;
`;
