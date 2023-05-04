import {CSSProperties} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {IconArrow} from 'sentry/icons';
import {useLocation} from 'sentry/utils/useLocation';
import {Sort} from 'sentry/views/starfish/modules/databaseModule';
import {DataRow} from 'sentry/views/starfish/modules/databaseModule/databaseTableView';
import {TransactionListDataRow} from 'sentry/views/starfish/modules/databaseModule/panel';

export type PanelSort = Sort<TableColumnHeader>;

type Props = {
  isDataLoading: boolean;
  onClickSort: (sort: PanelSort) => void;
  row: DataRow;
  sort: PanelSort;
  tableData: TransactionListDataRow[];
};

type Keys = 'transaction' | 'p75' | 'count' | 'frequency' | 'uniqueEvents';

type TableColumnHeader = GridColumnHeader<Keys>;

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'transaction',
    name: 'Transaction',
    width: 400,
  },
  {
    key: 'p75',
    name: 'p75',
  },
  {
    key: 'count',
    name: 'Count',
  },
  {
    key: 'frequency',
    name: 'Frequency',
  },
  {
    key: 'uniqueEvents',
    name: 'Total Events',
  },
];

function QueryTransactionTable(props: Props) {
  const {isDataLoading, tableData, sort, onClickSort, row} = props;
  const location = useLocation();
  const theme = useTheme();
  const minMax = calculateOutlierMinMax(tableData);

  const onSortClick = (col: TableColumnHeader) => {
    let direction: 'desc' | 'asc' | undefined = undefined;
    if (!sort.direction || col.key !== sort.sortHeader?.key) {
      direction = 'desc';
    } else if (sort.direction === 'desc') {
      direction = 'asc';
    }
    onClickSort({direction, sortHeader: col});
  };

  const renderHeadCell = (col: TableColumnHeader): React.ReactNode => {
    const {key, name} = col;
    const sortableKeys: Keys[] = ['p75', 'count'];
    if (sortableKeys.includes(key)) {
      const isBeingSorted = col.key === sort.sortHeader?.key;
      const direction = isBeingSorted ? sort.direction : undefined;
      return (
        <SortableHeader
          onClick={() => onSortClick(col)}
          direction={direction}
          title={name}
        />
      );
    }
    return <span>{name}</span>;
  };

  const renderBodyCell = (
    column: TableColumnHeader,
    dataRow: TransactionListDataRow
  ): React.ReactNode => {
    const {key} = column;
    const value = dataRow[key];
    const style: CSSProperties = {};
    let rendereredValue = value;

    if (
      minMax[key] &&
      ((value as number) > minMax[key].max || (value as number) < minMax[key].min)
    ) {
      style.color = theme.red400;
    }
    if (key === 'transaction') {
      return (
        <Link
          to={`/starfish/span/${encodeURIComponent(row.group_id)}?${qs.stringify({
            transaction: dataRow.transaction,
          })}`}
        >
          {dataRow[column.key]}
        </Link>
      );
    }
    if (key === 'p75') {
      rendereredValue = `${dataRow[key]?.toFixed(2)}ms`;
    }
    if (key === 'frequency') {
      rendereredValue = dataRow[key]?.toFixed(2);
    }

    return <span style={style}>{rendereredValue}</span>;
  };
  return (
    <GridEditable
      isLoading={isDataLoading}
      data={tableData}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell: (column: TableColumnHeader, dataRow: TransactionListDataRow) =>
          renderBodyCell(column, dataRow),
      }}
      location={location}
    />
  );
}

export function SortableHeader({title, direction, onClick}) {
  const arrow = !direction ? null : (
    <StyledIconArrow size="xs" direction={direction === 'desc' ? 'down' : 'up'} />
  );
  return (
    <HeaderWrapper onClick={onClick}>
      {title} {arrow}
    </HeaderWrapper>
  );
}

// Calculates the outlier min max for all number based rows based on the IQR Method
const calculateOutlierMinMax = (
  data: TransactionListDataRow[]
): Record<string, {max: number; min: number}> => {
  const minMax: Record<string, {max: number; min: number}> = {};
  if (data.length > 0) {
    Object.entries(data[0]).forEach(([colKey, value]) => {
      if (typeof value === 'number') {
        minMax[colKey] = findOutlierMinMax(data, colKey);
      }
    });
  }
  return minMax;
};

function findOutlierMinMax(data: any[], property: string): {max: number; min: number} {
  const sortedValues = [...data].sort((a, b) => a[property] - b[property]);

  if (data.length < 4) {
    return {min: data[0][property], max: data[data.length - 1][property]};
  }

  const q1 = sortedValues[Math.floor(sortedValues.length * (1 / 4))][property];
  const q3 = sortedValues[Math.ceil(sortedValues.length * (3 / 4))][property];
  const iqr = q3 - q1;

  return {min: q1 - iqr * 1.5, max: q3 + iqr * 1.5};
}

const HeaderWrapper = styled('div')`
  cursor: pointer;
`;

const StyledIconArrow = styled(IconArrow)`
  vertical-align: top;
`;

export default QueryTransactionTable;
