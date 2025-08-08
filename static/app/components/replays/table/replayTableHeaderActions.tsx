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
    <Wrapper>
      <SimpleTable.HeaderCell style={{gridColumn: '1 / 1'}}>
        <ReplaySelectColumn.Header
          columnIndex={0}
          listItemCheckboxState={listItemCheckboxState}
          replays={replays}
        />
      </SimpleTable.HeaderCell>

      <RemaingingItems>
        <DeleteReplays
          queryOptions={queryOptions}
          replays={replays}
          selectedIds={selectedIds}
        />
      </RemaingingItems>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  grid-row: 1 / 1;
  z-index: ${p => p.theme.zIndex.initial};
`;

const RemaingingItems = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  grid-column: 2 / -1;
`;
