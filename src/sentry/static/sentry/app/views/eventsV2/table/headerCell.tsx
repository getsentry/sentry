import React from 'react';

import {ColumnValueType, getAggregateAlias} from 'app/utils/discover/fields';

import {Alignments} from '../sortLink';
import {TableColumn, TableData, TableDataRow} from './types';

type ChildrenProps = {
  align: Alignments;
};

type Props = {
  children: (props: ChildrenProps) => React.ReactElement;
  column: TableColumn<keyof TableDataRow>;
  tableData: TableData | null | undefined;
};

function HeaderCell(props: Props) {
  const {children, column, tableData} = props;

  // establish alignment based on the type
  const alignedTypes: ColumnValueType[] = ['number', 'duration', 'integer', 'percentage'];
  let align: Alignments = alignedTypes.includes(column.type) ? 'right' : 'left';

  if (column.type === 'never') {
    // fallback to align the column based on the table metadata
    const maybeType =
      tableData && tableData.meta
        ? tableData.meta[getAggregateAlias(column.name)]
        : undefined;

    if (maybeType !== undefined && alignedTypes.includes(maybeType)) {
      align = 'right';
    }
  }

  return children({align});
}

export default HeaderCell;
