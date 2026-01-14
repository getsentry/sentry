import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {Stack} from '@sentry/scraps/layout';

import type {ApiResult} from 'sentry/api';
import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackListHeader from 'sentry/components/feedback/list/feedbackListHeader';
import FeedbackListItem from 'sentry/components/feedback/list/feedbackListItem';
import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';
import InfiniteListItems from 'sentry/components/infiniteList/infiniteListItems';
import InfiniteListState from 'sentry/components/infiniteList/infiniteListState';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FeedbackIssueListItem} from 'sentry/utils/feedback/types';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';

function NoFeedback() {
  return (
    <NoFeedbackWrapper>
      <img src={waitingForEventImg} alt={t('A person waiting for a phone to ring')} />
      <NoFeedbackMessage>{t('Inbox Zero')}</NoFeedbackMessage>
      <p>{t('You have two options: take a nap or be productive.')}</p>
    </NoFeedbackWrapper>
  );
}

interface Props {
  onItemSelect: (itemIndex?: number) => void;
}

export default function FeedbackList({onItemSelect}: Props) {
  const {listQueryKey} = useFeedbackQueryKeys();
  const queryResult = useInfiniteApiQuery<FeedbackIssueListItem[]>({
    queryKey: listQueryKey ?? ['infinite', ''],
    enabled: Boolean(listQueryKey),
  });

  // Deduplicated issues. In case one page overlaps with another.
  const issues = useMemo(
    () => uniqBy(queryResult.data?.pages.flatMap(result => result[0]) ?? [], 'id'),
    [queryResult.data?.pages]
  );
  const checkboxState = useListItemCheckboxContext({
    hits: Number(
      queryResult.data?.pages[0]?.[2]?.getResponseHeader('X-Hits') ?? issues.length
    ),
    knownIds: issues.map(issue => issue.id),
    queryKey: listQueryKey,
  });

  return (
    <Fragment>
      <FeedbackListHeader {...checkboxState} />
      <Stack flexGrow={1} paddingBottom="xs">
        <InfiniteListState
          queryResult={queryResult}
          backgroundUpdatingMessage={() => null}
          loadingMessage={() => <LoadingIndicator />}
        >
          <InfiniteListItems<FeedbackIssueListItem, ApiResult<FeedbackIssueListItem[]>>
            deduplicateItems={pages =>
              uniqBy(
                pages.flatMap(page => page[0]),
                'id'
              )
            }
            estimateSize={() => 80}
            queryResult={queryResult}
            itemRenderer={({item, virtualItem}) => {
              const itemIndex = virtualItem.index;
              return (
                <ErrorBoundary mini>
                  <FeedbackListItem
                    feedbackItem={item}
                    isSelected={checkboxState.isSelected(item.id)}
                    onSelect={() => {
                      checkboxState.toggleSelected(item.id);
                    }}
                    onItemSelect={() => onItemSelect(itemIndex)}
                  />
                </ErrorBoundary>
              );
            }}
            emptyMessage={() => <NoFeedback />}
            loadingMoreMessage={() => (
              <Centered>
                <Tooltip title={t('Loading more feedback...')}>
                  <LoadingIndicator mini />
                </Tooltip>
              </Centered>
            )}
            loadingCompleteMessage={() => null}
          />
        </InfiniteListState>
      </Stack>
    </Fragment>
  );
}

const Centered = styled('div')`
  justify-self: center;
`;

const NoFeedbackWrapper = styled('div')`
  padding: ${space(4)} ${space(4)};
  text-align: center;
  color: ${p => p.theme.tokens.content.secondary};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.md};
  }
`;

const NoFeedbackMessage = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.colors.gray500};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.xl};
  }
`;
