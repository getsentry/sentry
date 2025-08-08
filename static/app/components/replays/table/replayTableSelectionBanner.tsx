import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Flex} from 'sentry/components/core/layout/flex';
import {t, tct, tn} from 'sentry/locale';
import type {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {parseQueryKey} from 'sentry/utils/queryClient';
import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  listItemCheckboxState: ReturnType<typeof useListItemCheckboxContext>;
  replays: ReplayListRecord[];
}

export default function ReplayTableSelectionBanner({
  listItemCheckboxState,
  replays,
}: Props) {
  const {countSelected, isAllSelected, selectAll, queryKey} = listItemCheckboxState;
  const queryOptions = parseQueryKey(queryKey).options;
  const queryString = queryOptions?.query?.query;

  if (isAllSelected === 'indeterminate') {
    return (
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
    );
  }
  if (isAllSelected === true) {
    return (
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
    );
  }

  return null;
}

const FullGridAlert = styled(Alert)`
  grid-column: 1 / -1;
`;
