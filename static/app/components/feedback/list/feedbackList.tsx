import {useMemo} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import uniqBy from 'lodash/uniqBy';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Image} from '@sentry/scraps/image';
import {Container, Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {FeedbackListHeader} from 'sentry/components/feedback/list/feedbackListHeader';
import {FeedbackListItem} from 'sentry/components/feedback/list/feedbackListItem';
import {useFeedbackApiOptions} from 'sentry/components/feedback/useFeedbackApiOptions';
import {InfiniteListItems} from 'sentry/components/infiniteList/infiniteListItems';
import {InfiniteListState} from 'sentry/components/infiniteList/infiniteListState';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {FeedbackIssueListItem} from 'sentry/utils/feedback/types';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

function NoFeedback() {
  return (
    <EmptyState
      padding="3xl"
      align="center"
      justify="center"
      illustration={
        <Image src={waitingForEventImg} alt={t('A person waiting for a phone to ring')} />
      }
      title={t('Inbox Zero')}
      description={t('You have two options: take a nap or be productive.')}
    />
  );
}

function FeedbackListError({error, onRetry}: {error: Error; onRetry: () => void}) {
  const organization = useOrganization();

  if (error instanceof RequestError && error.status === 403) {
    return (
      <EmptyState
        padding="3xl"
        align="center"
        justify="center"
        title={t("You don't have access to this feedback")}
        description={t(
          "You may not be a member of a team with access to one or more of the selected projects. Try selecting different projects, or ask an organization admin to add you to the project's team."
        )}
        action={
          <LinkButton size="sm" to={`/settings/${organization.slug}/teams/`}>
            {t('View Teams')}
          </LinkButton>
        }
      />
    );
  }

  return (
    <Container padding="md">
      <LoadingError
        message={t('There was an error loading feedback.')}
        onRetry={onRetry}
      />
    </Container>
  );
}

interface Props {
  onItemSelect: (itemIndex?: number) => void;
}

export function FeedbackList({onItemSelect}: Props) {
  const {listApiOptions} = useFeedbackApiOptions();
  const queryResult = useInfiniteQuery(listApiOptions);

  // Deduplicated issues. In case one page overlaps with another.
  const issues = useMemo(
    () => uniqBy(queryResult.data?.pages.flatMap(page => page.json) ?? [], 'id'),
    [queryResult.data?.pages]
  );

  return (
    <ListItemCheckboxProvider
      hits={Number(queryResult.data?.pages[0]?.headers['X-Hits'] ?? issues.length)}
      knownIds={issues.map(issue => issue.id)}
      endpointOptions={safeParseQueryKey(listApiOptions.queryKey)?.options}
    >
      <FeedbackListHeader />
      <Stack flexGrow={1} paddingBottom="xs">
        <InfiniteListState
          queryResult={queryResult}
          backgroundUpdatingMessage={() => null}
          errorMessage={error => (
            <FeedbackListError error={error} onRetry={() => queryResult.refetch()} />
          )}
          loadingMessage={() => <LoadingIndicator />}
        >
          <InfiniteListItems<FeedbackIssueListItem, ApiResponse<FeedbackIssueListItem[]>>
            deduplicateItems={pages =>
              uniqBy(
                pages.flatMap(page => page.json),
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
                    onItemSelect={() => onItemSelect(itemIndex)}
                  />
                </ErrorBoundary>
              );
            }}
            emptyMessage={() => <NoFeedback />}
            loadingMoreMessage={() => (
              <Container justifySelf="center">
                <Tooltip title={t('Loading more feedback...')}>
                  <LoadingIndicator mini />
                </Tooltip>
              </Container>
            )}
            loadingCompleteMessage={() => null}
          />
        </InfiniteListState>
      </Stack>
    </ListItemCheckboxProvider>
  );
}
