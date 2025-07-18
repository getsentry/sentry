import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {BuildDetailsSidebarAppInfo} from 'sentry/views/preprod/sidebar/buildDetailsSidebarAppInfo';
import {type BuildDetails} from 'sentry/views/preprod/types';

interface BuildDetailsSidebarContentProps {
  buildDetails: BuildDetails | null;
  error: string | null;
  isLoading: boolean;
}

export function BuildDetailsSidebarContent({
  buildDetails,
  isLoading,
  error,
}: BuildDetailsSidebarContentProps) {
  if (isLoading) {
    return (
      <SidebarContainer>
        <LoadingIndicator />
      </SidebarContainer>
    );
  }

  if (error) {
    return (
      <SidebarContainer>
        <Alert type="error" showIcon>
          {error}
        </Alert>
      </SidebarContainer>
    );
  }

  if (!buildDetails) {
    return (
      <SidebarContainer>
        <Alert type="warning" showIcon>
          {t('No build details available')}
        </Alert>
      </SidebarContainer>
    );
  }

  const {app_info, state} = buildDetails;

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
