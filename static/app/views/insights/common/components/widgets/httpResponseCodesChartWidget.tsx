import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {generateExploreCompareRoute} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useHttpLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpLandingChartFilter';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import type {AddToSpanDashboardOptions} from 'sentry/views/insights/common/utils/useAddToSpanDashboard';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {FIELD_ALIASES} from 'sentry/views/insights/http/settings';

export default function HttpResponseCodesChartWidget(props: LoadableChartWidgetProps) {
  const chartFilters = useHttpLandingChartFilter();
  const organization = useOrganization();
  const location = useLocation();
  const project = useAlertsProject();
  const {selection} = usePageFilters();

  const search = MutableSearch.fromQueryObject(chartFilters);
  const referrer = Referrer.LANDING_RESPONSE_CODE_CHART;

  const {
    isPending: isResponseCodeDataLoading,
    data: responseCodeData,
    error: responseCodeError,
  } = useFetchSpanTimeSeries(
    {
      query: search,
      yAxis: ['http_response_rate(3)', 'http_response_rate(4)', 'http_response_rate(5)'],
      pageFilters: props.pageFilters,
    },
    referrer
  );

  const responseRateField = 'tags[http.response.status_code,number]';
  const stringifiedSearch = search.formatString();
  const yAxis = 'count()';

  const queries = [
    {
      yAxes: [yAxis],
      label: '3xx',
      query: `${stringifiedSearch} ${responseRateField}:>=300 ${responseRateField}:<=399`,
    },
    {
      yAxes: [yAxis],
      label: '4xx',
      query: `${stringifiedSearch} ${responseRateField}:>=400 ${responseRateField}:<=499`,
    },
    {
      yAxes: [yAxis],
      label: '5xx',
      query: `${stringifiedSearch} ${responseRateField}:>=500 ${responseRateField}:<=599`,
    },
  ];

  const exploreUrl = generateExploreCompareRoute({
    organization,
    mode: Mode.AGGREGATE,
    location,
    queries: queries.map(query => ({
      ...query,
      chartType: ChartType.LINE,
    })),
    referrer,
  });

  const addToDashboardOptions: AddToSpanDashboardOptions[] = queries.map(query => ({
    chartType: ChartType.LINE,
    yAxes: query.yAxes,
    widgetName: query.label,
    groupBy: [],
    search: new MutableSearch(query.query),
  }));

  const extraActions = [
    <BaseChartActionDropdown
      key="http response chart widget"
      exploreUrl={exploreUrl}
      addToDashboardOptions={addToDashboardOptions}
      referrer={referrer}
      alertMenuOptions={queries.map(query => ({
        key: query.label,
        label: query.label,
        to: getAlertsUrl({
          project,
          aggregate: query.yAxes[0]!,
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
      {...props}
      id="httpResponseCodesChartWidget"
      title={DataTitles.unsuccessfulHTTPCodes}
      timeSeries={responseCodeData?.timeSeries}
      extraActions={extraActions}
      aliases={FIELD_ALIASES}
      isLoading={isResponseCodeDataLoading}
      error={responseCodeError}
    />
  );
}
