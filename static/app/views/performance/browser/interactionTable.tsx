import {Link} from 'react-router';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import {useLocation} from 'sentry/utils/useLocation';

type Row = {
  component: string;
  p75: number;
  page: string;
  'span.action': string;
  'span.group': string;
};

type Column = GridColumnHeader<keyof Row>;

function InteractionsTable() {
  const location = useLocation();
  const columnOrder: GridColumnOrder<keyof Row>[] = [
    {key: 'span.group', width: COL_WIDTH_UNDEFINED, name: 'Interaction'},
    {key: 'page', width: COL_WIDTH_UNDEFINED, name: 'Page'},
    {key: 'p75', width: COL_WIDTH_UNDEFINED, name: 'Duration (p75)'},
  ];
  const data: Row[] = [
    {
      'span.group': 'Button',
      component: '<DownloadButton/>',
      p75: 23,
      page: '/performance',
      'span.action': 'click',
    },
  ];

  const sort: GridColumnSortBy<keyof Row> = {key: 'p75', order: 'desc'};

  const renderHeadCell = (col: Column) => {
    return <span>{col.name}</span>;
  };

  const renderBodyCell = (col: Column, row: Row) => {
    const {key} = col;
    if (key === 'span.group') {
      const spanGroup = row['span.group'];
      return (
        <Link to={`/performance/browser/interactions/${spanGroup}`}>
          {row['span.action']} on {row.component}
        </Link>
      );
    }
    return <span>{row[key]}</span>;
  };

  return (
    <GridEditable
      data={data}
      columnOrder={columnOrder}
      columnSortBy={[sort]}
      grid={{renderHeadCell, renderBodyCell}}
      location={location}
    />
  );
}

export default InteractionsTable;
