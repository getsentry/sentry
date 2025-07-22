import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import {BuildDetailsSidebarAppInfo} from 'sentry/views/preprod/sidebar/buildDetailsSidebarAppInfo';
import {type BuildDetailsApiResponse} from 'sentry/views/preprod/types';

type BuildDetailsSidebarError = {error: string; status: 'error'};
type BuildDetailsSidebarLoading = {status: 'loading'};
type BuildDetailsSidebarSuccess = {
  buildDetails: BuildDetailsApiResponse;
  status: 'success';
};

export type BuildDetailsSidebarContentProps =
  | BuildDetailsSidebarError
  | BuildDetailsSidebarLoading
  | BuildDetailsSidebarSuccess;

export function BuildDetailsSidebarContent(props: BuildDetailsSidebarContentProps) {
  const {status} = props;

  if (status === 'loading') {
    return (
      <SidebarContainer>
        <LoadingIndicator />
      </SidebarContainer>
    );
  }

  if (status === 'error') {
    return (
      <SidebarContainer>
        <Alert type="error">{props.error}</Alert>
      </SidebarContainer>
    );
  }

  const {app_info, state} = props.buildDetails;

  return (
    <SidebarContainer>
      {/* App info */}
      <BuildDetailsSidebarAppInfo
        appInfo={app_info}
        state={state}
        // TODO: Get from size data when available
        installSizeBytes={1000000}
        downloadSizeBytes={1000000}
      />

      {/* TODO: VCS info */}
    </SidebarContainer>
  );
}

const SidebarContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;
