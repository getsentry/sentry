import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PercentChange} from 'sentry/components/percentChange';
import {IconCode, IconDownload, IconFile, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SizeCompareItemDiffTable} from 'sentry/views/preprod/buildComparison/main/sizeCompareItemDiffTable';
import {SizeCompareSelectedBuilds} from 'sentry/views/preprod/buildComparison/main/sizeCompareSelectedBuilds';
import {BuildError} from 'sentry/views/preprod/components/buildError';
import {BuildProcessing} from 'sentry/views/preprod/components/buildProcessing';
import {
  MetricsArtifactType,
  SizeAnalysisComparisonState,
} from 'sentry/views/preprod/types/appSizeTypes';
import type {
  SizeAnalysisComparisonResults,
  SizeComparisonApiResponse,
} from 'sentry/views/preprod/types/appSizeTypes';

export function SizeCompareMainContent() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const theme = useTheme();
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
      }
    );

  const mainArtifactComparison = sizeComparisonQuery.data?.comparisons.find(
    comp => comp.metrics_artifact_type === MetricsArtifactType.MAIN_ARTIFACT
  );

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
      addErrorMessage(
        error?.message || t('Failed to trigger comparison. Please try again.')
      );
    },
  });

  // Process the comparison data for metrics cards
  const processedMetrics = useMemo(() => {
    if (!comparisonDataQuery.data) {
      return [];
    }

    const {diff_items, size_metric_diff_item} = comparisonDataQuery.data;

    // Calculate summary data
    const installSizeDiff =
      size_metric_diff_item.head_install_size - size_metric_diff_item.base_install_size;
    const downloadSizeDiff =
      size_metric_diff_item.head_download_size - size_metric_diff_item.base_download_size;
    const installSizePercentage =
      installSizeDiff / size_metric_diff_item.base_install_size;
    const downloadSizePercentage =
      downloadSizeDiff / size_metric_diff_item.base_download_size;

    const largestChange = diff_items.sort(
      (a, b) => Math.abs(b.size_diff) - Math.abs(a.size_diff)
    )[0];

    // Calculate metrics
    const metrics = [
      {
        title: t('Install Size'),
        head: size_metric_diff_item.head_install_size,
        base: size_metric_diff_item.base_install_size,
        diff:
          size_metric_diff_item.head_install_size -
          size_metric_diff_item.base_install_size,
        percentageChange: installSizePercentage,
        icon: IconCode,
      },
      {
        title: t('Download Size'),
        head: size_metric_diff_item.head_download_size,
        base: size_metric_diff_item.base_download_size,
        diff:
          size_metric_diff_item.head_download_size -
          size_metric_diff_item.base_download_size,
        percentageChange: downloadSizePercentage,
        icon: IconDownload,
      },
      {
        title: t('Largest change'),
        head: largestChange ? largestChange?.head_size || 0 : 0,
        base: largestChange ? largestChange?.base_size || 0 : 0,
        diff: largestChange ? largestChange?.size_diff || 0 : 0,
        icon: IconFile,
      },
    ];

    return metrics;
  }, [comparisonDataQuery.data]);

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
    return (
      <BuildError
        title={t('Size comparison data unavailable')}
        message={
          sizeComparisonQuery.error?.message || t('Failed to load size comparison data')
        }
      />
    );
  }

  if (!mainArtifactComparison) {
    return (
      <BuildError
        title={t('Comparison data not found')}
        message={t(
          'Something went wrong and we weren’t able to find the correct comparison.'
        )}
      >
        <Flex gap="sm">
          <Button
            priority="default"
            onClick={() => {
              navigate(
                `/organizations/${organization.slug}/preprod/${projectId}/compare/${headArtifactId}/`
              );
            }}
          >
            {t('Back')}
          </Button>
        </Flex>
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

      {/* Metrics Grid */}
      <Grid columns="repeat(3, 1fr)" gap="lg">
        {processedMetrics.map((metric, index) => {
          let variant: 'danger' | 'success' | 'muted' = 'muted';
          if (metric.diff > 0) {
            variant = 'danger';
          } else if (metric.diff < 0) {
            variant = 'success';
          }

          return (
            <Container
              background="primary"
              radius="lg"
              padding="xl"
              border="primary"
              key={index}
            >
              <Flex direction="column" gap="md">
                <Flex gap="sm">
                  <metric.icon size="sm" />
                  <Text variant="muted" size="sm">
                    {metric.title}
                  </Text>
                </Flex>
                <Flex align="end" gap="sm">
                  <Heading as="h3">{formatBytesBase10(metric.head)}</Heading>
                  {/* TODO: Danger/success */}
                  <InlineText variant={variant} size="sm">
                    <Text variant={variant} size="sm">
                      {metric.diff > 0 ? '+' : metric.diff < 0 ? '-' : ''}
                      {formatBytesBase10(Math.abs(metric.diff))}
                    </Text>
                    {metric.percentageChange && (
                      <InlineText variant={variant} size="sm">
                        {'('}
                        <PercentChange
                          value={metric.percentageChange}
                          minimumValue={0.001}
                          preferredPolarity="-"
                          colorize
                        />
                        {')'}
                      </InlineText>
                    )}
                  </InlineText>
                </Flex>
                <Flex gap="xs">
                  <Text variant="muted" size="sm">
                    {t('Comparison:')}
                  </Text>
                  <Text variant="muted" size="sm" bold>
                    {metric.base === 0
                      ? t('Not present')
                      : formatBytesBase10(metric.base)}
                  </Text>
                </Flex>
              </Flex>
            </Container>
          );
        })}
      </Grid>

      {/* Files Changed Section */}
      <Container background="primary" radius="lg" padding="0" border="primary">
        <Flex direction="column" gap="0">
          {/* TODO: Collapsable */}
          <Flex align="center" gap="sm" padding="xl">
            <Heading as="h2">{t('Files Changed:')}</Heading>
            <Heading as="h2" variant="muted">
              {comparisonDataQuery.data?.diff_items.length}
            </Heading>
          </Flex>
          <SizeCompareItemDiffTable
            diffItems={comparisonDataQuery.data?.diff_items || []}
          />
        </Flex>
      </Container>
    </Flex>
  );
}

const InlineText = styled(Text)`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
