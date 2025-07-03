import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {ReplaySelectColumn} from 'sentry/components/replays/table/replayTableColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';

interface Props {
  listItemCheckboxState: ReturnType<typeof useListItemCheckboxContext>;
}

export default function ReplayTableHeaderActions({listItemCheckboxState}: Props) {
  const {countSelected, isAllSelected, selectAll, queryKey} = listItemCheckboxState;

  const queryOptions = queryKey?.at(-1);
  const queryString =
    typeof queryOptions === 'string' ? undefined : queryOptions?.query?.query;
  return (
    <Fragment>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>
          <ReplaySelectColumn.Header
            columnIndex={0}
            listItemCheckboxState={listItemCheckboxState}
          />
        </SimpleTable.HeaderCell>
        <RemainingHeaderColumns>
          <Button size="xs" onClick={() => {}}>
            {t('Delete')}
          </Button>
        </RemainingHeaderColumns>
      </SimpleTable.Header>

      {isAllSelected === 'indeterminate' ? (
        <FullGridAlert type="warning" system>
          <Flex justify="center" wrap="wrap" gap={space(1)}>
            {t('Selected %s replays.', countSelected)}
            <a onClick={selectAll}>
              {queryString
                ? tct('Select all replays that matching: [queryString].', {
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
                : t('Selected all replays.')}
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
