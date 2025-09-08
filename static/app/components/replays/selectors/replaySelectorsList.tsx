import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import type {ApiResult} from 'sentry/api';
import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import InfiniteListItems from 'sentry/components/infiniteList/infiniteListItems';
import InfiniteListState from 'sentry/components/infiniteList/infiniteListState';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ReplayCrumbListItem from 'sentry/components/replays/selectors/replaySelectorsListItem';
import {t} from 'sentry/locale';
import {type InfiniteData, type UseInfiniteQueryResult} from 'sentry/utils/queryClient';
import hydrateSelectorData from 'sentry/utils/replays/hydrateSelectorData';
import type {
  DeadRageSelectorItem,
  DeadRageSelectorListResponse,
} from 'sentry/views/replays/types';

interface Props {
  onSelect: (item: DeadRageSelectorItem) => void;
  queryResult: UseInfiniteQueryResult<
    InfiniteData<ApiResult<DeadRageSelectorListResponse>, unknown>
  >;
}

export default function ReplaySelectorsList({onSelect, queryResult}: Props) {
  return (
    <InfiniteListState
      queryResult={queryResult}
      backgroundUpdatingMessage={() => null}
      loadingMessage={() => <LoadingIndicator />}
    >
      <InfiniteListItems<DeadRageSelectorItem, ApiResult<DeadRageSelectorListResponse>>
        deduplicateItems={pages =>
          pages.flatMap(page => {
            return uniqBy(
              hydrateSelectorData(page[0].data, null),
              'dom_element.fullSelector'
            );
          })
        }
        estimateSize={() => 24}
        queryResult={queryResult}
        itemRenderer={({item}) => (
          <ErrorBoundary mini>
            <ReplayCrumbListItem onSelect={onSelect} item={item} />
          </ErrorBoundary>
        )}
        emptyMessage={() => <NoClicks />}
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

function NoClicks() {
  return (
    <NoClicksWrapper>
      <img src={waitingForEventImg} alt={t('A person waiting for a phone to ring')} />
      <NoClicksMessage>{t('Inbox Zero')}</NoClicksMessage>
      <p>{t('You have two options: take a nap or be productive.')}</p>
    </NoClicksWrapper>
  );
}

const Centered = styled('div')`
  justify-self: center;
`;

const NoClicksWrapper = styled('div')`
  padding: ${p => p.theme.space['3xl']};
  text-align: center;
  color: ${p => p.theme.subText};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.md};
  }
`;

const NoClicksMessage = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.gray400};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.xl};
  }
`;
