import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {BuildDetailsSidebarAppInfo} from 'sentry/views/preprod/sidebar/buildDetailsSidebarAppInfo';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

interface BuildDetailsSidebarContentProps {
  artifactId: string;
  buildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError>;
  projectId: string;
}

export function BuildDetailsSidebarContent(props: BuildDetailsSidebarContentProps) {
  const {
    data: buildDetailsData,
    isPending: isBuildDetailsPending,
    isError: isBuildDetailsError,
    error: buildDetailsError,
  } = props.buildDetailsQuery;

  if (isBuildDetailsPending) {
    return (
      <SidebarContainer>
        <LoadingIndicator />
      </SidebarContainer>
    );
  }

  if (isBuildDetailsError) {
    return (
      <SidebarContainer>
        <Alert type="error">{buildDetailsError?.message}</Alert>
      </SidebarContainer>
    );
  }

  if (!buildDetailsData) {
    return (
      <SidebarContainer>
        <Alert type="error">No build details found</Alert>
      </SidebarContainer>
    );
  }

  return (
    <SidebarContainer>
      {/* App info */}
      <BuildDetailsSidebarAppInfo
        appInfo={buildDetailsData.app_info}
        sizeInfo={buildDetailsData.size_info}
        projectId={props.projectId}
        artifactId={props.artifactId}
      />

      {/* TODO: VCS info */}
    </SidebarContainer>
  );
}

const SidebarContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
`;
