import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {
  getDurationChartTitle,
  getThroughputChartTitle,
} from 'sentry/views/insights/common/views/spans/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

import {DATA_TYPE, FIELD_ALIASES} from '../../settings';

const {
  SPAN_SELF_TIME,
  HTTP_RESPONSE_CONTENT_LENGTH,
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_TRANSFER_SIZE,
  RESOURCE_RENDER_BLOCKING_STATUS,
} = SpanMetricsField;

function ResourceSummaryCharts(props: {groupId: string}) {
  const filters = useResourceModuleFilters();

  const mutableSearch = MutableSearch.fromQueryObject({
    'span.group': props.groupId,
    ...(filters[RESOURCE_RENDER_BLOCKING_STATUS]
      ? {
          [RESOURCE_RENDER_BLOCKING_STATUS]: filters[RESOURCE_RENDER_BLOCKING_STATUS],
        }
      : {}),
    ...(filters[SpanMetricsField.USER_GEO_SUBREGION]
      ? {
          [SpanMetricsField.USER_GEO_SUBREGION]: `[${filters[SpanMetricsField.USER_GEO_SUBREGION].join(',')}]`,
        }
      : {}),
  });

  const {
    data: spanMetricsSeriesData,
    isPending: areSpanMetricsSeriesLoading,
    error: spanMetricsSeriesError,
  } = useSpanMetricsSeries(
    {
      search: mutableSearch,
      yAxis: [
        `spm()`,
        `avg(${SPAN_SELF_TIME})`,
        `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
        `avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`,
        `avg(${HTTP_RESPONSE_TRANSFER_SIZE})`,
      ],
      enabled: Boolean(props.groupId),
      transformAliasToInputFormat: true,
    },
    Referrer.RESOURCE_SUMMARY_CHARTS
  );

  if (spanMetricsSeriesData) {
    spanMetricsSeriesData[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`].lineStyle = {
      type: 'dashed',
    };
    spanMetricsSeriesData[`avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`].lineStyle = {
      type: 'dashed',
    };
  }

  return (
    <Fragment>
      <ModuleLayout.Third>
        <InsightsLineChartWidget
          title={getThroughputChartTitle('resource')}
          series={[spanMetricsSeriesData?.[`spm()`]]}
          isLoading={areSpanMetricsSeriesLoading}
          error={spanMetricsSeriesError}
        />
      </ModuleLayout.Third>

      <ModuleLayout.Third>
        <InsightsLineChartWidget
          title={getDurationChartTitle('resource')}
          series={[spanMetricsSeriesData?.[`avg(${SPAN_SELF_TIME})`]]}
          isLoading={areSpanMetricsSeriesLoading}
          error={spanMetricsSeriesError}
        />
      </ModuleLayout.Third>

      <ModuleLayout.Third>
        <InsightsLineChartWidget
          title={t('Average %s Size', DATA_TYPE)}
          series={[
            spanMetricsSeriesData?.[`avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`],
            spanMetricsSeriesData?.[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`],
            spanMetricsSeriesData?.[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`],
          ]}
          aliases={FIELD_ALIASES}
          isLoading={areSpanMetricsSeriesLoading}
          error={spanMetricsSeriesError}
        />
      </ModuleLayout.Third>
    </Fragment>
  );
}

export default ResourceSummaryCharts;
