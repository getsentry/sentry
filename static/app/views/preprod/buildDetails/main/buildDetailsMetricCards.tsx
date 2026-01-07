import type {ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {PercentChange} from 'sentry/components/percentChange';
import {IconCode, IconDownload, IconLightning, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricCard} from 'sentry/views/preprod/components/metricCard';
import {MetricsArtifactType} from 'sentry/views/preprod/types/appSizeTypes';
import {
  getMainArtifactSizeMetric,
  isSizeInfoCompleted,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {
  BuildDetailsSizeInfo,
  BuildDetailsSizeInfoSizeMetric,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {Platform} from 'sentry/views/preprod/types/sharedTypes';
import {getBuildCompareUrl} from 'sentry/views/preprod/utils/buildLinkUtils';
import type {ProcessedInsight} from 'sentry/views/preprod/utils/insightProcessing';
import {
  formattedPrimaryMetricDownloadSize,
  formattedPrimaryMetricInstallSize,
  formattedSizeDiff,
  getLabels,
  getTrend,
} from 'sentry/views/preprod/utils/labelUtils';

interface BuildDetailsMetricCardsProps {
  onOpenInsightsSidebar: () => void;
  processedInsights: ProcessedInsight[];
  sizeInfo: BuildDetailsSizeInfo | undefined;
  totalSize: number;
  artifactId?: string;
  baseArtifactId?: string | null;
  platform?: Platform | null;
  projectId?: string;
  projectType?: string | null;
}

interface MetricCardConfig {
  icon: ReactNode;
  key: string;
  title: string;
  value: string;
  comparisonUrl?: string;
  delta?: MetricDelta;
  labelTooltip?: string;
  percentageText?: string;
  showInsightsButton?: boolean;
  watchBreakdown?: WatchBreakdown;
}
interface MetricDelta {
  baseValue: number;
  diff: number;
  percentageChange: number;
}

interface WatchBreakdown {
  appValue: string;
  watchValue: string;
}

export function BuildDetailsMetricCards(props: BuildDetailsMetricCardsProps) {
  const {
    sizeInfo,
    processedInsights,
    totalSize,
    artifactId,
    baseArtifactId,
    platform: platformProp,
    projectType,
    projectId,
    onOpenInsightsSidebar,
  } = props;

  const organization = useOrganization();
  const theme = useTheme();

  if (!isSizeInfoCompleted(sizeInfo)) {
    return null;
  }

  const labels = getLabels(platformProp ?? undefined);
  const primarySizeMetric = getMainArtifactSizeMetric(sizeInfo);
  const watchArtifactMetric = sizeInfo.size_metrics.find(
    metric => metric.metrics_artifact_type === MetricsArtifactType.WATCH_ARTIFACT
  );
  const installMetricValue = formattedPrimaryMetricInstallSize(sizeInfo);
  const downloadMetricValue = formattedPrimaryMetricDownloadSize(sizeInfo);

  // Find matching base metrics for comparison
  const basePrimarySizeMetric = sizeInfo.base_size_metrics.find(
    metric => metric.metrics_artifact_type === MetricsArtifactType.MAIN_ARTIFACT
  );

  // Calculate deltas for install and download sizes
  const installDelta = calculateDelta(
    primarySizeMetric?.install_size_bytes,
    basePrimarySizeMetric?.install_size_bytes
  );
  const downloadDelta = calculateDelta(
    primarySizeMetric?.download_size_bytes,
    basePrimarySizeMetric?.download_size_bytes
  );

  // Build comparison URL using route params
  const comparisonUrl =
    baseArtifactId && projectId && artifactId
      ? getBuildCompareUrl({
          organizationSlug: organization.slug,
          projectId,
          headArtifactId: artifactId,
          baseArtifactId,
        })
      : undefined;

  const totalPotentialSavings = processedInsights.reduce(
    (sum, insight) => sum + (insight.totalSavings ?? 0),
    0
  );
  const potentialSavingsPercentage =
    totalSize > 0 ? totalPotentialSavings / totalSize : null;
  const potentialSavingsPercentageText =
    potentialSavingsPercentage !== null && potentialSavingsPercentage !== undefined
      ? ` (${formatPercentage(potentialSavingsPercentage, 1, {
          minimumValue: 0.001,
        })})`
      : undefined;

  const metricsCards: MetricCardConfig[] = [
    {
      key: 'install',
      title: labels.installSizeLabel,
      icon: <IconCode size="sm" />,
      labelTooltip: labels.installSizeDescription,
      value: installMetricValue,
      comparisonUrl,
      watchBreakdown: getWatchBreakdown(
        primarySizeMetric,
        watchArtifactMetric,
        'install_size_bytes'
      ),
      delta: installDelta,
    },
    {
      key: 'download',
      title: labels.downloadSizeLabel,
      icon: <IconDownload size="sm" />,
      labelTooltip: labels.downloadSizeDescription,
      value: downloadMetricValue,
      comparisonUrl,
      watchBreakdown: getWatchBreakdown(
        primarySizeMetric,
        watchArtifactMetric,
        'download_size_bytes'
      ),
      delta: downloadDelta,
    },
    {
      key: 'savings',
      title: t('Potential savings'),
      icon: <IconLightning size="sm" />,
      labelTooltip: t('Total savings from insights'),
      value: formatBytesBase10(totalPotentialSavings),
      comparisonUrl: undefined,
      percentageText: potentialSavingsPercentageText,
      showInsightsButton: totalPotentialSavings > 0,
    },
  ];

  return (
    <Flex gap="lg" wrap="wrap">
      {metricsCards.map(card => (
        <MetricCard
          key={card.key}
          icon={card.icon}
          label={card.title}
          labelTooltip={card.labelTooltip}
          action={
            card.showInsightsButton
              ? {
                  icon: <IconSettings size="sm" variant="primary" />,
                  tooltip: t('View insight details'),
                  ariaLabel: t('View insight details'),
                  onClick: () => {
                    trackAnalytics('preprod.builds.details.open_insights_sidebar', {
                      organization,
                      platform: platformProp ?? null,
                      project_type: projectType,
                      source: 'metric_card',
                    });
                    onOpenInsightsSidebar();
                  },
                }
              : undefined
          }
        >
          <Stack gap="xs">
            <Flex align="center" gap="sm" wrap="wrap">
              <Heading as="h3">
                {card.watchBreakdown ? (
                  <Tooltip
                    title={
                      <WatchBreakdownTooltip
                        appValue={card.watchBreakdown.appValue}
                        watchValue={card.watchBreakdown.watchValue}
                      />
                    }
                    position="bottom"
                  >
                    <MetricValue $interactive>{card.value}</MetricValue>
                  </Tooltip>
                ) : (
                  <MetricValue>{card.value}</MetricValue>
                )}
                {card.percentageText ?? ''}
              </Heading>

              {card.delta &&
                card.comparisonUrl &&
                (() => {
                  const {variant, icon} = getTrend(card.delta.diff);

                  return (
                    <LinkButton
                      to={card.comparisonUrl}
                      size="zero"
                      priority="link"
                      aria-label={t('Compare builds')}
                    >
                      <Flex align="center" gap="xs">
                        <Flex
                          as="span"
                          display="inline-flex"
                          align="center"
                          style={{color: theme.tokens.content.primary}}
                        >
                          {icon}
                        </Flex>
                        <Text
                          as="span"
                          variant={variant}
                          size="sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.25em',
                            fontWeight: 'normal',
                          }}
                        >
                          {formattedSizeDiff(card.delta.diff)}
                          {card.delta.percentageChange !== 0 && (
                            <Text
                              as="span"
                              variant={variant}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {' ('}
                              <PercentChange
                                value={card.delta.percentageChange}
                                minimumValue={0.001}
                                preferredPolarity="-"
                                colorize
                              />
                              {')'}
                            </Text>
                          )}
                        </Text>
                      </Flex>
                    </LinkButton>
                  );
                })()}
            </Flex>

            {card.delta && (
              <Flex gap="xs" wrap="wrap">
                <Text variant="muted" size="sm">
                  {t('Base Build Size:')}
                </Text>
                <Text variant="muted" size="sm" bold>
                  {card.delta.baseValue === 0
                    ? t('Not present')
                    : formatBytesBase10(card.delta.baseValue)}
                </Text>
              </Flex>
            )}
          </Stack>
        </MetricCard>
      ))}
    </Flex>
  );
}

function WatchBreakdownTooltip(props: {appValue: string; watchValue: string}) {
  const {appValue, watchValue} = props;

  return (
    <Stack align="start">
      <Flex gap="sm">
        <Text size="md" bold>
          {t('App')}:
        </Text>
        <Text size="md">{appValue}</Text>
      </Flex>
      <Flex gap="sm">
        <Text size="md" bold>
          {t('Watch')}:
        </Text>
        <Text size="md">{watchValue}</Text>
      </Flex>
    </Stack>
  );
}

function getWatchBreakdown(
  primaryMetric: BuildDetailsSizeInfoSizeMetric | undefined,
  watchMetric: BuildDetailsSizeInfoSizeMetric | undefined,
  field: 'install_size_bytes' | 'download_size_bytes'
): WatchBreakdown | undefined {
  if (!primaryMetric || !watchMetric) {
    return undefined;
  }

  return {
    appValue: formatBytesBase10(primaryMetric[field]),
    watchValue: formatBytesBase10(watchMetric[field]),
  };
}

function calculateDelta(
  headValue: number | undefined,
  baseValue: number | undefined
): MetricDelta | undefined {
  if (headValue === undefined || baseValue === undefined) {
    return undefined;
  }

  const diff = headValue - baseValue;
  const percentageChange = baseValue === 0 ? 0 : diff / baseValue;

  return {
    baseValue,
    diff,
    percentageChange,
  };
}

const MetricValue = styled('span')<{$interactive?: boolean}>`
  ${p =>
    p.$interactive
      ? `
    text-decoration: underline dotted;
    cursor: help;
  `
      : ''}
`;
