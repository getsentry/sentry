import styled from '@emotion/styled';

import space from 'app/styles/space';

const Layout = styled('div')`
  display: grid;
  grid-template-columns: 1.25fr 1fr minmax(0, 1fr) 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
  grid-template-areas: 'release-name stats projects new-count last-event';

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 2fr minmax(0, 2fr) 1fr;
    grid-template-areas: 'release-name projects new-count';
  }
`;

const VersionColumn = styled('div')`
  grid-area: release-name;
  overflow: hidden;
`;
const ProjectsColumn = styled('div')`
  grid-area: projects;
  font-size: ${p => p.theme.fontSizeMedium};
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

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;
export {Layout, VersionColumn, ProjectsColumn, StatsColumn, CountColumn, LastEventColumn};
