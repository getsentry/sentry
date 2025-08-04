import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Container} from 'sentry/components/core/layout';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {AppSizeTreemap} from 'sentry/views/preprod/main/appSizeTreemap';
import {AppSizeInsights} from 'sentry/views/preprod/main/insights/appSizeInsights';
import type {AppSizeApiResponse} from 'sentry/views/preprod/types/appSizeTypes';
import {processInsights} from 'sentry/views/preprod/utils/insightProcessing';

interface BuildDetailsMainContentProps {
  appSizeQuery: UseApiQueryResult<AppSizeApiResponse, RequestError>;
}

export function BuildDetailsMainContent(props: BuildDetailsMainContentProps) {
  const {
    data: appSizeData,
    isPending: isAppSizePending,
    isError: isAppSizeError,
    error: appSizeError,
  } = props.appSizeQuery;

  if (isAppSizePending) {
    return (
      <MainContentContainer>
        <LoadingIndicator />
      </MainContentContainer>
    );
  }

  if (isAppSizeError) {
    return (
      <MainContentContainer>
        <Alert type="error">{appSizeError?.message}</Alert>
      </MainContentContainer>
    );
  }

  if (!appSizeData) {
    return (
      <MainContentContainer>
        <Alert type="error">No app size data found</Alert>
      </MainContentContainer>
    );
  }

  const totalSize = appSizeData.treemap.root.size || 0;
  const processedInsights =
    appSizeData.insights && totalSize > 0
      ? processInsights(appSizeData.insights, totalSize)
      : [];

  return (
    <MainContentContainer>
      <TreemapContainer>
        <AppSizeTreemap treemapData={appSizeData.treemap} />
      </TreemapContainer>
      {processedInsights.length > 0 && (
        <Container style={{marginTop: '20px'}}>
          <AppSizeInsights processedInsights={processedInsights} />
        </Container>
      )}
    </MainContentContainer>
  );
}

const MainContentContainer = styled('div')`
  width: 100%;
`;

const TreemapContainer = styled('div')`
  width: 100%;
  height: 508px;
`;
