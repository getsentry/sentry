import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useHttpLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpLandingChartFilter';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {FIELD_ALIASES} from 'sentry/views/insights/http/settings';

export default function HttpResponseCodesChartWidget() {
  const chartFilters = useHttpLandingChartFilter();
  const {
    isPending: isResponseCodeDataLoading,
    data: responseCodeData,
    error: responseCodeError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(chartFilters),
      yAxis: ['http_response_rate(3)', 'http_response_rate(4)', 'http_response_rate(5)'],
      transformAliasToInputFormat: true,
    },
    Referrer.LANDING_RESPONSE_CODE_CHART
  );

  return (
    <InsightsLineChartWidget
      id="httpResponseCodesChartWidget"
      title={DataTitles.unsuccessfulHTTPCodes}
      series={[
        responseCodeData[`http_response_rate(3)`],
        responseCodeData[`http_response_rate(4)`],
        responseCodeData[`http_response_rate(5)`],
      ]}
      aliases={FIELD_ALIASES}
      isLoading={isResponseCodeDataLoading}
      error={responseCodeError}
    />
  );
}
