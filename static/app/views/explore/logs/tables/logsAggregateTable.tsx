import styled from '@emotion/styled';

import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
import {TableBodyCell, TableHeadCell} from 'sentry/views/explore/components/table';
import {
  useLogsAggregate,
  useLogsGroupBy,
  useSetLogsCursor,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useLogsAggregatesQuery} from 'sentry/views/explore/logs/useLogsQuery';

export function LogsAggregateTable() {
  const {data, pageLinks, isLoading, error} = useLogsAggregatesQuery({
    limit: 50,
  });

  const setLogsCursor = useSetLogsCursor();
  const groupBy = useLogsGroupBy();
  const aggregate = useLogsAggregate();

  const fields: string[] = [];
  if (groupBy) {
    fields.push(groupBy);
  }
  fields.push(aggregate);

  return (
    <TableContainer>
      <GridEditable
        aria-label={t('Aggregates')}
        isLoading={isLoading}
        error={error}
        data={data?.data ?? []}
        columnOrder={fields.map(field => ({
          key: field,
          name: field,
          width: COL_WIDTH_UNDEFINED,
        }))}
        columnSortBy={[
          {
            key: fields[0]!,
            order: 'desc',
          },
        ]}
        grid={{
          renderHeadCell: (column, i) => {
            const field = column.name;
            let label: string;
            const func = parseFunction(field);
            if (func) {
              label = prettifyParsedFunction(func);
            } else {
              label = prettifyTagKey(field);
            }

            return (
              <TableHeadCell key={i} isFirst={i === 0}>
                {label}
              </TableHeadCell>
            );
          },
          renderBodyCell: (column, row) => (
            <TableBodyCell key={row[column.key]}>{row[column.key]}</TableBodyCell>
          ),
        }}
      />
      <Pagination pageLinks={pageLinks} onCursor={setLogsCursor} />
    </TableContainer>
  );
}

const TableContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;
