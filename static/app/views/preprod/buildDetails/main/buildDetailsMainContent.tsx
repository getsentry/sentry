import {useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Flex} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import Placeholder from 'sentry/components/placeholder';
import {IconClose, IconGrid, IconSearch} from 'sentry/icons';
import {IconGraphCircle} from 'sentry/icons/iconGraphCircle';
import {t} from 'sentry/locale';
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
  buildDetailsQuery: UseApiQueryResult<any, RequestError>;
}

export function BuildDetailsMainContent(props: BuildDetailsMainContentProps) {
  const {
    data: appSizeData,
    isPending: isAppSizePending,
    isError: isAppSizeError,
    error: appSizeError,
  } = props.appSizeQuery;

  const {isPending: isBuildDetailsPending} = props.buildDetailsQuery;

  const [selectedContent, setSelectedContent] = useState<'treemap' | 'categories'>(
    'treemap'
  );
  const [searchQuery, setSearchQuery] = useQueryParamState<string>({
    fieldName: 'search',
  });

  // Show loading state if either query is pending
  if (isAppSizePending || isBuildDetailsPending) {
    return (
      <Flex direction="column" gap="lg" minHeight="700px">
        {/* Main visualization skeleton */}
        <TreemapLoadingSkeleton />
        {/* Insights skeleton */}
        <Flex direction="column" gap="md">
          <Placeholder width="200px" height="24px" />
          <Flex gap="md">
            <Placeholder width="150px" height="60px" />
            <Placeholder width="150px" height="60px" />
            <Placeholder width="150px" height="60px" />
          </Flex>
        </Flex>
      </Flex>
    );
  }

  // Show an error if the treemap data fetch fails
  // If the main data fetch fails, this component will not be rendered
  if (isAppSizeError) {
    return (
      <Flex direction="column" gap="lg" minHeight="700px">
        <Alert type="error">
          {appSizeError?.message ?? t('The treemap data could not be loaded')}
        </Alert>
      </Flex>
    );
  }

  if (!appSizeData) {
    return (
      <Flex direction="column" gap="lg" minHeight="700px">
        <Alert type="error">{t('The treemap data could not be loaded')}</Alert>
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
  const filteredRoot = filterTreemapElement(
    appSizeData.treemap.root,
    searchQuery || '',
    ''
  );
  const filteredTreemapData = filteredRoot
    ? {
        ...appSizeData.treemap,
        root: filteredRoot,
      }
    : null;

  let visualizationContent: React.ReactNode;
  if (categoriesEnabled) {
    visualizationContent =
      selectedContent === 'treemap' ? (
        filteredTreemapData ? (
          <AppSizeTreemap
            root={filteredTreemapData.root}
            searchQuery={searchQuery || ''}
          />
        ) : (
          <Alert type="info">No files found matching "{searchQuery}"</Alert>
        )
      ) : (
        <AppSizeCategories treemapData={appSizeData.treemap} />
      );
  } else {
    visualizationContent = filteredTreemapData ? (
      <AppSizeTreemap root={filteredTreemapData.root} searchQuery={searchQuery || ''} />
    ) : (
      <Alert type="info">No files found matching "{searchQuery}"</Alert>
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

const TreemapLoadingSkeleton = styled('div')`
  width: 100%;
  height: 508px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 4px;
  position: relative;

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    border: 3px solid #e0e0e0;
    border-top: 3px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    100% {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }
`;
