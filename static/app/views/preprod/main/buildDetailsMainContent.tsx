import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AppSizeTreemap} from 'sentry/views/preprod/main/appSizeTreemap';
import type {AppSizeApiResponse} from 'sentry/views/preprod/types/appSizeTypes';

type BuildDetailsMainContentError = {error: string; status: 'error'};
type BuildDetailsMainContentLoading = {status: 'loading'};
type BuildDetailsMainContentSuccess = {
  appSizeData: AppSizeApiResponse;
  status: 'success';
};

export type BuildDetailsMainContentProps =
  | BuildDetailsMainContentError
  | BuildDetailsMainContentLoading
  | BuildDetailsMainContentSuccess;

export function BuildDetailsMainContent(props: BuildDetailsMainContentProps) {
  const {status} = props;

  if (status === 'loading') {
    return <LoadingIndicator />;
  }

  if (status === 'error') {
    return <Alert type="error">{props.error}</Alert>;
  }

  const {appSizeData} = props;

  return (
    <MainContentContainer>
      <AppSizeTreemap treemapData={appSizeData.treemap} />
    </MainContentContainer>
  );
}

const MainContentContainer = styled('div')`
  width: 100%;
  height: 508px;
`;
