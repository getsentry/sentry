import styled from 'react-emotion';

import space from 'app/styles/space';

function getLevelColor({level, theme}) {
  const COLORS = {
    error: theme.orange,
    info: theme.blue,
    warning: theme.yellowOrange,
    fatal: theme.red,
    sample: theme.purple,
  };

  return `background-color: ${COLORS[level] || theme.orange}`;
}

const ErrorLevel = styled('span')`
  padding: 0;
  margin-right: ${space(1)};
  position: relative;
  width: 13px;
  height: 13px;
  text-indent: -9999em;
  display: inline-block;
  border-radius: 15px;
  flex-shrink: 0;

  ${getLevelColor}
`;

export default ErrorLevel;
