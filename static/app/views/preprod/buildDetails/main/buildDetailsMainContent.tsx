import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Flex, Stack} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import Placeholder from 'sentry/components/placeholder';
import {IconClose, IconGrid, IconRefresh, IconSearch} from 'sentry/icons';
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
import {TreemapType} from 'sentry/views/preprod/types/appSizeTypes';
import type {AppSizeApiResponse} from 'sentry/views/preprod/types/appSizeTypes';
import {
  BuildDetailsSizeAnalysisState,
  isSizeInfoProcessing,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {processInsights} from 'sentry/views/preprod/utils/insightProcessing';
import {validatedPlatform} from 'sentry/views/preprod/utils/sharedTypesUtils';
import {filterTreemapElement} from 'sentry/views/preprod/utils/treemapFiltering';

interface BuildDetailsMainContentProps {
  appSizeQuery: UseApiQueryResult<AppSizeApiResponse, RequestError>;
  isRerunning: boolean;
  onRerunAnalysis: () => void;
  buildDetailsData?: BuildDetailsApiResponse | null;
  isBuildDetailsPending?: boolean;
}

export function BuildDetailsMainContent(props: BuildDetailsMainContentProps) {
  const {
    isRerunning,
    onRerunAnalysis,
    appSizeQuery,
    buildDetailsData,
    isBuildDetailsPending = false,
  } = props;
  const {
    data: appSizeData,
    isLoading: isAppSizeLoading,
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

  const [selectedCategoriesParam, setSelectedCategoriesParam] =
    useQueryParamState<string>({
      fieldName: 'categories',
    });

  const selectedCategories: Set<TreemapType> = selectedCategoriesParam
    ? new Set(
        selectedCategoriesParam
          .split(',')
          .filter(
            c => c.trim() !== '' && Object.values(TreemapType).includes(c as TreemapType)
          )
          .map(c => c as TreemapType)
      )
    : new Set();

  const handleToggleCategory = (category: TreemapType) => {
    const next = new Set(selectedCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setSelectedCategoriesParam(next.size > 0 ? Array.from(next).join(',') : undefined);
  };

  const sizeInfo = buildDetailsData?.size_info;
  const isLoadingRequests = isAppSizeLoading || isBuildDetailsPending;
  const isSizeNotStarted = sizeInfo === undefined;
  const isSizeFailed = sizeInfo?.state === BuildDetailsSizeAnalysisState.FAILED;
  const showNoSizeRequested = !isLoadingRequests && isSizeNotStarted;

  if (isLoadingRequests) {
    return (
      <Stack gap="lg" width="100%">
        <Flex width="100%" justify="between" align="center" gap="md">
          <Placeholder width="92px" height="40px" />
          <Placeholder style={{flex: 1}} height="40px" />
        </Flex>
        <Placeholder width="100%" height="540px" />
        <Placeholder height="140px" />
      </Stack>
    );
  }

  const isWaitingForData = !appSizeData && !isAppSizeError;

  if (isSizeInfoProcessing(sizeInfo) || isWaitingForData) {
    return (
      <Flex width="100%" justify="center" align="center" minHeight="60vh">
        <BuildProcessing
          title={t('Running size analysis')}
          message={t('Hang tight, this may take a few minutes...')}
        />
      </Flex>
    );
  }

  // TODO(EME-304): It would be good to have a call-to-action here. e.g.
  // click to run size analysis.
  if (showNoSizeRequested) {
    return (
      <Flex width="100%" justify="center" align="center" minHeight="60vh">
        <BuildError
          title={t('No size analysis')}
          message={t('No size analysis is available for this build.')}
        />
      </Flex>
    );
  }

  if (isSizeFailed) {
    return (
      <Flex width="100%" justify="center" align="center" minHeight="60vh">
        <BuildError
          title={t('Size analysis failed')}
          message={
            sizeInfo.error_message || t("Something went wrong, we're looking into it.")
          }
        >
          <Button
            priority="primary"
            onClick={onRerunAnalysis}
            disabled={isRerunning}
            icon={<IconRefresh />}
          >
            {isRerunning ? t('Rerunning...') : t('Retry analysis')}
          </Button>
        </BuildError>
      </Flex>
    );
  }

  // TODO(EME-302): Currently we don't set the size metrics
  // error_{code,message} correctly so we often see this.
  if (isAppSizeError) {
    return (
      <Flex width="100%" justify="center" align="center" minHeight="60vh">
        <BuildError
          title={t('Size analysis failed')}
          message={appSizeError?.message ?? t('The treemap data could not be loaded')}
        >
          <Button
            priority="primary"
            onClick={onRerunAnalysis}
            disabled={isRerunning}
            icon={<IconRefresh />}
          >
            {isRerunning ? t('Rerunning...') : t('Retry analysis')}
          </Button>
        </BuildError>
      </Flex>
    );
  }

  if (!appSizeData?.treemap?.root) {
    return (
      <Flex width="100%" justify="center" align="center" minHeight="60vh">
        <BuildProcessing
          title={t('Running size analysis')}
          message={t('Hang tight, this may take a few minutes...')}
        />
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
            unfilteredRoot={appSizeData.treemap.root}
            onSearchChange={value => setSearchQuery(value || undefined)}
          />
        ) : (
          <Alert type="info">No files found matching "{searchQuery}"</Alert>
        )
      ) : (
        <AppSizeCategories treemapData={appSizeData.treemap} />
      );
  } else {
    visualizationContent = filteredTreemapData ? (
      <AppSizeTreemap
        root={filteredTreemapData.root}
        searchQuery={searchQuery || ''}
        unfilteredRoot={appSizeData.treemap.root}
        onSearchChange={value => setSearchQuery(value || undefined)}
      />
    ) : (
      <Alert type="info">No files found matching "{searchQuery}"</Alert>
    );
  }

  return (
    <Flex direction="column" gap="sm" minHeight="700px" width="100%">
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
      <ChartContainer>{visualizationContent}</ChartContainer>

      <Stack gap="xl">
        {selectedContent === 'treemap' && appSizeData && (
          <AppSizeLegend
            root={appSizeData.treemap.root}
            selectedCategories={selectedCategories}
            onToggleCategory={handleToggleCategory}
          />
        )}
        {processedInsights.length > 0 && (
          <AppSizeInsights
            processedInsights={processedInsights}
            platform={validatedPlatform(buildDetailsData?.app_info?.platform)}
          />
        )}
      </Stack>
    </Flex>
  );
}

const ChartContainer = styled('div')`
  width: 100%;
  height: 508px;
  padding-top: ${p => p.theme.space.md};
`;
