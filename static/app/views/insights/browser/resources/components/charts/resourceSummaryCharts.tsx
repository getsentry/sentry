import {Fragment} from 'react';

import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {SpanMetricsField} from 'sentry/views/insights/types';

import {AssetSizeChart} from './assetSizeChart';
import {DurationChart} from './durationChart';
import {ThroughputChart} from './throughputChart';

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

  const {data: spanMetricsSeriesData, isPending: areSpanMetricsSeriesLoading} =
    useSpanMetricsSeries(
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
        <ThroughputChart
          series={spanMetricsSeriesData?.[`spm()`]}
          isLoading={areSpanMetricsSeriesLoading}
        />
      </ModuleLayout.Third>

      <ModuleLayout.Third>
        <DurationChart
          series={[spanMetricsSeriesData?.[`avg(${SPAN_SELF_TIME})`]]}
          isLoading={areSpanMetricsSeriesLoading}
        />
      </ModuleLayout.Third>

      <ModuleLayout.Third>
        <AssetSizeChart
          series={[
            spanMetricsSeriesData?.[`avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`],
            spanMetricsSeriesData?.[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`],
            spanMetricsSeriesData?.[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`],
          ]}
          isLoading={areSpanMetricsSeriesLoading}
        />
      </ModuleLayout.Third>
    </Fragment>
  );
}

export default ResourceSummaryCharts;
