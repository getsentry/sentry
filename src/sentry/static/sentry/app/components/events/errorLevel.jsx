import styled from 'react-emotion';

const DEFAULT_SIZE = '13px';

function getLevelColor({level, theme}) {
  const COLORS = {
    error: theme.orange,
    info: theme.blue,
    warning: theme.yellowOrange,
    fatal: theme.red,
    sample: theme.purple,
  };

  return `background-color: ${COLORS[level] || theme.orange};`;
}

const ErrorLevel = styled('span')`
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
