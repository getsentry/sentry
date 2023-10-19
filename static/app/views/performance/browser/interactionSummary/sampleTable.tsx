import {Fragment} from 'react';
import {Link} from 'react-router';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import {useLocation} from 'sentry/utils/useLocation';
import {useInteractionQuery} from 'sentry/views/performance/browser/interactionSummary/useInteractionQuery';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';

type Row = {
  eventId: string;
  project: string;
  'transaction.duration': number;
};

type Column = GridColumnHeader<keyof Row>;

function InteractionSampleTable() {
  const location = useLocation();
  const columnOrder: GridColumnOrder<keyof Row>[] = [
    {key: 'eventId', width: COL_WIDTH_UNDEFINED, name: 'event'},
    {key: 'transaction.duration', width: COL_WIDTH_UNDEFINED, name: 'duration'},
  ];
  const {data, isLoading, pageLinks} = useInteractionQuery();
  const tableData: Row[] = data.length ? data : [];

  const renderBodyCell = (col: Column, row: Row) => {
    const {key} = col;
    if (key === 'transaction.duration') {
      return <DurationCell milliseconds={row[key]} />;
    }
    if (key === 'eventId') {
      return (
        <Link to={`/performance/${row.project}:${row.eventId}`}>
          {row.eventId.slice(0, 8)}
        </Link>
      );
    }
    return <span>{row[key]}</span>;
  };

  return (
    <Fragment>
      <GridEditable
        data={tableData}
        isLoading={isLoading}
        columnOrder={columnOrder}
        columnSortBy={[]}
        grid={{
          renderHeadCell: column =>
            renderHeadCell({
              column,
              location,
            }),
          renderBodyCell,
        }}
        location={location}
      />
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

export default InteractionSampleTable;
