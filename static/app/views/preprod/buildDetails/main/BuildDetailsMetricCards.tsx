import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconCode, IconDownload, IconLightning, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {MetricCard} from 'sentry/views/preprod/components/metricCard';
import {MetricsArtifactType} from 'sentry/views/preprod/types/appSizeTypes';
import {
  getMainArtifactSizeMetric,
  isSizeInfoCompleted,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {BuildDetailsSizeInfo} from 'sentry/views/preprod/types/buildDetailsTypes';
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
  const {sizeInfo, processedInsights, totalSize, platform, onOpenInsightsSidebar} = props;

  const labels = getLabels(platform ?? undefined);
  const primarySizeMetric =
    sizeInfo && isSizeInfoCompleted(sizeInfo)
      ? getMainArtifactSizeMetric(sizeInfo)
      : undefined;
  const watchAppMetrics =
    sizeInfo && isSizeInfoCompleted(sizeInfo)
      ? (sizeInfo.size_metrics.find(
          metric => metric.metrics_artifact_type === MetricsArtifactType.WATCH_ARTIFACT
        ) ?? null)
      : null;
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
  const hasInsights = processedInsights.length > 0;

  const metricsCards: MetricCardConfig[] = [
    {
      key: 'install',
      title: labels.installSizeLabel,
      icon: <IconCode size="sm" />,
      labelTooltip: labels.installSizeDescription,
      value: installMetricValue,
      watchBreakdown: getWatchBreakdown(
        primarySizeMetric,
        watchAppMetrics,
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
        watchAppMetrics,
        'download_size_bytes'
      ),
    },
    {
      key: 'savings',
      title: t('Potential savings'),
      icon: <IconLightning size="sm" />,
      value: formatBytesBase10(totalPotentialSavings),
      percentageText: potentialSavingsPercentageText,
      showInsightsButton: hasInsights,
    },
  ];

  return (
    <Flex gap="lg" wrap="wrap">
      {metricsCards.map(card => {
        const valueContent = (
          <Heading as="h3">
            <MetricValue $interactive={Boolean(card.watchBreakdown)}>
              {card.value}
            </MetricValue>
            {card.percentageText ?? ''}
          </Heading>
        );

        return (
          <MetricCard
            key={card.key}
            icon={card.icon}
            label={card.title}
            labelTooltip={card.labelTooltip}
            minWidth={220}
            action={
              card.showInsightsButton
                ? {
                    icon: <IconSettings size="sm" color="white" />,
                    tooltip: t('View insight details'),
                    ariaLabel: t('View insight details'),
                    onClick: onOpenInsightsSidebar,
                  }
                : undefined
            }
          >
            {card.watchBreakdown ? (
              <Tooltip
                title={
                  <WatchBreakdownTooltip
                    appValue={card.watchBreakdown.appValue}
                    watchValue={card.watchBreakdown.watchValue}
                  />
                }
                position="left"
              >
                {valueContent}
              </Tooltip>
            ) : (
              valueContent
            )}
          </MetricCard>
        );
      })}
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
  primaryMetric: ReturnType<typeof getMainArtifactSizeMetric>,
  watchMetric: ReturnType<typeof getMainArtifactSizeMetric> | null,
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
