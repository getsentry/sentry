import {useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Container} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconGrid} from 'sentry/icons';
import {IconGraphCircle} from 'sentry/icons/iconGraphCircle';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {AppSizeCategories} from 'sentry/views/preprod/components/visualizations/appSizeCategories';
import {AppSizeTreemap} from 'sentry/views/preprod/components/visualizations/appSizeTreemap';
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

  const [selectedContent, setSelectedContent] = useState<'treemap' | 'categories'>(
    'treemap'
  );

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

  const content =
    selectedContent === 'treemap' ? (
      <AppSizeTreemap treemapData={appSizeData.treemap} />
    ) : (
      <AppSizeCategories treemapData={appSizeData.treemap} />
    );

  return (
    <MainContentContainer>
      <TreemapContainer>
        <MainContentControls>
          <SegmentedControl
            value={selectedContent}
            onChange={value => setSelectedContent(value)}
          >
            <SegmentedControl.Item key="treemap" icon={<IconGrid />} />
            <SegmentedControl.Item key="categories" icon={<IconGraphCircle />} />
          </SegmentedControl>
        </MainContentControls>
        {content}
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
  height: 700px;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
`;

const MainContentControls = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.lg};
`;

const TreemapContainer = styled('div')`
  width: 100%;
  height: 508px;
`;
