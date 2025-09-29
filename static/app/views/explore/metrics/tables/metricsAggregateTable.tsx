import {useMemo} from 'react';
import styled from '@emotion/styled';

import {GridEditable, GridEditableColumn} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {useTraceMetricsAggregatesQuery} from '../useTraceMetricsQuery';

export function MetricsAggregateTable() {
  const {data, isLoading, error} = useTraceMetricsAggregatesQuery({
    referrer: 'api.explore.metrics.aggregate-table',
  });

  const columns = useMemo<GridEditableColumn<any>[]>(() => {
    if (!data?.meta?.fields) {
      return [];
    }

    return Object.keys(data.meta.fields).map(field => ({
      key: field,
      name: field,
      width: 150,
    }));
  }, [data?.meta?.fields]);

  const tableData = useMemo(() => {
    return data?.data ?? [];
  }, [data?.data]);

  if (isLoading) {
    return <div>{t('Loading...')}</div>;
  }

  if (error) {
    return <div>{t('Error loading metrics')}</div>;
  }

  return (
    <TableWrapper>
      <GridEditable
        data={tableData}
        columnOrder={columns.map(c => c.key)}
        columnSortBy={[]}
        grid={{
          renderHeadCell: column => column.name,
          renderBodyCell: (column, dataRow) => {
            const value = dataRow[column.key];
            if (value === null || value === undefined) {
              return <EmptyValue>{t('(none)')}</EmptyValue>;
            }
            return value;
          },
        }}
        location={location}
      />
    </TableWrapper>
  );
}

const TableWrapper = styled('div')`
  flex: 1;
  overflow: auto;
`;

const EmptyValue = styled('span')`
  color: ${p => p.theme.gray300};
`;
