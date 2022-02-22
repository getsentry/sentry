import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';

import {TableColumn, TableDataRow} from './types';

function ProfilingTableCell(
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
            <IconClose size="sm" color="red300" isCircled />
          ) : (
            <IconCheckmark size="sm" color="green300" isCircled />
          )}
        </Container>
      );
    case 'start_time_unix':
      return (
        <Container>
          <DateTime date={value * 1000} />
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

export {ProfilingTableCell};
