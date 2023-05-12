import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';

const ScrollableTabs = styled(NavTabs)`
  display: flex;
  flex-wrap: nowrap;
  overflow-y: hidden;
  overflow-x: auto;
  white-space: nowrap;
  margin-bottom: 0;
`;

export default ScrollableTabs;
