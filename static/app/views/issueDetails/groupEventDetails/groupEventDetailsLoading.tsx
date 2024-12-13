import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import {useUser} from 'sentry/utils/useUser';

/**
 * Do not import more things into this component since it is used in routes.ts
 */
export function GroupEventDetailsLoading() {
  const user = useUser();

  /**
   * Not using useHasStreamlinedUI because we want to limit modules imported
   * in routes.ts
   */
  if (!user?.options?.prefersIssueDetailsStreamlinedUI) {
    return <LoadingIndicator />;
  }

  return (
    <div>
      <LoadingGroupContent>
        <LoadingHeader>
          <Flex align="center" gap={space(1)}>
            <Placeholder width="100px" height="22px" />
            <Placeholder width="100px" height="22px" />
          </Flex>
          <Flex align="center" gap={space(1)}>
            <Placeholder width="80px" height="22px" />
            <Placeholder width="80px" height="22px" />
            <Placeholder width="80px" height="22px" />
            <Placeholder width="80px" height="22px" />
            <Placeholder width="80px" height="22px" />
          </Flex>
        </LoadingHeader>
        <LoadingHeader>
          <Placeholder width="100%" height="22px" />
        </LoadingHeader>
        <LoadingHeader>
          <Placeholder width="100%" height="500px" />
        </LoadingHeader>
        <LoadingHeader>
          <Placeholder width="100%" height="120px" />
        </LoadingHeader>
      </LoadingGroupContent>
    </div>
  );
}

const LoadingGroupContent = styled('div')`
  min-height: 90vh;
  border: 1px solid ${p => p.theme.translucentBorder};
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
`;

const LoadingHeader = styled('div')`
  padding: ${space(1.5)} ${space(2)};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.translucentBorder};
  overflow: hidden;
`;
