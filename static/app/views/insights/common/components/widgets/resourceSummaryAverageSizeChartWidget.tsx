import {t} from 'sentry/locale';
import {useParams} from 'sentry/utils/useParams';
import {DATA_TYPE, FIELD_ALIASES} from 'sentry/views/insights/browser/resources/settings';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useResourceSummarySeries} from 'sentry/views/insights/common/components/widgets/hooks/useResourceSummarySeries';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {
  HTTP_RESPONSE_CONTENT_LENGTH,
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_TRANSFER_SIZE,
} = SpanMetricsField;

export function ResourceSummaryAverageSizeChartWidget(props: LoadableChartWidgetProps) {
  const {groupId} = useParams();

  const {data, isPending, error} = useResourceSummarySeries({
    groupId,
    pageFilters: props.pageFilters,
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
