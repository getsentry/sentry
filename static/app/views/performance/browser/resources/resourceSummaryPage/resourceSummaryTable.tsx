import {Fragment} from 'react';
import {Link} from 'react-router';

import FileSize from 'sentry/components/fileSize';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import {RateUnits} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useResourcePagesQuery} from 'sentry/views/performance/browser/resources/utils/useResourcePageQuery';
import {useResourceSummarySort} from 'sentry/views/performance/browser/resources/utils/useResourceSummarySort';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';

type Row = {
  'avg(http.response_content_length)': number;
  'avg(span.self_time)': number;
  'spm()': number;
  transaction: string;
};

type Column = GridColumnHeader<keyof Row>;

function ResourceSummaryTable() {
  const location = useLocation();
  const {groupId} = useParams();
  const sort = useResourceSummarySort();
  const {data, isLoading, pageLinks} = useResourcePagesQuery(groupId, {sort});

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
    {
      key: 'avg(http.response_content_length)',
      width: COL_WIDTH_UNDEFINED,
      name: 'Avg Resource Size',
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
    if (key === 'avg(http.response_content_length)') {
      return <FileSize bytes={row[key]} />;
    }
    if (key === 'transaction') {
      return (
        <Link
          to={{
            pathname: location.pathname,
            query: {
              ...location.query,
              transaction: row[key],
            },
          }}
        >
          {row[key]}
        </Link>
      );
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
            key: sort.field,
            order: sort.kind,
          },
        ]}
        grid={{
          renderHeadCell: column =>
            renderHeadCell({
              column,
              location,
              sort,
            }),
          renderBodyCell,
        }}
        location={location}
      />
      <Pagination pageLinks={pageLinks} />
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
