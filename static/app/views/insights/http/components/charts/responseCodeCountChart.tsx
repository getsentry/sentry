import {t} from 'sentry/locale';
import {type MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
// TODO(release-drawer): Only used in httpSamplesPanel, should be easy to move data fetching in here
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import {SpanFields} from 'sentry/views/insights/types';

interface Props {
  groupBy: SpanFields[];
  isLoading: boolean;
  referrer: string;
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
  referrer,
}: Props) {
  const organization = useOrganization();
  const project = useAlertsProject();
  const {selection} = usePageFilters();

  const yAxis = 'count()';
  const title = t('Top 5 Response Codes');

  // TODO: Temporary hack. `DiscoverSeries` meta field and the series name don't
  // match. This is annoying to work around, and will become irrelevant soon
  // enough. For now, just specify the correct meta for these series since
  // they're known and simple
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

  // TODO: kinda ugly, the series names have the format `count() 200` for 200 reponse codes
  const topResponseCodes = seriesWithMeta
    .map(s => s.seriesName.replace('count()', '').trim())
    .filter(isNumeric);
  const stringifiedSearch = search.formatString();

  const queries = topResponseCodes.map(code => ({
    label: code,
    query: `${stringifiedSearch} ${SpanFields.RESPONSE_CODE}:${code}`,
  }));

  queries.push({
    label: t('Other'),
    query: `${stringifiedSearch} !${SpanFields.RESPONSE_CODE}:[${topResponseCodes.join(',')}]`,
  });

  const exploreUrl = getExploreUrl({
    organization,
    visualize: [
      {
        chartType: ChartType.LINE,
        yAxes: [yAxis],
      },
    ],
    mode: Mode.AGGREGATE,
    title,
    query: search?.formatString(),
    sort: undefined,
    groupBy,
    referrer,
  });

  const extraActions = [
    <BaseChartActionDropdown
      key="http response chart widget"
      exploreUrl={exploreUrl}
      referrer={referrer}
      alertMenuOptions={queries.map(query => ({
        key: query.label,
        label: query.label,
        to: getAlertsUrl({
          project,
          aggregate: yAxis,
          organization,
          pageFilters: selection,
          dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
          query: query.query,
          referrer,
        }),
      }))}
    />,
  ];

  return (
    <InsightsLineChartWidget
      extraActions={extraActions}
      title={t('Top 5 Response Codes')}
      series={seriesWithMeta}
      isLoading={isLoading}
      error={error ?? null}
      aliases={fieldAliases}
    />
  );
}

function isNumeric(maybeNumber: string) {
  return /^\d+$/.test(maybeNumber);
}
