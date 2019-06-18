import styled from 'react-emotion';

import space from 'app/styles/space';

const Layout = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
  grid-template-areas: 'release-name stats new-count last-event';

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 3fr 1fr 1fr;
    grid-template-areas: 'release-name new-count last-event';
  }
`;

const VersionColumn = styled('div')`
  grid-area: release-name;
  overflow: hidden;
`;
const StatsColumn = styled('div')`
  grid-area: stats;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;
const CountColumn = styled('div')`
  grid-area: new-count;
`;
const LastEventColumn = styled('div')`
  grid-area: last-event;
`;
export {Layout, VersionColumn, StatsColumn, CountColumn, LastEventColumn};
