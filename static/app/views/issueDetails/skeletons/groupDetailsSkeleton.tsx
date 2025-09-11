import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

interface GroupDetailsSkeletonProps {
  hasProject?: boolean;
}

export function GroupDetailsSkeleton({hasProject}: GroupDetailsSkeletonProps) {
  const hasStreamlinedUI = useHasStreamlinedUI();

  if (hasStreamlinedUI) {
    return <StreamlinedSkeleton hasProject={hasProject} />;
  }

  return <LegacySkeleton hasProject={hasProject} />;
}

function StreamlinedSkeleton({hasProject}: {hasProject?: boolean}) {
  return (
    <StreamlinedContainer>
      {/* Header */}
      <HeaderSkeleton>
        <Placeholder height="40px" width="300px" />
        <HeaderActions>
          <Placeholder height="32px" width="80px" />
          <Placeholder height="32px" width="100px" />
          <Placeholder height="32px" width="120px" />
        </HeaderActions>
      </HeaderSkeleton>

      {/* Main Content Area */}
      <ContentWrapper>
        <MainContent>
          {/* Event Details Header */}
          <EventHeaderSkeleton>
            <Placeholder height="24px" width="60%" />
            <Placeholder height="16px" width="40%" />
          </EventHeaderSkeleton>

          {/* Navigation */}
          <NavigationSkeleton>
            <Placeholder height="20px" width="80px" />
            <Placeholder height="20px" width="100px" />
            <Placeholder height="20px" width="90px" />
          </NavigationSkeleton>

          {/* Content Area */}
          <ContentAreaSkeleton>
            <Placeholder height="200px" />
            <VerticalSpacing />
            <Placeholder height="300px" />
          </ContentAreaSkeleton>
        </MainContent>

        {/* Sidebar */}
        <SidebarSkeleton>
          <Placeholder height="150px" />
          <VerticalSpacing />
          <Placeholder height="100px" />
          <VerticalSpacing />
          <Placeholder height="120px" />
        </SidebarSkeleton>
      </ContentWrapper>
    </StreamlinedContainer>
  );
}

function LegacySkeleton({hasProject}: {hasProject?: boolean}) {
  return (
    <LegacyContainer>
      {/* Header */}
      <HeaderSkeleton>
        <Placeholder height="40px" width="300px" />
        <HeaderActions>
          <Placeholder height="32px" width="80px" />
          <Placeholder height="32px" width="100px" />
          <Placeholder height="32px" width="120px" />
        </HeaderActions>
      </HeaderSkeleton>

      {/* Tabs */}
      <TabsSkeleton>
        <Placeholder height="24px" width="80px" />
        <Placeholder height="24px" width="100px" />
        <Placeholder height="24px" width="90px" />
        <Placeholder height="24px" width="110px" />
      </TabsSkeleton>

      {/* Content */}
      <ContentAreaSkeleton>
        <Placeholder height="200px" />
        <VerticalSpacing />
        <Placeholder height="300px" />
        <VerticalSpacing />
        <Placeholder height="200px" />
      </ContentAreaSkeleton>
    </LegacyContainer>
  );
}

// Styled Components
const StreamlinedContainer = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: ${p => p.theme.background};
`;

const LegacyContainer = styled('div')`
  padding: ${space(3)};
`;

const HeaderSkeleton = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(2)} ${space(3)};
  border-bottom: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.backgroundSecondary};
`;

const HeaderActions = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const ContentWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr 325px;
  flex: 1;
  background-color: ${p => p.theme.background};

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    display: flex;
    flex-direction: column;
  }
`;

const MainContent = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  border-right: 1px solid ${p => p.theme.translucentBorder};

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    border-right: none;
    border-bottom: 1px solid ${p => p.theme.translucentBorder};
  }
`;

const EventHeaderSkeleton = styled('div')`
  padding: ${space(3)} ${space(4)};
  border-bottom: 1px solid ${p => p.theme.border};

  & > div:first-child {
    margin-bottom: ${space(1)};
  }
`;

const NavigationSkeleton = styled('div')`
  display: flex;
  gap: ${space(2)};
  padding: ${space(2)} ${space(4)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const TabsSkeleton = styled('div')`
  display: flex;
  gap: ${space(3)};
  padding: ${space(2)} ${space(3)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ContentAreaSkeleton = styled('div')`
  padding: ${space(3)} ${space(4)};
`;

const SidebarSkeleton = styled('div')`
  padding: ${space(3)};
  background-color: ${p => p.theme.background};
`;

const VerticalSpacing = styled('div')`
  height: ${space(3)};
`;
