import {t} from 'sentry/locale';
import {type MutableSearch} from 'sentry/utils/tokenizeSearch';
// TODO(release-drawer): Only used in httpSamplesPanel, should be easy to move data fetching in here
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {type SpanFields} from 'sentry/views/insights/types';

interface Props {
  groupBy: SpanFields[];
  isLoading: boolean;
  search: MutableSearch;
  series: DiscoverSeries[];
  error?: Error | null;
}

export function ResponseCodeCountChart({
  series,
  isLoading,
  error,
  search,
  groupBy,
}: Props) {
  // TODO: Temporary hack. `DiscoverSeries` meta field and the series name don't
  // match. This is annoying to work around, and will become irrelevant soon
  // enough. For now, just specify the correct meta for these series since
  // they're known and simple

  const yAxis = 'count()';

  const fieldAliases: Record<string, string> = {};
  const seriesWithMeta: DiscoverSeries[] = series.map(discoverSeries => {
    const newSeriesName = `${yAxis} ${discoverSeries.seriesName}`;

    fieldAliases[newSeriesName] = discoverSeries.seriesName;

    const transformedSeries: DiscoverSeries = {
      ...discoverSeries,
      seriesName: newSeriesName,
      meta: {
        fields: {
          [newSeriesName]: 'integer',
        },
        units: {},
      },
    };

    return transformedSeries;
  });

  return (
    <InsightsLineChartWidget
      queryInfo={{search, groupBy}}
      title={t('Top 5 Response Codes')}
      series={seriesWithMeta}
      isLoading={isLoading}
      error={error ?? null}
      aliases={fieldAliases}
    />
  );
}
