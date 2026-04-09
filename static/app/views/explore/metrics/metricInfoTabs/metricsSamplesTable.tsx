import {useMemo} from 'react';
import styled from '@emotion/styled';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
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
  TraceMetricKnownFieldKey,
  type TraceMetricEventsResponseItem,
} from 'sentry/views/explore/metrics/types';
import {mapMetricUnitToFieldType} from 'sentry/views/explore/metrics/utils';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

const RESULT_LIMIT = 50;
const EMBEDDED_RESULT_LIMIT = 100;
const TWO_MINUTE_DELAY = 120;

export const SAMPLES_PANEL_MIN_WIDTH = 350;

interface MetricsSamplesTableProps {
  embedded?: boolean;
  isMetricOptionsEmpty?: boolean;
  overrideTableData?: TraceMetricEventsResponseItem[];
  traceMetric?: TraceMetric;
}

export function MetricsSamplesTable({
  traceMetric,
  embedded = false,
  isMetricOptionsEmpty,
  overrideTableData,
}: MetricsSamplesTableProps) {
  const columns = embedded ? TraceSamplesTableEmbeddedColumns : TraceSamplesTableColumns;
  const fields = getTraceSamplesTableFields(columns);

  const {
    result: {data},
    meta = {fields: {}, units: {}},
    error,
    isFetching,
  } = useMetricSamplesTable({
    disabled: embedded ? !!overrideTableData : !traceMetric?.name || isMetricOptionsEmpty,
    limit: embedded ? EMBEDDED_RESULT_LIMIT : RESULT_LIMIT,
    traceMetric,
    fields,
    ingestionDelaySeconds: TWO_MINUTE_DELAY,
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
    <SimpleTableGrid embedded={embedded}>
      {isFetching && <TransparentLoadingMask />}
      <MetricsSamplesTableHeader columns={columns} embedded={embedded} />
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
              embedded={embedded}
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
  embedded: boolean;
}>`
  grid-template-columns: ${p =>
    p.embedded
      ? 'min-content min-content min-content minmax(0, 1fr) min-content min-content'
      : 'min-content min-content minmax(0, 1fr) min-content min-content'};
  grid-column: 1 / -1;
`;
