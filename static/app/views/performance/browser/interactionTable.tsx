import {Fragment} from 'react';
import {Link} from 'react-router';
import * as qs from 'query-string';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import {useLocation} from 'sentry/utils/useLocation';
import {BrowserStarfishFields} from 'sentry/views/performance/browser/useBrowserFilters';
import {ValidSort} from 'sentry/views/performance/browser/useBrowserSort';
import {useInteractionsQuery} from 'sentry/views/performance/browser/useInteractionsQuery';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {renderHeadCell} from 'sentry/views/starfish/components/tableCells/renderHeadCell';
import {TextAlignRight} from 'sentry/views/starfish/components/textAlign';

type Row = {
  'count()': number;
  interactionElement: string;
  'p75(transaction.duration)': number;
  'span.group': string;
  transaction: string;
  'transaction.op': string;
};

type Column = GridColumnHeader<keyof Row>;

type Props = {
  sort: ValidSort;
};

function InteractionsTable({sort}: Props) {
  const location = useLocation();
  const columnOrder: GridColumnOrder<keyof Row>[] = [
    {key: 'span.group', width: COL_WIDTH_UNDEFINED, name: 'Interaction'},
    {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Page'},
    {key: 'count()', width: COL_WIDTH_UNDEFINED, name: 'Count'},
    {
      key: 'p75(transaction.duration)',
      width: COL_WIDTH_UNDEFINED,
      name: 'Duration (p75)',
    },
  ];
  const {data, isLoading, pageLinks} = useInteractionsQuery({sort});
  const tableData: Row[] =
    !isLoading && data.length
      ? data.map(row => ({
          'span.group': 'NOT IMPLEMENTED',
          ...row,
        }))
      : [];

  const renderBodyCell = (col: Column, row: Row) => {
    const {key} = col;
    if (key === 'span.group') {
      return (
        <Link
          to={`/performance/browser/interactions/summary/?${qs.stringify({
            [BrowserStarfishFields.COMPONENT]: row.interactionElement,
            [BrowserStarfishFields.PAGE]: row.transaction,
            [BrowserStarfishFields.TRANSACTION_OP]: row['transaction.op'],
          })}`}
        >
          {getActionName(row['transaction.op'])}
          <span style={{fontWeight: 'bold'}}> {row.interactionElement}</span>
        </Link>
      );
    }
    if (key === 'p75(transaction.duration)') {
      return <DurationCell milliseconds={row[key]} />;
    }
    if (key === 'count()') {
      return <TextAlignRight>{row[key]}</TextAlignRight>;
    }
    return <span>{row[key]}</span>;
  };

  return (
    <Fragment>
      <GridEditable
        data={tableData}
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

export default InteractionsTable;
