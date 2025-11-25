import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

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
import type {ProcessedInsight} from 'sentry/views/preprod/utils/insightProcessing';
import {
  formattedPrimaryMetricDownloadSize,
  formattedPrimaryMetricInstallSize,
  getLabels,
} from 'sentry/views/preprod/utils/labelUtils';

interface BuildDetailsMetricCardsProps {
  onOpenInsightsSidebar: () => void;
  processedInsights: ProcessedInsight[];
  sizeInfo: BuildDetailsSizeInfo | undefined;
  totalSize: number;
  platform?: Platform | null;
  projectType?: string | null;
}

interface MetricCardConfig {
  icon: ReactNode;
  key: string;
  title: string;
  value: string;
  labelTooltip?: string;
  percentageText?: string;
  showInsightsButton?: boolean;
  watchBreakdown?: WatchBreakdown;
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
    platform: platformProp,
    projectType,
    onOpenInsightsSidebar,
  } = props;

  const organization = useOrganization();

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
      watchBreakdown: getWatchBreakdown(
        primarySizeMetric,
        watchArtifactMetric,
        'install_size_bytes'
      ),
    },
    {
      key: 'download',
      title: labels.downloadSizeLabel,
      icon: <IconDownload size="sm" />,
      labelTooltip: labels.downloadSizeDescription,
      value: downloadMetricValue,
      watchBreakdown: getWatchBreakdown(
        primarySizeMetric,
        watchArtifactMetric,
        'download_size_bytes'
      ),
    },
    {
      key: 'savings',
      title: t('Potential savings'),
      icon: <IconLightning size="sm" />,
      labelTooltip: t('Total savings from insights'),
      value: formatBytesBase10(totalPotentialSavings),
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
                  icon: <IconSettings size="sm" color="white" />,
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

const MetricValue = styled('span')<{$interactive?: boolean}>`
  ${p =>
    p.$interactive
      ? `
    text-decoration: underline dotted;
    cursor: help;
  `
      : ''}
`;
