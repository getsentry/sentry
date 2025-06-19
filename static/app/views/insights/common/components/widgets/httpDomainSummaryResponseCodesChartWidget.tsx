import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {generateExploreCompareRoute} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useHttpDomainSummaryChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpDomainSummaryChartFilter';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {FIELD_ALIASES} from 'sentry/views/insights/http/settings';

export default function HttpDomainSummaryResponseCodesChartWidget(
  props: LoadableChartWidgetProps
) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = usePageFilters();

  const chartFilters = useHttpDomainSummaryChartFilter();
  const project = useAlertsProject();
  const search = MutableSearch.fromQueryObject(chartFilters);
  const referrer = Referrer.DOMAIN_SUMMARY_RESPONSE_CODE_CHART;

  const {
    isPending: isResponseCodeDataLoading,
    data: responseCodeData,
    error: responseCodeError,
  } = useSpanMetricsSeries(
    {
      search,
      yAxis: ['http_response_rate(3)', 'http_response_rate(4)', 'http_response_rate(5)'],
      transformAliasToInputFormat: true,
    },
    referrer,
    props.pageFilters
  );

  const responseRateField = 'tags[http.response.status_code,number]';
  const stringifiedSearch = search.formatString();

  const queries = [
    {
      yAxes: ['count()'],
      label: '3xx',
      query: `${stringifiedSearch} ${responseRateField}:>=300 ${responseRateField}:<=399`,
    },
    {
      yAxes: ['count()'],
      label: '4xx',
      query: `${stringifiedSearch} ${responseRateField}:>=400 ${responseRateField}:<=499`,
    },
    {
      yAxes: ['count()'],
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
      id="httpDomainSummaryResponseCodesChartWidget"
      title={DataTitles.unsuccessfulHTTPCodes}
      series={[
        responseCodeData[`http_response_rate(3)`],
        responseCodeData[`http_response_rate(4)`],
        responseCodeData[`http_response_rate(5)`],
      ]}
      extraActions={extraActions}
      aliases={FIELD_ALIASES}
      isLoading={isResponseCodeDataLoading}
      error={responseCodeError}
    />
  );
}
