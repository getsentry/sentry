import {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';

type Props = {
  data: SpanDataRow[];
  isLoading: boolean;
  location: Location;
};

type SpanDataRow = {
  description: string;
  group_id: string;
  span_operation: string;
};

const COLUMN_ORDER = [
  {
    key: 'group_id',
    name: 'Group',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'span_operation',
    name: 'Operation',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'description',
    name: 'Description',
    width: COL_WIDTH_UNDEFINED,
  },
];

export default function SpansTable({location, data, isLoading}: Props) {
  return (
    <GridEditable
      isLoading={isLoading}
      data={data}
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

function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  return column.name;
}

function renderBodyCell(column: GridColumnHeader, row: SpanDataRow): React.ReactNode {
  return row[column.key];
}
