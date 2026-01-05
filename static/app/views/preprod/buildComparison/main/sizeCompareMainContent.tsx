import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import {parseAsBoolean, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron, IconRefresh, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import parseApiError from 'sentry/utils/parseApiError';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildComparisonMetricCards} from 'sentry/views/preprod/buildComparison/main/buildComparisonMetricCards';
import {InsightComparisonSection} from 'sentry/views/preprod/buildComparison/main/insightComparisonSection';
import {SizeCompareItemDiffTable} from 'sentry/views/preprod/buildComparison/main/sizeCompareItemDiffTable';
import {SizeCompareSelectedBuilds} from 'sentry/views/preprod/buildComparison/main/sizeCompareSelectedBuilds';
import {TreemapDiffSection} from 'sentry/views/preprod/buildComparison/main/treemapDiffSection';
import {BuildError} from 'sentry/views/preprod/components/buildError';
import {BuildProcessing} from 'sentry/views/preprod/components/buildProcessing';
import {
  isSizeAnalysisComparisonInProgress,
  MetricsArtifactType,
  SizeAnalysisComparisonState,
} from 'sentry/views/preprod/types/appSizeTypes';
import type {
  SizeAnalysisComparison,
  SizeAnalysisComparisonResults,
  SizeComparisonApiResponse,
} from 'sentry/views/preprod/types/appSizeTypes';

function getMainComparison(
  response: SizeComparisonApiResponse | undefined
): SizeAnalysisComparison | undefined {
  return response?.comparisons.find(
    c => c.metrics_artifact_type === MetricsArtifactType.MAIN_ARTIFACT
  );
}

export function SizeCompareMainContent() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const theme = useTheme();
  const [isFilesExpanded, setIsFilesExpanded] = useState(true);
  const [hideSmallChanges, setHideSmallChanges] = useQueryState(
    'hideSmallChanges',
    parseAsBoolean.withDefault(true)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const {baseArtifactId, headArtifactId, projectId} = useParams<{
    baseArtifactId: string;
    headArtifactId: string;
    projectId: string;
  }>();

  const sizeComparisonQuery: UseApiQueryResult<SizeComparisonApiResponse, RequestError> =
    useApiQuery<SizeComparisonApiResponse>(
      [
        `/projects/${organization.slug}/${projectId}/preprodartifacts/size-analysis/compare/${headArtifactId}/${baseArtifactId}/`,
      ],
      {
        staleTime: 0,
        enabled: !!projectId && !!headArtifactId && !!baseArtifactId,
        refetchInterval: query => {
          const mainComparison = getMainComparison(query.state.data?.[0]);
          return isSizeAnalysisComparisonInProgress(mainComparison) ? 10_000 : false;
        },
      }
    );

  const mainArtifactComparison = getMainComparison(sizeComparisonQuery.data);

  // Query the comparison download endpoint to get detailed data
  const comparisonDataQuery = useApiQuery<SizeAnalysisComparisonResults>(
    [
      `/projects/${organization.slug}/${projectId}/preprodartifacts/size-analysis/compare/${mainArtifactComparison?.head_size_metric_id}/${mainArtifactComparison?.base_size_metric_id}/download/`,
    ],
    {
      staleTime: 0,
      enabled:
        !!mainArtifactComparison?.head_size_metric_id &&
        !!mainArtifactComparison?.base_size_metric_id &&
        !!organization.slug &&
        !!baseArtifactId,
    }
  );

  const {mutate: triggerComparison, isPending: isComparing} = useMutation<
    void,
    RequestError,
    {baseArtifactId: string; headArtifactId: string}
  >({
    mutationFn: () => {
      return fetchMutation({
        url: `/projects/${organization.slug}/${projectId}/preprodartifacts/size-analysis/compare/${headArtifactId}/${baseArtifactId}/`,
        method: 'POST',
      });
    },
    onSuccess: () => {
      navigate(
        `/organizations/${organization.slug}/preprod/${projectId}/compare/${headArtifactId}/${baseArtifactId}/`
      );
    },
    onError: error => {
      const errorMessage = parseApiError(error);
      addErrorMessage(
        errorMessage === 'Unknown API Error'
          ? t('Failed to trigger comparison. Please try again.')
          : errorMessage
      );
    },
  });

  // Filter diff items based on the toggle and search query
  const filteredDiffItems = useMemo(() => {
    if (!comparisonDataQuery.data?.diff_items) {
      return [];
    }

    let items = comparisonDataQuery.data.diff_items;

    // Filter by size if hideSmallChanges is enabled
    if (hideSmallChanges) {
      items = items.filter(item => Math.abs(item.size_diff) >= 500);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      items = items.filter(item => item.path.toLowerCase().includes(query));
    }

    return items;
  }, [comparisonDataQuery.data?.diff_items, hideSmallChanges, searchQuery]);

  if (sizeComparisonQuery.isLoading || comparisonDataQuery.isLoading || isComparing) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        style={{minHeight: '60vh', padding: theme.space.md}}
      >
        <LoadingIndicator />
      </Flex>
    );
  }

  if (sizeComparisonQuery.isError || !sizeComparisonQuery.data) {
    const errorMessage = sizeComparisonQuery.error
      ? parseApiError(sizeComparisonQuery.error)
      : 'Unknown API Error';
    return (
      <BuildError
        title={t('Size comparison data unavailable')}
        message={
          errorMessage === 'Unknown API Error'
            ? t('Failed to load size comparison data')
            : errorMessage
        }
      />
    );
  }

  if (!mainArtifactComparison) {
    return (
      <BuildError
        title={t('No comparison data available')}
        message={t("We don't have any comparison data available yet for these builds.")}
      >
        <Button
          priority="primary"
          onClick={() => {
            triggerComparison({
              baseArtifactId,
              headArtifactId,
            });
          }}
        >
          {t('Trigger a comparison')}
        </Button>
      </BuildError>
    );
  }

  if (
    [
      SizeAnalysisComparisonState.PROCESSING,
      SizeAnalysisComparisonState.PENDING,
    ].includes(mainArtifactComparison.state)
  ) {
    return (
      <Flex width="100%" justify="center" align="center">
        <BuildProcessing
          title={t('Running diff engine')}
          message={t('Hang tight, this may take a few minutes...')}
        />
      </Flex>
    );
  }

  if (mainArtifactComparison.state === SizeAnalysisComparisonState.FAILED) {
    return (
      <BuildError
        title={t('Comparison failed')}
        message={
          mainArtifactComparison.error_message ||
          t("Something went wrong, we're looking into it.")
        }
      >
        <Button
          priority="default"
          onClick={() => {
            triggerComparison({
              baseArtifactId,
              headArtifactId,
            });
          }}
        >
          <Flex gap="sm">
            <IconRefresh size="sm" />
            {t('Retry')}
          </Flex>
        </Button>
      </BuildError>
    );
  }

  return (
    <Flex direction="column" gap="2xl">
      <SizeCompareSelectedBuilds
        headBuildDetails={sizeComparisonQuery.data.head_build_details}
        baseBuildDetails={sizeComparisonQuery.data.base_build_details}
        isComparing={false}
        onClearBaseBuild={() => {
          navigate(
            `/organizations/${organization.slug}/preprod/${projectId}/compare/${headArtifactId}/`
          );
        }}
      />

      <BuildComparisonMetricCards
        comparisonResults={comparisonDataQuery.data}
        comparisonResponse={sizeComparisonQuery.data}
      />

      {/* Insights Section */}
      {comparisonDataQuery.data?.insight_diff_items &&
        comparisonDataQuery.data.insight_diff_items.length > 0 && (
          <InsightComparisonSection
            totalInstallSizeBytes={
              comparisonDataQuery.data?.size_metric_diff_item.head_install_size
            }
            insightDiffItems={comparisonDataQuery.data.insight_diff_items}
          />
        )}

      {/* Items Changed Section */}
      <Container background="primary" radius="lg" padding="0" border="primary">
        <Flex direction="column" gap="0">
          <Flex align="center" justify="between" padding="xl">
            <Flex align="center" gap="sm">
              <Heading as="h2">
                {t('Items Changed: %s', comparisonDataQuery.data?.diff_items.length)}
              </Heading>
            </Flex>
            <Flex align="center" gap="sm">
              <Button
                priority="transparent"
                size="sm"
                onClick={() => setIsFilesExpanded(!isFilesExpanded)}
                aria-label={isFilesExpanded ? t('Collapse items') : t('Expand items')}
              >
                <IconChevron
                  direction={isFilesExpanded ? 'up' : 'down'}
                  size="sm"
                  style={{
                    transition: 'transform 0.2s ease',
                  }}
                />
              </Button>
            </Flex>
          </Flex>
          {isFilesExpanded && (
            <Stack>
              <Flex
                align="center"
                gap="xl"
                paddingLeft="xl"
                paddingRight="xl"
                paddingBottom="xl"
                wrap="wrap"
              >
                <InputGroup style={{width: '100%', minWidth: '200px'}}>
                  <InputGroup.LeadingItems>
                    <IconSearch />
                  </InputGroup.LeadingItems>
                  <InputGroup.Input
                    placeholder={t('Search')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </InputGroup>
                <Flex align="center" gap="lg" wrap="nowrap">
                  <Text wrap="nowrap">{t('Hide changes < 500B')}</Text>
                  <Switch
                    checked={hideSmallChanges}
                    size="sm"
                    title={t('Hide < 500B')}
                    onChange={() => setHideSmallChanges(!hideSmallChanges)}
                    aria-label={
                      hideSmallChanges ? t('Show small changes') : t('Hide small changes')
                    }
                  />
                </Flex>
              </Flex>
              <SizeCompareItemDiffTable
                diffItems={filteredDiffItems}
                originalItemCount={comparisonDataQuery.data?.diff_items.length ?? 0}
                disableHideSmallChanges={() => setHideSmallChanges(false)}
              />
            </Stack>
          )}
        </Flex>
      </Container>

      {/* Treemap Diff Section */}
      {comparisonDataQuery.data?.diff_items &&
        comparisonDataQuery.data.diff_items.length > 0 && (
          <TreemapDiffSection diffItems={comparisonDataQuery.data.diff_items} />
        )}
    </Flex>
  );
}
