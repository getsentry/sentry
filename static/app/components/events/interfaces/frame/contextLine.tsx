import {Fragment} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

const Context = styled('div')`
  display: inline;
`;

interface Props {
  isActive: boolean;
  line: [number, string];
  children?: React.ReactNode;
  className?: string;
}

const ContextLine = function (props: Props) {
  const {line, isActive, className} = props;
  let lineWs = '';
  let lineCode = '';
  if (typeof line[1] === 'string') {
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
