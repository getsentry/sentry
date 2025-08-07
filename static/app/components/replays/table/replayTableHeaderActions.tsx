import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Flex} from 'sentry/components/core/layout/flex';
import DeleteReplays from 'sentry/components/replays/table/deleteReplays';
import {ReplaySelectColumn} from 'sentry/components/replays/table/replayTableColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
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
  const {countSelected, isAllSelected, selectAll, queryKey, selectedIds} =
    listItemCheckboxState;

  const queryOptions = parseQueryKey(queryKey).options;
  const queryString = queryOptions?.query?.query;
  return (
    <Fragment>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>
          <ReplaySelectColumn.Header
            columnIndex={0}
            listItemCheckboxState={listItemCheckboxState}
            replays={replays}
          />
        </SimpleTable.HeaderCell>
        <RemainingHeaderColumns>
          <DeleteReplays
            queryOptions={queryOptions}
            replays={replays}
            selectedIds={selectedIds}
          />
        </RemainingHeaderColumns>
      </SimpleTable.Header>

      {isAllSelected === 'indeterminate' ? (
        <FullGridAlert type="warning" system>
          <Flex justify="center" wrap="wrap" gap="md">
            {tn(
              'Selected %s visible replay.',
              'Selected %s visible replays.',
              countSelected
            )}
            <a onClick={selectAll}>
              {queryString
                ? tct('Select all replays that match: [queryString].', {
                    queryString: <var>{queryString}</var>,
                  })
                : t('Select all replays.')}
            </a>
          </Flex>
        </FullGridAlert>
      ) : null}
      {isAllSelected === true ? (
        <FullGridAlert type="warning" system>
          <Flex justify="center" wrap="wrap">
            <span>
              {queryString
                ? tct('Selected all replays matching: [queryString].', {
                    queryString: <var>{queryString}</var>,
                  })
                : countSelected > replays.length
                  ? t('Selected all %s+ replays.', replays.length)
                  : tn(
                      'Selected all %s replay.',
                      'Selected all %s replays.',
                      countSelected
                    )}
            </span>
          </Flex>
        </FullGridAlert>
      ) : null}
    </Fragment>
  );
}

const RemainingHeaderColumns = styled('div')`
  grid-column: 2 / -1;
`;

const FullGridAlert = styled(Alert)`
  grid-column: 1 / -1;
`;
