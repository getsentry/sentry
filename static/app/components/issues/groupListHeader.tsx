import {
  StreamGroupHeaderCell,
  type StreamGroupColumn,
} from 'sentry/components/stream/groupColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

type Props = {
  columns: StreamGroupColumn[];
  selectionEnabled: boolean;
};

export function GroupListHeader({columns, selectionEnabled}: Props) {
  return (
    <SimpleTable.Head>
      <SimpleTable.HeaderRow>
        {columns.map(column => (
          <StreamGroupHeaderCell
            key={column.key}
            column={column}
            selectionEnabled={selectionEnabled}
          />
        ))}
      </SimpleTable.HeaderRow>
    </SimpleTable.Head>
  );
}
