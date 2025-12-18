import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import type {ApiResult} from 'sentry/api';
import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import InfiniteListItems from 'sentry/components/infiniteList/infiniteListItems';
import InfiniteListState from 'sentry/components/infiniteList/infiniteListState';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ReplayListItem from 'sentry/components/replays/list/__stories__/replayListItem';
import {t} from 'sentry/locale';
import {type InfiniteData, type UseInfiniteQueryResult} from 'sentry/utils/queryClient';
import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  onSelect: (replayId: string) => void;
  queryResult: UseInfiniteQueryResult<
    InfiniteData<ApiResult<{data: ReplayListRecord[]}>>
  >;
}

export default function ReplayList({onSelect, queryResult}: Props) {
  return (
    <InfiniteListState
      queryResult={queryResult}
      backgroundUpdatingMessage={() => null}
      loadingMessage={() => <LoadingIndicator />}
    >
      <InfiniteListItems<ReplayListRecord, ApiResult<{data: ReplayListRecord[]}>>
        deduplicateItems={pages => pages.flatMap(page => uniqBy(page[0].data, 'id'))}
        estimateSize={() => 24}
        queryResult={queryResult}
        itemRenderer={({item, virtualItem}) => (
          <ErrorBoundary mini>
            <ReplayListItem
              replay={item}
              rowIndex={virtualItem.index}
              onClick={() => onSelect(item.id)}
            />
          </ErrorBoundary>
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
  color: ${p => p.theme.colors.gray500};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.xl};
  }
`;
