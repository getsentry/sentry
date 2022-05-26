import {Fragment} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {defined} from 'sentry/utils';

const Context = styled('div')`
  display: inline;
`;

type Props = {
  isActive: boolean;
  line: [number, string];
  className?: string;
} & React.ComponentProps<typeof Fragment>;

const ContextLine = function (props: Props) {
  const {line, isActive, className} = props;
  let lineWs = '';
  let lineCode = '';
  if (defined(line[1]) && line[1].match) {
    [, lineWs, lineCode] = line[1].match(/^(\s*)(.*?)$/m)!;
  }
  const Component = !props.children ? Fragment : Context;
  return (
    <li className={classNames(className, 'expandable', {active: isActive})} key={line[0]}>
      <Component>
        <span className="ws">{lineWs}</span>
        <span className="contextline">{lineCode}</span>
      </Component>
      {props.children}
    </li>
  );
};

export default ContextLine;
