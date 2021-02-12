import styled from '@emotion/styled';

import bgPattern from 'sentry-images/pattern-geometric.svg';

import space from 'app/styles/space';

const PatternHeader = styled('div')`
  margin: -${space(4)} -${space(4)} 0 -${space(4)};
  border-radius: 7px 7px 0 0;
  background: url(${bgPattern}) 200px/200px repeat;
  overflow: hidden;
  height: 156px;
`;

export default PatternHeader;
