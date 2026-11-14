import {
  StreamGroupHeaderCell,
  StreamGroupHeaderRow,
  type StreamGroupColumn,
} from 'sentry/components/stream/groupColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

type Props = {
  columns: StreamGroupColumn[];
  square?: boolean;
};

export function GroupListHeader({columns, square}: Props) {
  return (
    <SimpleTable.Head>
      <StreamGroupHeaderRow square={square}>
        {columns.map(column => (
          <StreamGroupHeaderCell key={column.key} column={column} />
        ))}
      </StreamGroupHeaderRow>
    </SimpleTable.Head>
  );
}
