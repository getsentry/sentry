import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/http/settings';

export function HTTPErrorsWidget() {
  const {
    isPending: isErrorDataLoading,
    data: errorData,
    error: errorDataError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(BASE_FILTERS),
      yAxis: ['http_response_rate(3)', 'http_response_rate(4)', 'http_response_rate(5)'],
      transformAliasToInputFormat: true,
    },
    Referrer.LANDING_RESPONSE_CODE_CHART
  );

  return (
    <InsightsLineChartWidget
      title={DataTitles.unsuccessfulHTTPCodes}
      series={[
        errorData[`http_response_rate(3)`],
        errorData[`http_response_rate(4)`],
        errorData[`http_response_rate(5)`],
      ]}
      isLoading={isErrorDataLoading}
      error={errorDataError}
    />
  );
}
