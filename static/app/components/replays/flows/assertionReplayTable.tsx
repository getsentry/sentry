import {useMemo, type ComponentProps} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import type {ApiResult} from 'sentry/api';
import Stacked from 'sentry/components/container/stacked';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Tooltip} from 'sentry/components/core/tooltip';
import InfiniteListState from 'sentry/components/infiniteList/infiniteListState';
import InfiniteSimpleTable from 'sentry/components/infiniteList/infiniteSimpleTable';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import actionToQuery from 'sentry/components/replays/flows/actions/actionToQuery';
import {
  ReplayDetailsLinkColumn,
  ReplayPlayPauseColumn,
  ReplaySessionColumn,
} from 'sentry/components/replays/table/replayTableColumns';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import type {AssertionFlow} from 'sentry/utils/replays/assertions/types';
import useReplayListQueryKey from 'sentry/utils/replays/hooks/useReplayListQueryKey';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayListRecord} from 'sentry/views/replays/types';

const VISIBLE_COLUMNS = [
  ReplayPlayPauseColumn,
  ReplaySessionColumn,
  ReplayDetailsLinkColumn,
];

const DEFAULT_LIST_ITEM_CHECKBOX_STATE = {
  countSelected: 0,
  deselectAll: () => {},
  isAllSelected: false,
  isAnySelected: false,
  isSelected: () => false,
  selectAll: () => {},
  selectedIds: [],
  toggleSelected: () => {},
  hits: 0,
  knownIds: [],
  queryKey: undefined,
};

interface Props extends ComponentProps<typeof SimpleTableInfinite> {
  flow: AssertionFlow;
  onPick: (replayId: string) => void;
}

export default function ReplayAssertionsTable({
  onSelect: _onSelect,
  flow,
  ...props
}: Props) {
  const organization = useOrganization();

  const query = useMemo(
    () => actionToQuery(flow.starting_action),
    [flow.starting_action]
  );

  const listQueryKey = useReplayListQueryKey({
    options: {
      query: {
        project: [flow.project_id],
        query: query ?? '',
        statsPeriod: '30d',
        sort: '-started_at',
      },
    },
    organization,
    queryReferrer: 'replayList',
  });
  const queryResult = useInfiniteApiQuery<{data: ReplayListRecord[]}>({
    queryKey: ['infinite', ...(listQueryKey ?? '')],
    enabled: Boolean(listQueryKey),
  });

  return (
    <SimpleTableInfinite {...props}>
      <SimpleTableInfiniteHeader>
        {VISIBLE_COLUMNS.map(({Header, sortKey}, columnIndex) => (
          <SimpleTableInfiniteHeaderCell key={`${sortKey}-${columnIndex}`}>
            {typeof Header === 'function'
              ? Header({
                  columnIndex,
                  listItemCheckboxState: DEFAULT_LIST_ITEM_CHECKBOX_STATE,
                  replays: [],
                })
              : Header}
          </SimpleTableInfiniteHeaderCell>
        ))}
      </SimpleTableInfiniteHeader>
      <InfiniteListState
        queryResult={queryResult}
        backgroundUpdatingMessage={() => null}
        loadingMessage={() => <LoadingIndicator />}
      >
        <InfiniteSimpleTable<ReplayListRecord, ApiResult<{data: ReplayListRecord[]}>>
          deduplicateItems={pages =>
            pages.flatMap(page =>
              uniqBy(page[0].data, 'id').map(mapResponseToReplayRecord)
            )
          }
          estimateSize={() => 58}
          queryResult={queryResult}
          rowRenderer={({item: replay, virtualRow}) => (
            <SimpleTableInfiniteRow
              key={replay.id}
              variant={replay.is_archived ? 'faded' : 'default'}
            >
              <InteractionStateLayer />
              {VISIBLE_COLUMNS.map((column, columnIndex) => (
                <SimpleTableInfiniteCell
                  key={`${replay.id}-${columnIndex}-${column.sortKey}`}
                >
                  <Stacked>
                    <div style={{visibility: 'hidden'}}>
                      {typeof column.Header === 'function'
                        ? column.Header({
                            columnIndex,
                            listItemCheckboxState: DEFAULT_LIST_ITEM_CHECKBOX_STATE,
                            replays: [],
                          })
                        : column.Header}
                    </div>
                    <column.Component
                      columnIndex={columnIndex}
                      replay={replay}
                      rowIndex={virtualRow.index}
                      showDropdownFilters={false}
                    />
                  </Stacked>
                </SimpleTableInfiniteCell>
              ))}
            </SimpleTableInfiniteRow>
          )}
          emptyMessage={() => <NoReplays />}
          loadingMoreMessage={() => (
            <Centered>
              <Tooltip title={t('Loading more replays...')}>
                <LoadingIndicator mini />
              </Tooltip>
            </Centered>
          )}
          loadingCompleteMessage={() => null}
        />
      </InfiniteListState>
    </SimpleTableInfinite>
  );
}

function NoReplays() {
  return (
    <NoReplaysWrapper>
      <img src={waitingForEventImg} alt={t('A person waiting for a phone to ring')} />
      <NoReplaysMessage>{t('Inbox Zero')}</NoReplaysMessage>
      <p>{t('You have two options: take a nap or be productive.')}</p>
    </NoReplaysWrapper>
  );
}

const Centered = styled('div')`
  justify-self: center;
`;

const NoReplaysWrapper = styled('div')`
  padding: ${p => p.theme.space['3xl']};
  text-align: center;
  color: ${p => p.theme.subText};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.md};
  }
`;

const NoReplaysMessage = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.gray400};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.xl};
  }
`;

const SimpleTableInfinite = styled(SimpleTable)`
  display: flex;
  flex-direction: column;
`;

const SimpleTableInfiniteHeader = styled(SimpleTable.Header)`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
`;

const SimpleTableInfiniteRow = styled(SimpleTable.Row)`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
`;

const SimpleTableInfiniteHeaderCell = styled(SimpleTable.HeaderCell)``;

const SimpleTableInfiniteCell = styled(SimpleTable.RowCell)``;
