import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import {BuildDetailsSidebarStatusCheck} from 'sentry/views/preprod/buildDetails/sidebar/buildDetailsSidebarStatusCheck';
import {BuildVcsInfo} from 'sentry/views/preprod/components/buildVcsInfo';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {BuildDetailsState} from 'sentry/views/preprod/types/buildDetailsTypes';

interface BuildDetailsSidebarContentProps {
  buildDetailsData?: BuildDetailsApiResponse | null;
  isBuildDetailsPending?: boolean;
}

export function BuildDetailsSidebarContent(props: BuildDetailsSidebarContentProps) {
  const {buildDetailsData, isBuildDetailsPending = false} = props;

  if (isBuildDetailsPending || !buildDetailsData) {
    return <SidebarLoadingSkeleton data-testid="sidebar-loading-skeleton" />;
  }

  /* Status check info + VCS info - only show when artifact is processed */
  if (buildDetailsData.state !== BuildDetailsState.PROCESSED) {
    return null;
  }

  return (
    <Stack gap="2xl">
      {/* Status check info */}
      {buildDetailsData.posted_status_checks?.size && (
        <BuildDetailsSidebarStatusCheck
          statusCheck={buildDetailsData.posted_status_checks.size}
          vcsInfo={buildDetailsData.vcs_info}
        />
      )}

      <BuildVcsInfo buildDetailsData={buildDetailsData} />
    </Stack>
  );
}

function SidebarLoadingSkeleton(props: {['data-testid']: string}) {
  const theme = useTheme();
  return (
    <Stack gap="2xl" {...props}>
      {/* VCS info skeleton - matches KeyValueTableCard structure */}
      <SkeletonCard>
        <Placeholder
          width="80px"
          height="18px"
          style={{marginBottom: theme.space['2xl']}}
        />
        <Stack gap="md">
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
        </Stack>
      </SkeletonCard>
    </Stack>
  );
}

const SkeletonCard = styled('div')`
  padding: ${p => p.theme.space['2xl']};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 6px;
  background: ${p => p.theme.tokens.background.secondary};
`;
