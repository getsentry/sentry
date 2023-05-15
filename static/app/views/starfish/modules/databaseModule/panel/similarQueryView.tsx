import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import GridEditable from 'sentry/components/gridEditable';
import {useLocation} from 'sentry/utils/useLocation';
import {
  DataRow,
  Keys,
  similarity,
  TableColumnHeader,
} from 'sentry/views/starfish/modules/databaseModule/databaseTableView';
import {useQueryMainTable} from 'sentry/views/starfish/modules/databaseModule/queries';

type Props = {
  mainTableRow: DataRow;
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
    key: 'p50',
    name: 'p50',
  },
  {
    key: 'p95',
    name: 'p95',
  },
  {
    key: 'total_time',
    name: 'Total Time',
  },
];

function SimilarQueryView(props: Props) {
  const {mainTableRow} = props;
  const {isLoading, data} = useQueryMainTable({
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
      const diffQuery = (
        <div>
          {row.description.split(' ').map(word => {
            if (mainTableQueryWords.has(word)) {
              return `${word} `;
            }
            return (
              <span style={{color: theme.green400}} key={word}>
                {`${word} `}
              </span>
            );
          })}
        </div>
      );
      renderedValue = diffQuery;
    }
    const timeBasedKeys: Keys[] = ['p50', 'p95', 'total_time'];
    if ((['epm', ...timeBasedKeys] as Keys[]).includes(key)) {
      const val = row[key];
      const sign = val > mainTableRow[key] ? '+' : '';
      const percentage = (val / mainTableRow[key] - 1) * 100;

      let unit = '';
      if (timeBasedKeys.includes(key)) {
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
