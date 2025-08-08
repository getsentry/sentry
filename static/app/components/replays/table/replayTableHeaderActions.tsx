import styled from '@emotion/styled';

import DeleteReplays from 'sentry/components/replays/table/deleteReplays';
import {ReplaySelectColumn} from 'sentry/components/replays/table/replayTableColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {parseQueryKey} from 'sentry/utils/queryClient';
import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  listItemCheckboxState: ReturnType<typeof useListItemCheckboxContext>;
  replays: ReplayListRecord[];
}

export default function ReplayTableHeaderActions({
  listItemCheckboxState,
  replays,
}: Props) {
  const {queryKey, selectedIds} = listItemCheckboxState;
  const queryOptions = parseQueryKey(queryKey).options;

  return (
    <Header>
      <FirstCell>
        <ReplaySelectColumn.Header
          columnIndex={0}
          listItemCheckboxState={listItemCheckboxState}
          replays={replays}
        />
      </FirstCell>
      <RemaingingCells>
        <DeleteReplays
          queryOptions={queryOptions}
          replays={replays}
          selectedIds={selectedIds}
        />
      </RemaingingCells>
    </Header>
  );
}

const Header = styled(SimpleTable.Header)`
  grid-row: 1;
  z-index: ${p => p.theme.zIndex.initial};
`;

const FirstCell = styled(SimpleTable.HeaderCell)`
  grid-column: 1;
`;

const RemaingingCells = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  grid-column: 2 / -1;
`;
