import {useMemo, type ReactNode} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {PercentChange} from 'sentry/components/percentChange';
import {IconCode, IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {MetricCard} from 'sentry/views/preprod/components/metricCard';
import type {
  SizeAnalysisComparisonResults,
  SizeComparisonApiResponse,
} from 'sentry/views/preprod/types/appSizeTypes';
import {
  formattedSizeDiff,
  getLabels,
  getTrend,
} from 'sentry/views/preprod/utils/labelUtils';

interface BuildComparisonMetricCardsProps {
  comparisonResponse: SizeComparisonApiResponse | undefined;
  comparisonResults: SizeAnalysisComparisonResults | undefined;
}

interface ComparisonMetric {
  base: number;
  diff: number;
  head: number;
  icon: ReactNode;
  key: string;
  labelTooltip: string;
  percentageChange: number;
  title: string;
}

export function BuildComparisonMetricCards(props: BuildComparisonMetricCardsProps) {
  const {comparisonResults, comparisonResponse} = props;

  const metrics = useMemo<ComparisonMetric[]>(() => {
    if (!comparisonResults) {
      return [];
    }

    const labels = getLabels(
      comparisonResponse?.head_build_details.app_info?.platform ?? undefined
    );
    const {size_metric_diff_item} = comparisonResults;

    return [
      {
        key: 'install',
        title: labels.installSizeLabel,
        icon: <IconCode size="sm" />,
        labelTooltip: labels.installSizeDescription,
        head: size_metric_diff_item.head_install_size,
        base: size_metric_diff_item.base_install_size,
        diff:
          size_metric_diff_item.head_install_size -
          size_metric_diff_item.base_install_size,
        percentageChange:
          size_metric_diff_item.base_install_size === 0
            ? 0
            : (size_metric_diff_item.head_install_size -
                size_metric_diff_item.base_install_size) /
              size_metric_diff_item.base_install_size,
      },
      {
        key: 'download',
        title: labels.downloadSizeLabel,
        icon: <IconDownload size="sm" />,
        labelTooltip: labels.downloadSizeDescription,
        head: size_metric_diff_item.head_download_size,
        base: size_metric_diff_item.base_download_size,
        diff:
          size_metric_diff_item.head_download_size -
          size_metric_diff_item.base_download_size,
        percentageChange:
          size_metric_diff_item.base_download_size === 0
            ? 0
            : (size_metric_diff_item.head_download_size -
                size_metric_diff_item.base_download_size) /
              size_metric_diff_item.base_download_size,
      },
    ];
  }, [comparisonResults, comparisonResponse]);

  if (!comparisonResults) {
    return null;
  }

  return (
    <Flex gap="lg" wrap="wrap">
      {metrics.map(metric => {
        const {variant, icon} = getTrend(metric.diff);

        return (
          <MetricCard
            key={metric.key}
            icon={metric.icon}
            label={metric.title}
            labelTooltip={metric.labelTooltip}
          >
            <Stack gap="xs">
              <Flex align="end" gap="sm" wrap="wrap">
                <Heading as="h3">{formatBytesBase10(metric.head)}</Heading>
                <Flex align="center" gap="xs">
                  {icon}
                  <Text
                    as="span"
                    variant={variant}
                    size="sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.25em',
                    }}
                  >
                    {formattedSizeDiff(metric.diff)}
                    {metric.percentageChange !== 0 && (
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
                          value={metric.percentageChange}
                          minimumValue={0.001}
                          preferredPolarity="-"
                          colorize
                        />
                        {')'}
                      </Text>
                    )}
                  </Text>
                </Flex>
              </Flex>
              <Flex gap="xs" wrap="wrap">
                <Text variant="muted" size="sm">
                  {t('Base Build Size:')}
                </Text>
                <Text variant="muted" size="sm" bold>
                  {metric.base === 0 ? t('Not present') : formatBytesBase10(metric.base)}
                </Text>
              </Flex>
            </Stack>
          </MetricCard>
        );
      })}
    </Flex>
  );
}
