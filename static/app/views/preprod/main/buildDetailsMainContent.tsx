import {useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Flex} from 'sentry/components/core/layout';
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
      <Flex direction="column" gap="lg" minHeight="700px">
        <LoadingIndicator />
      </Flex>
    );
  }

  if (isAppSizeError) {
    return (
      <Flex direction="column" gap="lg" minHeight="700px">
        <Alert type="error">{appSizeError?.message}</Alert>
      </Flex>
    );
  }

  if (!appSizeData) {
    return (
      <Flex direction="column" gap="lg" minHeight="700px">
        <Alert type="error">No app size data found</Alert>
      </Flex>
    );
  }

  const totalSize = appSizeData.treemap.root.size || 0;
  const processedInsights =
    appSizeData.insights && totalSize > 0
      ? processInsights(appSizeData.insights, totalSize)
      : [];

  const categoriesEnabled =
    appSizeData.treemap.category_breakdown &&
    Object.keys(appSizeData.treemap.category_breakdown).length > 0;

  let visualizationContent: React.ReactNode;
  if (categoriesEnabled) {
    visualizationContent =
      selectedContent === 'treemap' ? (
        <AppSizeTreemap treemapData={appSizeData.treemap} />
      ) : (
        <AppSizeCategories treemapData={appSizeData.treemap} />
      );
  } else {
    visualizationContent = <AppSizeTreemap treemapData={appSizeData.treemap} />;
  }

  return (
    <Flex direction="column" gap="lg" minHeight="700px">
      <Flex align="center" gap="md">
        {categoriesEnabled && (
          <SegmentedControl
            value={selectedContent}
            onChange={value => setSelectedContent(value)}
          >
            <SegmentedControl.Item key="treemap" icon={<IconGrid />} />
            <SegmentedControl.Item key="categories" icon={<IconGraphCircle />} />
          </SegmentedControl>
        )}
      </Flex>
      <ChartContainer>{visualizationContent}</ChartContainer>
      {processedInsights.length > 0 && (
        <AppSizeInsights processedInsights={processedInsights} />
      )}
    </Flex>
  );
}

const ChartContainer = styled('div')`
  width: 100%;
  height: 508px;
`;
