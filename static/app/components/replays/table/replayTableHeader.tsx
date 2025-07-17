import type {ReplayTableColumn} from 'sentry/components/replays/table/replayTableColumns';
import ReplayTableHeaderActions from 'sentry/components/replays/table/replayTableHeaderActions';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {Sort} from 'sentry/utils/discover/fields';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  columns: readonly ReplayTableColumn[];
  replays: ReplayListRecord[];
  onSortClick?: (key: string) => void;
  sort?: Sort;
};

export default function ReplayTableHeader({columns, replays, onSortClick, sort}: Props) {
  const listItemCheckboxState = useListItemCheckboxContext();

  if (listItemCheckboxState.isAnySelected) {
    return (
      <ReplayTableHeaderActions
        listItemCheckboxState={listItemCheckboxState}
        replays={replays}
      />
    );
  }

  return (
    <SimpleTable.Header>
      {columns.map(({Header, sortKey}, columnIndex) => (
        <SimpleTable.HeaderCell
          key={`${sortKey}-${columnIndex}`}
          handleSortClick={
            onSortClick && sortKey ? () => onSortClick(sortKey) : undefined
          }
          sort={sortKey && sort?.field === sortKey ? sort.kind : undefined}
        >
          {typeof Header === 'function'
            ? Header({columnIndex, listItemCheckboxState, replays})
            : Header}
        </SimpleTable.HeaderCell>
      ))}
    </SimpleTable.Header>
  );
}
