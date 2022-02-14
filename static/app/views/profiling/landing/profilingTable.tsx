import {useMemo} from 'react';
import {Location} from 'history';

import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Trace} from 'sentry/types/profiling/trace';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';

interface ProfilingTableProps {
  location: Location;
  traces: Trace[];
}

function ProfilingTable({location, traces}: ProfilingTableProps) {
  const data: TableDataRow[] = useMemo(
    () =>
      traces.map(trace => ({
        failed: Boolean(trace.failed), // makes this a required field
        ...trace,
      })),
    [traces]
  );

  return (
    <GridEditable
      isLoading={false}
      data={data}
      columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
      columnSortBy={[]}
      grid={{renderBodyCell}}
      location={location}
    />
  );
}

function renderBodyCell(
  column: TableColumn,
  dataRow: TableDataRow,
  _rowIndex: number,
  _columnIndex: number
) {
  const value = dataRow[column.key];

  switch (column.key) {
    case 'id':
      // TODO: this needs to be a link
      return <Container>{t('View Flamegraph')}</Container>;
    case 'failed':
      return (
        <Container>
          {status ? (
            <IconCheckmark size="sm" color="green300" isCircled />
          ) : (
            <IconClose size="sm" color="red300" isCircled />
          )}
        </Container>
      );
    case 'start_time_unix':
      return (
        <Container>
          <DateTime date={value} />
        </Container>
      );
    case 'trace_duration_ms':
      return (
        <NumberContainer>
          <Duration seconds={value / 1000} abbreviation />
        </NumberContainer>
      );
    default:
      return <Container>{value}</Container>;
  }
}

type TableColumnKey = keyof Trace;

type NonTableColumnKey =
  | 'device_locale'
  | 'device_manufacturer'
  | 'backtrace_available'
  | 'error_code'
  | 'error_code_name'
  | 'error_description'
  | 'span_annotations'
  | 'spans'
  | 'trace_annotations';

type TableColumn = GridColumnOrder<TableColumnKey>;

type TableDataRow = Omit<Record<TableColumnKey, any>, NonTableColumnKey>;

const COLUMN_ORDER: TableColumnKey[] = [
  'id',
  'failed',
  'app_version',
  'interaction_name',
  'start_time_unix',
  'trace_duration_ms',
  'device_model',
  'device_class',
];

const COLUMNS: Omit<Record<TableColumnKey, TableColumn>, NonTableColumnKey> = {
  id: {
    key: 'id',
    name: t('Flamegraph'),
    width: COL_WIDTH_UNDEFINED,
  },
  failed: {
    key: 'failed',
    name: t('Status'),
    width: COL_WIDTH_UNDEFINED,
  },
  app_version: {
    key: 'app_version',
    name: t('Version'),
    width: COL_WIDTH_UNDEFINED,
  },
  interaction_name: {
    key: 'interaction_name',
    name: t('Interaction Name'),
    width: COL_WIDTH_UNDEFINED,
  },
  start_time_unix: {
    key: 'start_time_unix',
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  trace_duration_ms: {
    key: 'trace_duration_ms',
    name: t('Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  device_model: {
    key: 'device_model',
    name: t('Device Model'),
    width: COL_WIDTH_UNDEFINED,
  },
  device_class: {
    key: 'device_class',
    name: t('Device Class'),
    width: COL_WIDTH_UNDEFINED,
  },
};

export {ProfilingTable};
