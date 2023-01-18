import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {Color} from 'sentry/utils/theme';

interface Props {
  color: Color | 'transparent';
  isActive: boolean;
  line: [number, string];
  children?: React.ReactNode;
  className?: string;
}

const ContextLine = function ({line, isActive, children, className, color}: Props) {
  let lineWs = '';
  let lineCode = '';
  if (typeof line[1] === 'string') {
    [, lineWs, lineCode] = line[1].match(/^(\s*)(.*?)$/m)!;
  }
  const Component = !children ? Fragment : Context;
  const theme = useTheme();
  return (
    <li
      className={classNames(className, 'expandable', {active: isActive})}
      key={line[0]}
      style={{backgroundColor: theme[color]}}
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
