import {Fragment} from 'react';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import {RateUnits} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useResourcePagesQuery} from 'sentry/views/performance/browser/resources/utils/useResourcePageQuery';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';

type Row = {
  'avg(span.self_time)': number;
  'spm()': number;
  transaction: string;
};

type Column = GridColumnHeader<keyof Row>;

function ResourceSummaryTable() {
  const location = useLocation();
  const {groupId} = useParams();
  const {data, isLoading} = useResourcePagesQuery(groupId);

  const columnOrder: GridColumnOrder<keyof Row>[] = [
    {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Found on page'},
    {
      key: 'spm()',
      width: COL_WIDTH_UNDEFINED,
      name: 'Throughput',
    },
    {
      key: 'avg(span.self_time)',
      width: COL_WIDTH_UNDEFINED,
      name: 'Avg Duration',
    },
  ];

  const renderBodyCell = (col: Column, row: Row) => {
    const {key} = col;
    if (key === 'spm()') {
      return <ThroughputCell rate={row[key] * 60} unit={RateUnits.PER_SECOND} />;
    }
    if (key === 'avg(span.self_time)') {
      return <DurationCell milliseconds={row[key]} />;
    }
    return <span>{row[key]}</span>;
  };

  return (
    <Fragment>
      <GridEditable
        data={data || []}
        isLoading={isLoading}
        columnOrder={columnOrder}
        columnSortBy={[
          {
            key: 'avg(span.self_time)',
            order: 'desc',
          },
        ]}
        grid={{
          renderHeadCell: column =>
            renderHeadCell({
              column,
              location,
              sort: {
                field: 'avg(span.self_time)',
                kind: 'desc',
              },
            }),
          renderBodyCell,
        }}
        location={location}
      />
    </Fragment>
  );
}

export const getActionName = (transactionOp: string) => {
  switch (transactionOp) {
    case 'ui.action.click':
      return 'Click';
    default:
      return transactionOp;
  }
};

export default ResourceSummaryTable;
