import {t} from 'sentry/locale';
import {useParams} from 'sentry/utils/useParams';
import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {DATA_TYPE, FIELD_ALIASES} from 'sentry/views/insights/browser/resources/settings';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {
  useResourceSummarySeries,
  useResourceSummarySeriesSearch,
} from 'sentry/views/insights/common/components/widgets/hooks/useResourceSummarySeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {
  HTTP_RESPONSE_CONTENT_LENGTH,
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_TRANSFER_SIZE,
} = SpanMetricsField;

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

  if (data) {
    data[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`].lineStyle = {
      type: 'dashed',
    };
    data[`avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`].lineStyle = {
      type: 'dashed',
    };
  }
  return (
    <InsightsLineChartWidget
      {...props}
      queryInfo={{search, referrer}}
      id="resourceSummaryAverageSizeChartWidget"
      title={t('Average %s Size', DATA_TYPE)}
      series={[
        data?.[`avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`],
        data?.[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`],
        data?.[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`],
      ]}
      aliases={FIELD_ALIASES}
      isLoading={isPending}
      error={error}
    />
  );
}
