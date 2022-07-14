import styled from '@emotion/styled';

import space from 'sentry/styles/space';

export const SIDEBAR_MIN_WIDTH = 325;
export const TOPBAR_MIN_HEIGHT = 325;

const PageColumn = styled('section')`
  display: flex;
  flex-grow: 1;
  flex-wrap: nowrap;
  flex-direction: column;
`;

export const PageRow = styled(PageColumn)`
  flex-direction: row;
`;

export const TimelineSection = styled(PageColumn)`
  flex-grow: 0;
`;

export const ContentSection = styled(PageColumn)`
  flex-grow: 3; /* Higher growth than SidebarSection or TopVideoSection */

  height: 100%;
  min-height: 300px;
  width: 100%;
`;

export const VideoSection = styled(PageColumn)`
  height: 100%;
  flex-grow: 2;
`;

export const BreadcrumbSection = styled(PageColumn)``;

export const SidebarSection = styled(PageColumn)`
  min-width: ${SIDEBAR_MIN_WIDTH}px;
`;

export const TopbarSection = styled(PageRow)`
  height: ${TOPBAR_MIN_HEIGHT}px;
  min-height: ${TOPBAR_MIN_HEIGHT}px;

  ${BreadcrumbSection} {
    max-width: ${SIDEBAR_MIN_WIDTH}px;
    margin-left: ${space(2)};
  }
`;
