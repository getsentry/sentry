import {useMemo} from 'react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  TraceSamplesTableColumns,
  TraceSamplesTableEmbeddedColumns,
} from 'sentry/views/explore/metrics/constants';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {useTraceTelemetry} from 'sentry/views/explore/metrics/hooks/useTraceTelemetry';
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
import {getMetricTableColumnType} from 'sentry/views/explore/metrics/utils';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

const RESULT_LIMIT = 50;
const EMBEDDED_RESULT_LIMIT = 100;
const TWO_MINUTE_DELAY = 120;
const MAX_TELEMETRY_WIDTH = 40;

export const SAMPLES_PANEL_MIN_WIDTH = 350;
export const WIDTH_WITH_TELEMETRY_ICONS_VISIBLE =
  SAMPLES_PANEL_MIN_WIDTH + MAX_TELEMETRY_WIDTH * 3;

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
  const fields = columns.filter(c => getMetricTableColumnType(c) !== 'stat');

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

  const traceIds = useMemo(() => {
    if (!data || embedded) {
      return [];
    }
    return data.map(row => row[TraceMetricKnownFieldKey.TRACE]).filter(Boolean);
  }, [data, embedded]);

  const {data: telemetryData} = useTraceTelemetry({
    enabled: Boolean(traceMetric?.name) && traceIds.length > 0 && !embedded,
    traceIds,
  });

  return (
    <SimpleTableWithHiddenColumns numColumns={columns.length - 1} embedded={embedded}>
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
              telemetryData={telemetryData}
              columns={columns}
              meta={meta}
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
    </SimpleTableWithHiddenColumns>
  );
}

const SimpleTableWithHiddenColumns = styled(StyledSimpleTable)<{
  embedded: boolean;
  numColumns: number;
}>`
  grid-template-columns: repeat(${p => p.numColumns}, min-content) 1fr;
  grid-column: 1 / -1;

  ${p =>
    !p.embedded &&
    `
    @container (max-width: ${SAMPLES_PANEL_MIN_WIDTH + MAX_TELEMETRY_WIDTH * 3}px) {
      grid-template-columns: repeat(${p.numColumns - 1}, min-content) 1fr;

      [data-column-name='errors'] {
        display: none;
      }
    }

    @container (max-width: ${SAMPLES_PANEL_MIN_WIDTH + MAX_TELEMETRY_WIDTH * 2}px) {
      grid-template-columns: repeat(${p.numColumns - 2}, min-content) 1fr;

      [data-column-name='spans'] {
        display: none;
      }
    }

    @container (max-width: ${SAMPLES_PANEL_MIN_WIDTH + MAX_TELEMETRY_WIDTH * 1}px) {
      grid-template-columns: repeat(${p.numColumns - 3}, min-content) 1fr;

      [data-column-name='logs'] {
        display: none;
      }
    }
  `}
`;
