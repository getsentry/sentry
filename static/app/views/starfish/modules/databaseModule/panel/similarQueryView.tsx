import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import GridEditable from 'sentry/components/gridEditable';
import {useLocation} from 'sentry/utils/useLocation';
import {
  DataRow,
  MainTableSort,
  similarity,
  TableColumnHeader,
} from 'sentry/views/starfish/modules/databaseModule/databaseTableView';
import {useQueryMainTable} from 'sentry/views/starfish/modules/databaseModule/queries';

type Props = {
  mainTableRow: DataRow;
  mainTableSort: MainTableSort;
};

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'description',
    name: 'Query',
    width: 300,
  },
  {
    key: 'epm',
    name: 'Tpm',
  },
  {
    key: 'p75',
    name: 'p75',
  },
  {
    key: 'total_time',
    name: 'Total Time',
  },
];

function SimilarQueryView(props: Props) {
  const {mainTableRow, mainTableSort} = props;
  const {isLoading, data} = useQueryMainTable({
    sortDirection: mainTableSort.direction,
    sortKey: mainTableSort.sortHeader?.key,
    limit: 410,
  });
  const location = useLocation();
  const theme = useTheme();

  const similarQueries = data.filter(
    row => similarity(row.description, mainTableRow.description) > 0.8
  );

  const renderHeadCell = (col): React.ReactNode => {
    return <span>{col.name}</span>;
  };
  const renderBodyCell = (column: TableColumnHeader, row: DataRow): React.ReactNode => {
    const {key} = column;

    let renderedValue: React.ReactNode = row[key];
    if (key === 'description') {
      const mainTableQueryWords = new Set(mainTableRow.description.split(' '));
      renderedValue = (
        <Fragment>
          {row.description.split(' ').map(word => {
            if (mainTableQueryWords.has(word)) {
              return <span key={word}>{word}</span>;
            }
            return (
              <span style={{color: theme.green400}} key={word}>
                {word}{' '}
              </span>
            );
          })}
        </Fragment>
      );
    }
    if (key === 'epm' || key === 'p75' || key === 'total_time') {
      const val = row[key];
      const sign = val > mainTableRow[key] ? '+' : '';
      const percentage = (val / mainTableRow[key] - 1) * 100;

      let unit = '';
      if (key === 'p75' || key === 'total_time') {
        unit = 'ms';
      }

      renderedValue = (
        <Fragment>
          {val.toFixed(3)}
          {unit} ({sign}
          <span style={{color: sign ? theme.red400 : theme.green400}}>
            {percentage.toFixed(2)}%
          </span>
          )
        </Fragment>
      );
    }
    return <span>{renderedValue}</span>;
  };
  if (!isLoading && similarQueries.length > 0) {
    return (
      <GridEditable
        isLoading={isLoading}
        data={similarQueries as any}
        columnOrder={COLUMN_ORDER}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
        location={location}
      />
    );
  }
  return <Fragment />;
}

export default SimilarQueryView;
