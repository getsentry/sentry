import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';

interface GroupContentSkeletonProps {
  hasEvent?: boolean;
  hasGroup?: boolean;
}

/**
 * Shows skeleton content for individual sections that are loading within the GroupDetails page
 */
export function GroupContentSkeleton({hasEvent, hasGroup}: GroupContentSkeletonProps) {
  return (
    <SkeletonContainer>
      {/* Header skeleton */}
      {!hasGroup && (
        <HeaderSkeleton>
          <Placeholder height="32px" width="60%" />
          <Placeholder height="20px" width="40%" />
        </HeaderSkeleton>
      )}

      {/* Event navigation skeleton */}
      {!hasEvent && (
        <NavigationSkeleton>
          <Placeholder height="24px" width="80px" />
          <Placeholder height="24px" width="100px" />
          <Placeholder height="24px" width="90px" />
        </NavigationSkeleton>
      )}

      {/* Main content skeleton */}
      <ContentSkeleton>
        <Placeholder height="200px" />
        <VerticalSpacing />
        <Placeholder height="150px" />
        <VerticalSpacing />
        <Placeholder height="300px" />
      </ContentSkeleton>
    </SkeletonContainer>
  );
}

const SkeletonContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const HeaderSkeleton = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  padding: ${space(3)} 0;
`;

const NavigationSkeleton = styled('div')`
  display: flex;
  gap: ${space(2)};
  padding: ${space(2)} 0;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ContentSkeleton = styled('div')`
  display: flex;
  flex-direction: column;
`;

const VerticalSpacing = styled('div')`
  height: ${space(3)};
`;
