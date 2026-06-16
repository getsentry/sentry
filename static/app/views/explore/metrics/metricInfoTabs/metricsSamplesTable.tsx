import {useMemo} from 'react';
import styled from '@emotion/styled';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import {
  getTraceSamplesTableFields,
  TraceSamplesTableColumns,
  TraceSamplesTableEmbeddedColumns,
} from 'sentry/views/explore/metrics/constants';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {
  StyledSimpleTable,
  StyledSimpleTableBody,
  TransparentLoadingMask,
} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import {MetricsSamplesTableHeader} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTableHeader';
import {SampleTableRow} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTableRow';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  DEFAULT_METRICS_SAMPLES_TABLE_SOURCE,
  isEmbeddedMetricsSamplesTableSource,
  type MetricsSamplesTableSource,
  TraceMetricKnownFieldKey,
  type TraceMetricEventsResponseItem,
} from 'sentry/views/explore/metrics/types';
import {mapMetricUnitToFieldType} from 'sentry/views/explore/metrics/utils';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

const RESULT_LIMIT = 50;
const EMBEDDED_RESULT_LIMIT = 100;
const TWO_MINUTE_DELAY = 120;

interface MetricsSamplesTableProps {
  isMetricOptionsEmpty?: boolean;
  overrideTableData?: TraceMetricEventsResponseItem[];
  source?: MetricsSamplesTableSource;
  traceMetric?: TraceMetric;
}

export function MetricsSamplesTable({
  traceMetric,
  source = DEFAULT_METRICS_SAMPLES_TABLE_SOURCE,
  isMetricOptionsEmpty,
  overrideTableData,
}: MetricsSamplesTableProps) {
  const isEmbedded = isEmbeddedMetricsSamplesTableSource(source);
  const columns = isEmbedded
    ? TraceSamplesTableEmbeddedColumns
    : TraceSamplesTableColumns;
  const fields = getTraceSamplesTableFields(columns);

  const {
    result: {data},
    meta = {fields: {}, units: {}},
    error,
    isFetching,
  } = useMetricSamplesTable({
    disabled: isEmbedded
      ? !!overrideTableData
      : !traceMetric?.name || isMetricOptionsEmpty,
    limit: isEmbedded ? EMBEDDED_RESULT_LIMIT : RESULT_LIMIT,
    traceMetric,
    fields,
    ingestionDelaySeconds: TWO_MINUTE_DELAY,
    staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
  });

  const metaWithValueUnit = useMemo<EventsMetaType>(() => {
    const {fieldType, unit} = mapMetricUnitToFieldType(traceMetric?.unit);
    return {
      ...meta,
      fields: {
        ...meta.fields,
        [TraceMetricKnownFieldKey.METRIC_VALUE]: fieldType,
      },
      units: {
        ...meta.units,
        [TraceMetricKnownFieldKey.METRIC_VALUE]: unit ?? '',
      },
    };
  }, [meta, traceMetric?.unit]);

  return (
    <SimpleTableGrid source={source}>
      {isFetching && <TransparentLoadingMask />}
      <MetricsSamplesTableHeader columns={columns} source={source} />
      <StyledSimpleTableBody>
        {!overrideTableData?.length && error ? (
          <SimpleTable.Empty style={{minHeight: '140px'}}>
            <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
          </SimpleTable.Empty>
        ) : overrideTableData?.length || data?.length ? (
          (overrideTableData ?? data ?? []).map((row, i) => (
            <SampleTableRow
              key={i}
              row={row}
              columns={columns}
              meta={metaWithValueUnit}
              source={source}
            />
          ))
        ) : isFetching ? (
          <SimpleTable.Empty style={{minHeight: '140px'}}>
            <LoadingIndicator size={40} style={{margin: '1em 1em'}} />
          </SimpleTable.Empty>
        ) : (
          <SimpleTable.Empty style={{minHeight: '140px'}}>
            <GenericWidgetEmptyStateWarning title={t('No samples found')} message="" />
          </SimpleTable.Empty>
        )}
      </StyledSimpleTableBody>
    </SimpleTableGrid>
  );
}

const SimpleTableGrid = styled(StyledSimpleTable)<{
  source: MetricsSamplesTableSource;
}>`
  grid-template-columns: ${p =>
    isEmbeddedMetricsSamplesTableSource(p.source)
      ? `${p.theme.space['3xl']} min-content min-content minmax(0, 1fr) min-content min-content`
      : `${p.theme.space['3xl']} min-content minmax(0, 1fr) min-content min-content`};
  grid-column: 1 / -1;
`;
