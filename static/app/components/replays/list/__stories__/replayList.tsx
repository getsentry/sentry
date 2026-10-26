import type {InfiniteData, UseInfiniteQueryResult} from '@tanstack/react-query';
import uniqBy from 'lodash/uniqBy';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {InfiniteListItems} from 'sentry/components/infiniteList/infiniteListItems';
import {InfiniteListState} from 'sentry/components/infiniteList/infiniteListState';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ReplayListItem} from 'sentry/components/replays/list/__stories__/replayListItem';
import {t} from 'sentry/locale';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import type {ReplayListRecord} from 'sentry/views/explore/replays/types';
interface Props {
  onSelect: (replayId: string) => void;
  queryResult: UseInfiniteQueryResult<
    InfiniteData<ApiResponse<{data: ReplayListRecord[]}>>
  >;
}

export function ReplayList({onSelect, queryResult}: Props) {
  return (
    <InfiniteListState
      queryResult={queryResult}
      backgroundUpdatingMessage={() => null}
      loadingMessage={() => <LoadingIndicator />}
    >
      <InfiniteListItems<ReplayListRecord, ApiResponse<{data: ReplayListRecord[]}>>
        deduplicateItems={pages => pages.flatMap(page => uniqBy(page.json.data, 'id'))}
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
          <Container justifySelf="center">
            <Tooltip title={t('Loading more replays...')}>
              <LoadingIndicator mini />
            </Tooltip>
          </Container>
        )}
        loadingCompleteMessage={() => null}
      />
    </InfiniteListState>
  );
}

function NoReplays() {
  return (
    <Container padding="3xl">
      <Stack align="center">
        <img src={waitingForEventImg} alt={t('A person waiting for a phone to ring')} />
        <Stack align="center" gap="md">
          <Text as="div" size="xl" bold variant="secondary">
            {t('Inbox Zero')}
          </Text>
          <Text as="p" size="md" variant="secondary">
            {t('You have two options: take a nap or be productive.')}
          </Text>
        </Stack>
      </Stack>
    </Container>
  );
}
