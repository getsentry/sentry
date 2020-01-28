import styled from '@emotion/styled';
import {Level} from 'app/types';

const DEFAULT_SIZE = '13px';

function getLevelColor({level = '', theme}) {
  const COLORS = {
    error: theme.orange,
    info: theme.blue,
    warning: theme.yellowOrange,
    fatal: theme.red,
    sample: theme.purple,
  };

  return `background-color: ${COLORS[level] || theme.orange};`;
}

type Props = {
  size?: string;
  level?: Level;
};

const ErrorLevel = styled('span')<Props>`
  padding: 0;
  position: relative;
  width: ${p => p.size || DEFAULT_SIZE};
  height: ${p => p.size || DEFAULT_SIZE};
  text-indent: -9999em;
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;

  ${getLevelColor}
`;

export default ErrorLevel;
