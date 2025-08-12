import {useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Flex} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconClose, IconGrid, IconSearch} from 'sentry/icons';
import {IconGraphCircle} from 'sentry/icons/iconGraphCircle';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useQueryParamState} from 'sentry/utils/url/useQueryParamState';
import {AppSizeInsights} from 'sentry/views/preprod/buildDetails/main/insights/appSizeInsights';
import {AppSizeCategories} from 'sentry/views/preprod/components/visualizations/appSizeCategories';
import {AppSizeTreemap} from 'sentry/views/preprod/components/visualizations/appSizeTreemap';
import type {AppSizeApiResponse} from 'sentry/views/preprod/types/appSizeTypes';
import {processInsights} from 'sentry/views/preprod/utils/insightProcessing';
import {filterTreemapElement} from 'sentry/views/preprod/utils/treemapFiltering';

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
  const [searchQuery, setSearchQuery] = useQueryParamState<string>({
    fieldName: 'search',
  });

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

  // Filter data based on search query
  const filteredTreemapData = {
    ...appSizeData.treemap,
    root: filterTreemapElement(appSizeData.treemap.root, searchQuery || ''),
  };

  let visualizationContent: React.ReactNode;
  if (categoriesEnabled) {
    visualizationContent =
      selectedContent === 'treemap' ? (
        <AppSizeTreemap root={filteredTreemapData.root} searchQuery={searchQuery || ''} />
      ) : (
        <AppSizeCategories treemapData={appSizeData.treemap} />
      );
  } else {
    visualizationContent = (
      <AppSizeTreemap root={filteredTreemapData.root} searchQuery={searchQuery || ''} />
    );
  }

  return (
    <Flex direction="column" gap="lg" minHeight="700px">
      <Flex align="center" gap="md">
        {categoriesEnabled && (
          <SegmentedControl
            value={selectedContent}
            onChange={value => {
              setSelectedContent(value);
            }}
          >
            <SegmentedControl.Item key="treemap" icon={<IconGrid />} />
            <SegmentedControl.Item key="categories" icon={<IconGraphCircle />} />
          </SegmentedControl>
        )}
        {selectedContent === 'treemap' && (
          <InputGroup style={{width: '100%'}}>
            <InputGroup.LeadingItems>
              <IconSearch />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              placeholder="Search files"
              value={searchQuery || ''}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <InputGroup.TrailingItems>
                <Button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  borderless
                  size="zero"
                >
                  <IconClose size="sm" />
                </Button>
              </InputGroup.TrailingItems>
            )}
          </InputGroup>
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
