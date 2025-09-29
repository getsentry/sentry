import {useMemo} from 'react';
import styled from '@emotion/styled';

import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {AlwaysHiddenMetricFields} from 'sentry/views/explore/metrics/constants';
import {useTraceMetricsAggregatesQuery} from 'sentry/views/explore/metrics/useTraceMetricsQuery';

export function MetricsSamplesTable() {
  const {data, isLoading, error} = useTraceMetricsAggregatesQuery({
    referrer: 'api.explore.metrics.samples-table',
  });

  const allFields = useMemo(() => {
    return Object.keys(data?.meta?.fields || {}).filter(
      field => !AlwaysHiddenMetricFields.includes(field)
    );
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
        aria-label={t('Metrics Samples')}
        isLoading={isLoading}
        error={error}
        data={tableData}
        columnOrder={allFields.map(field => ({
          key: field,
          name: field,
          width: COL_WIDTH_UNDEFINED,
        }))}
        columnSortBy={[]}
        grid={{
          renderHeadCell: column => {
            return column.name;
          },
          renderBodyCell: (column, dataRow) => {
            const value = dataRow[column.key];
            if (value === null || value === undefined) {
              return <EmptyValue>{t('(none)')}</EmptyValue>;
            }
            return value;
          },
        }}
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
