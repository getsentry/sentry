import {CSSProperties, Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Truncate from 'sentry/components/truncate';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconArrow} from 'sentry/icons';
import {Series} from 'sentry/types/echarts';
import {useLocation} from 'sentry/utils/useLocation';
import {MultiSparkline} from 'sentry/views/starfish/components/sparkline';
import {Sort} from 'sentry/views/starfish/modules/databaseModule';
import {DataRow} from 'sentry/views/starfish/modules/databaseModule/databaseTableView';
import {TransactionListDataRow} from 'sentry/views/starfish/modules/databaseModule/panel';

export type PanelSort = Sort<TableColumnHeader>;

type Props = {
  isDataLoading: boolean;
  onClickSort: (sort: PanelSort) => void;
  row: DataRow;
  sort: PanelSort;
  spanP50Data: Series[];
  spmData: Series[];
  tableData: TransactionListDataRow[];
  tpmData: Series[];
  txnP50Data: Series[];
  markLine?: Series;
};

type Keys = 'transaction' | 'spm' | 'p50' | 'frequency' | 'uniqueEvents' | 'example';

type TableColumnHeader = GridColumnHeader<Keys>;

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'transaction',
    name: 'Transaction',
    width: 400,
  },
  {
    key: 'spm',
    name: 'TPM v SPM',
    width: 200,
  },
  {
    key: 'p50',
    name: 'Span p50 vs Txn p50',
    width: 200,
  },
];

function QueryTransactionTable(props: Props) {
  const {
    isDataLoading,
    tableData,
    sort,
    onClickSort,
    row,
    spmData,
    tpmData,
    spanP50Data,
    txnP50Data,
    markLine,
  } = props;
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
    const sortableKeys: Keys[] = ['p50', 'spm'];
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
    style['min-height'] = '40px';

    if (
      minMax[key] &&
      ((value as number) > minMax[key].max || (value as number) < minMax[key].min)
    ) {
      style.color = theme.red400;
    }
    const SpmSeries =
      spmData.length && spmData.find(item => item.seriesName === dataRow.transaction);
    const TpmSeries =
      tpmData.length && tpmData.find(item => item.seriesName === dataRow.transaction);
    const SP50Series =
      spanP50Data.length &&
      spanP50Data.find(item => item.seriesName === dataRow.transaction);
    const TP50Series =
      txnP50Data.length &&
      txnP50Data.find(item => item.seriesName === dataRow.transaction);
    if (key === 'spm' && SpmSeries && TpmSeries) {
      return (
        <MultiSparkline
          color={[CHART_PALETTE[4][0], CHART_PALETTE[4][3]]}
          series={[SpmSeries, TpmSeries]}
          markLine={markLine}
          width={column.width ? column.width - column.width / 5 : undefined}
          height={40}
        />
      );
    }
    if (key === 'transaction') {
      return (
        <Fragment>
          <Link
            to={`/starfish/span/${encodeURIComponent(row.group_id)}?${qs.stringify({
              transaction: dataRow.transaction,
            })}`}
          >
            <Truncate value={dataRow[column.key]} maxLength={50} />
          </Link>
          <span>
            Span appears {dataRow.frequency?.toFixed(2)}x per txn ({dataRow.uniqueEvents}{' '}
            total txns)
          </span>
          <Link to={`/performance/sentry:${dataRow.example}/`}>sample</Link>
        </Fragment>
      );
    }
    if (key === 'p50' && SP50Series && TP50Series) {
      return (
        <MultiSparkline
          color={[CHART_PALETTE[4][0], CHART_PALETTE[4][2]]}
          series={[SP50Series, TP50Series]}
          markLine={markLine}
          width={column.width ? column.width - column.width / 5 : undefined}
        />
      );
    }

    return <span style={style}>{dataRow[key]}</span>;
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
