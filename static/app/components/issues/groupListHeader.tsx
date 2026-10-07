import {
  StreamGroupHeaderCell,
  type StreamGroupColumn,
} from 'sentry/components/stream/groupColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

type Props = {
  columns: StreamGroupColumn[];
};

export function GroupListHeader({columns}: Props) {
  return (
    <SimpleTable.Head>
      <SimpleTable.HeaderRow>
        {columns.map(column => (
          <StreamGroupHeaderCell key={column.key} column={column} />
        ))}
      </SimpleTable.HeaderRow>
    </SimpleTable.Head>
  );
}
