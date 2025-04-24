import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

interface Props {
  isLoading: boolean;
  series: DiscoverSeries[];
  error?: Error | null;
}

export function ResponseCodeCountChart({series, isLoading, error}: Props) {
  // TODO: Temporary hack. `DiscoverSeries` meta field and the series name don't
  // match. This is annoying to work around, and will become irrelevant soon
  // enough. For now, just specify the correct meta for these series since
  // they're known and simple
  const seriesWithMeta: DiscoverSeries[] = series.map(discoverSeries => {
    const transformedSeries: DiscoverSeries = {
      ...discoverSeries,
      meta: {
        fields: {
          [discoverSeries.seriesName]: 'integer',
        },
        units: {},
      },
    };

    return transformedSeries;
  });

  return (
    <InsightsLineChartWidget
      title={t('Top 5 Response Codes')}
      series={seriesWithMeta}
      isLoading={isLoading}
      error={error ?? null}
    />
  );
}
