import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import {HOST} from 'sentry/views/starfish/utils/constants';

import {getSpanListQuery} from './queries';

type Props = {
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

export default function SpansTable({location}: Props) {
  const {isLoading: areSpansLoading, data: spansData} = useQuery<SpanDataRow[]>({
    queryKey: ['spans'],
    queryFn: () => fetch(`${HOST}/?query=${getSpanListQuery()}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  return (
    <GridEditable
      isLoading={areSpansLoading}
      data={spansData}
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
