import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';
import {BuildDetailsSidebarAppInfo} from 'sentry/views/preprod/buildDetails/sidebar/buildDetailsSidebarAppInfo';
import {BuildVcsInfo} from 'sentry/views/preprod/components/buildVcsInfo';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {BuildDetailsState} from 'sentry/views/preprod/types/buildDetailsTypes';

interface BuildDetailsSidebarContentProps {
  artifactId: string;
  projectId: string | null;
  buildDetailsData?: BuildDetailsApiResponse | null;
  isBuildDetailsPending?: boolean;
}

export function BuildDetailsSidebarContent(props: BuildDetailsSidebarContentProps) {
  const {buildDetailsData, isBuildDetailsPending = false, artifactId, projectId} = props;

  if (isBuildDetailsPending || !buildDetailsData) {
    return <SidebarLoadingSkeleton data-testid="sidebar-loading-skeleton" />;
  }

  return (
    <Flex direction="column" gap="2xl">
      {/* App info - only show when artifact is processed */}
      {buildDetailsData.state === BuildDetailsState.PROCESSED && (
        <BuildDetailsSidebarAppInfo
          appInfo={buildDetailsData.app_info}
          projectId={projectId}
          artifactId={artifactId}
        />
      )}

      {/* VCS info */}
      <BuildVcsInfo buildDetailsData={buildDetailsData} projectId={projectId} />
    </Flex>
  );
}

function SidebarLoadingSkeleton(props: {['data-testid']: string}) {
  return (
    <Flex direction="column" gap="2xl" {...props}>
      {/* App info skeleton - matches BuildDetailsSidebarAppInfo structure */}
      <Flex direction="column" gap="xl">
        {/* App icon and name */}
        <Flex align="center" gap="sm">
          <Placeholder width="40px" height="40px" style={{borderRadius: '8px'}} />
          <Placeholder width="120px" height="24px" />
        </Flex>

        {/* Additional info */}
        <Flex direction="column" gap="xs">
          <Flex align="center" gap="xs">
            <Placeholder width="16px" height="16px" />
            <Placeholder width="100px" height="16px" />
          </Flex>
          <Flex align="center" gap="xs">
            <Placeholder width="16px" height="16px" />
            <Placeholder width="120px" height="16px" />
          </Flex>
        </Flex>

        {/* Install button */}
        <Placeholder width="80px" height="32px" style={{borderRadius: '4px'}} />
      </Flex>

      {/* VCS info skeleton - matches KeyValueData.Card structure */}
      <SkeletonCard>
        <Placeholder width="80px" height="18px" style={{marginBottom: space(3)}} />
        <Flex direction="column" gap="md">
          <Flex justify="between">
            <Placeholder width="40px" height="14px" />
            <Placeholder width="100px" height="14px" />
          </Flex>
          <Flex justify="between">
            <Placeholder width="60px" height="14px" />
            <Placeholder width="120px" height="14px" />
          </Flex>
          <Flex justify="between">
            <Placeholder width="70px" height="14px" />
            <Placeholder width="50px" height="14px" />
          </Flex>
          <Flex justify="between">
            <Placeholder width="50px" height="14px" />
            <Placeholder width="90px" height="14px" />
          </Flex>
          <Flex justify="between">
            <Placeholder width="80px" height="14px" />
            <Placeholder width="70px" height="14px" />
          </Flex>
          <Flex justify="between">
            <Placeholder width="80px" height="14px" />
            <Placeholder width="140px" height="14px" />
          </Flex>
        </Flex>
      </SkeletonCard>
    </Flex>
  );
}

const SkeletonCard = styled('div')`
  padding: ${space(3)};
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  background: ${p => p.theme.backgroundSecondary};
`;
