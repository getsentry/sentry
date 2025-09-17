import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useParams} from 'sentry/utils/useParams';
import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {DATA_TYPE, FIELD_ALIASES} from 'sentry/views/insights/browser/resources/settings';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {
  useResourceSummarySeries,
  useResourceSummarySeriesSearch,
} from 'sentry/views/insights/common/components/widgets/hooks/useResourceSummarySeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {SpanFields} from 'sentry/views/insights/types';

const {
  HTTP_RESPONSE_CONTENT_LENGTH,
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_TRANSFER_SIZE,
} = SpanFields;

export default function ResourceSummaryAverageSizeChartWidget(
  props: LoadableChartWidgetProps
) {
  const {groupId} = useParams();
  const referrer = Referrer.RESOURCE_SUMMARY_AVERAGE_SIZE_CHART;
  const {search, enabled} = useResourceSummarySeriesSearch(groupId);

  const {data, isPending, error} = useResourceSummarySeries({
    search,
    pageFilters: props.pageFilters,
    enabled,
    referrer,
  });

  const timeSeries = data?.timeSeries || [];
  const decodedSeries = timeSeries.find(
    ts => ts.yAxis === `avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`
  );
  const transferSeries = timeSeries.find(
    ts => ts.yAxis === `avg(${HTTP_RESPONSE_TRANSFER_SIZE})`
  );
  const contentSeries = timeSeries.find(
    ts => ts.yAxis === `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`
  );

  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="resourceSummaryAverageSizeChartWidget"
      title={t('Average %s Size', DATA_TYPE)}
      timeSeries={[decodedSeries, transferSeries, contentSeries].filter(defined)}
      aliases={FIELD_ALIASES}
      isLoading={isPending}
      error={error}
    />
  );
}
