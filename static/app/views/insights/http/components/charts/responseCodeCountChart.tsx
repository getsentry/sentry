import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {type MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
// TODO(release-drawer): Only used in httpSamplesPanel, should be easy to move data fetching in here
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import type {AddToSpanDashboardOptions} from 'sentry/views/insights/common/utils/useAddToSpanDashboard';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import {SpanFields} from 'sentry/views/insights/types';

interface Props {
  groupBy: SpanFields[];
  isLoading: boolean;
  referrer: string;
  search: MutableSearch;
  series: TimeSeries[];
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

  const topResponseCodes = series.map(getResponseCode).filter(isNumeric);
  const stringifiedSearch = search.formatString();

  const queries = topResponseCodes.map(code => ({
    label: `${code}`,
    query: `${stringifiedSearch} ${SpanFields.SPAN_STATUS_CODE}:${code}`,
  }));

  queries.push({
    label: t('Other'),
    query: `${stringifiedSearch} !${SpanFields.SPAN_STATUS_CODE}:[${topResponseCodes.join(',')}]`,
  });

  const exploreUrl = getExploreUrl({
    organization,
    selection,
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

  const addToDashboardOptions: AddToSpanDashboardOptions = {
    chartType: ChartType.LINE,
    yAxes: [yAxis],
    widgetName: title,
    groupBy,
    search,
    sort: {field: yAxis, kind: 'desc'},
    topEvents: 5,
  };

  const extraActions = [
    <BaseChartActionDropdown
      key="http response chart widget"
      exploreUrl={exploreUrl}
      referrer={referrer}
      addToDashboardOptions={addToDashboardOptions}
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
      timeSeries={series}
      isLoading={isLoading}
      error={error ?? null}
    />
  );
}

function getResponseCode(series: TimeSeries) {
  if (!series.groupBy) {
    return undefined;
  }

  const responseCodeGroupBy = series.groupBy.find(
    g => g.key === SpanFields.SPAN_STATUS_CODE
  );
  if (!responseCodeGroupBy) {
    return undefined;
  }
  // This should never come back as an array, this is just to keep typescript happy
  if (Array.isArray(responseCodeGroupBy.value)) {
    return responseCodeGroupBy.value[0];
  }
  return responseCodeGroupBy.value;
}

function isNumeric(maybeNumber: string | number | null | undefined) {
  if (!maybeNumber) {
    return false;
  }
  if (typeof maybeNumber === 'number') {
    return true;
  }
  return /^\d+$/.test(maybeNumber);
}
