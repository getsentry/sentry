import {useState, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconClose, IconGrid, IconSearch} from 'sentry/icons';
import {IconGraphCircle} from 'sentry/icons/iconGraphCircle';
import {t} from 'sentry/locale';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useQueryParamState} from 'sentry/utils/url/useQueryParamState';
import {AppSizeInsights} from 'sentry/views/preprod/buildDetails/main/insights/appSizeInsights';
import {BuildError} from 'sentry/views/preprod/components/buildError';
import {BuildProcessing} from 'sentry/views/preprod/components/buildProcessing';
import {AppSizeCategories} from 'sentry/views/preprod/components/visualizations/appSizeCategories';
import {AppSizeLegend} from 'sentry/views/preprod/components/visualizations/appSizeLegend';
import {AppSizeTreemap} from 'sentry/views/preprod/components/visualizations/appSizeTreemap';
import type {
  AppSizeApiResponse,
  TreemapType,
} from 'sentry/views/preprod/types/appSizeTypes';
import {
  BuildDetailsSizeAnalysisState,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {processInsights} from 'sentry/views/preprod/utils/insightProcessing';
import {filterTreemapElement} from 'sentry/views/preprod/utils/treemapFiltering';

interface LoadingContentProps {
  children: ReactNode;
  showSkeleton?: boolean;
}

function LoadingContent({showSkeleton, children}: LoadingContentProps) {
  return (
    <Flex direction="column" gap="lg" minHeight="700px" width="100%">
      <Grid
        columns="1fr"
        rows="1fr"
        areas={`"all"`}
        align="center"
        justify="center"
        style={{position: 'relative', height: '508px'}}
        data-testid="treemap-loading-skeleton"
      >
        {showSkeleton && (
          <Container
            area="all"
            style={{
              width: '100%',
              height: '508px',
            }}
          >
            <Placeholder width="100%" height="508px" />
          </Container>
        )}
        <Flex area="all" direction="column" align="center">
          {children}
        </Flex>
      </Grid>
      {showSkeleton && (
        <Flex direction="column" gap="md">
          <Placeholder width="200px" height="24px" />
          <Flex gap="md">
            <Placeholder width="150px" height="60px" />
            <Placeholder width="150px" height="60px" />
            <Placeholder width="150px" height="60px" />
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}

interface BuildDetailsMainContentProps {
  appSizeQuery: UseApiQueryResult<AppSizeApiResponse, RequestError>;
  buildDetailsData?: BuildDetailsApiResponse | null;
  isBuildDetailsPending?: boolean;
}

export function BuildDetailsMainContent(props: BuildDetailsMainContentProps) {
  const {appSizeQuery, buildDetailsData, isBuildDetailsPending = false} = props;
  const {
    data: appSizeData,
    isPending: isAppSizePending,
    isError: isAppSizeError,
    error: appSizeError,
  } = appSizeQuery;

  // If the main data fetch fails, this component will not be rendered
  // so we don't handle 'isBuildDetailsError'.

  const [selectedContentParam, setSelectedContentParam] = useQueryParamState<
    'treemap' | 'categories'
  >({
    fieldName: 'view',
  });
  const selectedContent =
    selectedContentParam === 'treemap' || selectedContentParam === 'categories'
      ? selectedContentParam
      : 'treemap';

  const handleContentChange = (value: 'treemap' | 'categories') => {
    setSelectedContentParam(value === 'treemap' ? undefined : value);
  };
  const [searchQuery, setSearchQuery] = useQueryParamState<string>({
    fieldName: 'search',
  });

  const [selectedCategories, setSelectedCategories] = useState<Set<TreemapType>>(
    new Set()
  );

  const handleToggleCategory = (category: TreemapType) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const sizeInfo = buildDetailsData?.size_info;

  // We have two requests:
  // - one for the build details (buildDetailsQuery)
  // - one for the actual size data (appSizeQuery)

  const isLoadingRequests = isAppSizePending || isBuildDetailsPending;
  const isSizePending = sizeInfo?.state === BuildDetailsSizeAnalysisState.PENDING;
  const isSizeProcessing = sizeInfo?.state === BuildDetailsSizeAnalysisState.PROCESSING;
  const isSizeNotStarted = sizeInfo === undefined;
  const isSizeFailed = sizeInfo?.state === BuildDetailsSizeAnalysisState.FAILED;

  const showNoSizeRequested = !isLoadingRequests && isSizeNotStarted;

  if (isLoadingRequests) {
    return (
      <LoadingContent showSkeleton>
        <LoadingIndicator size={60}>{t('Requesting data...')}</LoadingIndicator>
      </LoadingContent>
    );
  }

  if (isSizePending || isSizeProcessing) {
    return (
      <LoadingContent>
        <BuildProcessing
          title={t('Running size analysis')}
          message={t('Hang tight, this may take a few minutes...')}
        />
      </LoadingContent>
    );
  }

  // TODO(EME-304): It would be good to have a call-to-action here. e.g.
  // click to run size analysis.
  if (showNoSizeRequested) {
    return (
      <LoadingContent>
        <p>{t('No size analysis.')}</p>
      </LoadingContent>
    );
  }

  if (isSizeFailed) {
    return (
      <BuildError
        title={t('Size analysis failed')}
        message={
          sizeInfo.error_message || t("Something went wrong, we're looking into it.")
        }
      />
    );
  }

  // Show an error if the treemap data fetch fails. Treemap data fetch
  // will fail if size analysis is running so the data will (404) but
  // this is handled above. Errors where we know the cause (error_code
  // / error_message is set) will be shown above case so this is only
  // the case where the size analysis *ought* to be successful -
  // but loading the treemap fails.
  // TODO(EME-302): Currently we don't set the size metrics
  // error_{code,message} correctly so we often see this.
  // If the main data fetch fails, this component will not be rendered.
  if (isAppSizeError) {
    return (
      <BuildError
        title={t('Size analysis failed')}
        message={appSizeError?.message ?? t('The treemap data could not be loaded')}
      />
    );
  }

  if (!appSizeData) {
    return (
      <BuildError
        title={t('Size analysis failed')}
        message={t('The treemap data could not be loaded')}
      />
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

  // Filter data based on search query and categories
  const filteredRoot = filterTreemapElement(
    appSizeData.treemap.root,
    searchQuery || '',
    '',
    selectedCategories.size > 0 ? selectedCategories : undefined
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
    <Flex direction="column" gap="lg" minHeight="700px" width="100%">
      <Flex align="center" gap="md">
        {categoriesEnabled && (
          <SegmentedControl value={selectedContent} onChange={handleContentChange}>
            <SegmentedControl.Item key="treemap" icon={<IconGrid />} />
            <SegmentedControl.Item key="categories" icon={<IconGraphCircle />} />
          </SegmentedControl>
        )}
        {selectedContent === 'treemap' && (
          <InputGroup style={{flexGrow: 1}}>
            <InputGroup.LeadingItems>
              <IconSearch />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              placeholder="Search files"
              value={searchQuery || ''}
              onChange={e => setSearchQuery(e.target.value || undefined)}
            />
            {searchQuery && (
              <InputGroup.TrailingItems>
                <Button
                  onClick={() => setSearchQuery(undefined)}
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
      {selectedContent === 'treemap' && appSizeData && (
        <AppSizeLegend
          root={appSizeData.treemap.root}
          selectedCategories={selectedCategories}
          onToggleCategory={handleToggleCategory}
        />
      )}
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
