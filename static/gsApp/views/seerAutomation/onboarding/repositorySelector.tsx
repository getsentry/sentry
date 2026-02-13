import {useEffect, useMemo, useState} from 'react';
import uniqBy from 'lodash/uniqBy';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {Checkbox} from '@sentry/scraps/checkbox';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ApiResult} from 'sentry/api';
import {hasEveryAccess} from 'sentry/components/acl/access';
import ErrorBoundary from 'sentry/components/errorBoundary';
import InfiniteListItems from 'sentry/components/infiniteList/infiniteListItems';
import InfiniteListState from 'sentry/components/infiniteList/infiniteListState';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {useInfiniteApiQuery, type InfiniteApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

import {useSeerOnboardingContext} from 'getsentry/views/seerAutomation/onboarding/hooks/seerOnboardingContext';

// Adding half an item so that scrolling is obvious
// The height of the scrollable area will be MAX_VISIBLE_ITEMS * estimateSize()
const MAX_VISIBLE_ITEMS = 7.5;

function estimateSize() {
  return 50;
}

function NoRepositories() {
  return (
    <Container padding="3xl">
      <Text align="center" variant="secondary" size={{sm: 'md'}}>
        <img src={waitingForEventImg} alt={t('A person waiting for a phone to ring')} />
        <Text bold variant="secondary" size={{sm: 'xl'}}>
          {t('Inbox Zero')}
        </Text>
        <p>{t('You have two options: take a nap or be productive.')}</p>
      </Text>
    </Container>
  );
}

export default function RepositorySelector() {
  const organization = useOrganization();

  const [searchQuery, setSearchQuery] = useState('');

  const queryKey = useMemo(
    () =>
      [
        'infinite',
        getApiUrl('/organizations/$organizationIdOrSlug/repos/', {
          path: {
            organizationIdOrSlug: organization.slug,
          },
        }),
        {query: {expand: 'settings'}},
      ] satisfies InfiniteApiQueryKey,
    [organization.slug]
  );
  const queryResult = useInfiniteApiQuery<RepositoryWithSettings[]>({
    queryKey,
    enabled: true,
  });
  const {fetchNextPage, hasNextPage, isPending, isFetchingNextPage} = queryResult;

  // Auto-fetch each page, one at a time
  useEffect(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isFetchingNextPage]);

  const {
    // provider,
    // isRepositoriesFetching,
    // repositories,
    setCodeReviewRepositories,
    // selectedCodeReviewRepositoriesMap,
  } = useSeerOnboardingContext();

  // De-duplicated repositories. In case one page overlaps with another.
  const repositories = useMemo(
    () => uniqBy(queryResult.data?.pages.flatMap(result => result[0]) ?? [], 'id'),
    [queryResult.data?.pages]
  );
  const filteredRepositories = useMemo(() => {
    return repositories.filter(repository =>
      repository.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [repositories, searchQuery]);

  const checkboxState = useListItemCheckboxContext({
    hits: filteredRepositories.length,
    knownIds: filteredRepositories.map(issue => issue.id),
    queryKey,
  });

  const itemsToShow = Math.min(repositories.length, MAX_VISIBLE_ITEMS);
  const minHeight = `${itemsToShow * estimateSize()}px`;

  return (
    <Stack padding="xl" gap="xl">
      <RepositoryListSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <RepositoryListHeader
        checkboxState={checkboxState}
        isFetching={isPending || hasNextPage}
      />
      <Stack flexGrow={1} minHeight={minHeight} border="primary" radius="md">
        <InfiniteListState
          queryResult={queryResult}
          backgroundUpdatingMessage={() => null}
          loadingMessage={() => <LoadingIndicator />}
        >
          <InfiniteListItems<RepositoryWithSettings, ApiResult<RepositoryWithSettings[]>>
            deduplicateItems={pages =>
              uniqBy(
                pages.flatMap(page => page[0]),
                'id'
              )
            }
            estimateSize={estimateSize}
            queryResult={queryResult}
            itemRenderer={({item, virtualItem}) => (
              <ErrorBoundary mini>
                <RepositoryListItem
                  isLastItem={virtualItem.index === filteredRepositories.length - 1}
                  repository={item}
                  checked={checkboxState.isSelected(item.id)}
                  onChange={() => {
                    checkboxState.toggleSelected(item.id);
                    setCodeReviewRepositories(
                      Object.fromEntries(
                        checkboxState.knownIds.map(id => [
                          id,
                          checkboxState.isSelected(id) !== false,
                        ])
                      )
                    );
                  }}
                />
              </ErrorBoundary>
            )}
            emptyMessage={() => <NoRepositories />}
            loadingMoreMessage={() => (
              <Flex justifySelf="center">
                <Tooltip title={t('Loading repositories...')}>
                  <LoadingIndicator mini />
                </Tooltip>
              </Flex>
            )}
            loadingCompleteMessage={() => null}
          />
        </InfiniteListState>
      </Stack>

      <ManageIntegrationFooter />
    </Stack>
  );
}

function RepositoryListSearch({
  searchQuery,
  setSearchQuery,
}: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}) {
  return (
    <InputGroup>
      <InputGroup.LeadingItems>
        <IconSearch size="sm" />
      </InputGroup.LeadingItems>
      <InputGroup.Input
        type="text"
        name="search"
        placeholder={t('Search & filter available repositories')}
        size="sm"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />
    </InputGroup>
  );
}

function RepositoryListHeader({
  checkboxState,
  isFetching,
}: {
  checkboxState: ReturnType<typeof useListItemCheckboxContext>;
  isFetching: boolean;
}) {
  const {countSelected, deselectAll, isAllSelected, knownIds, selectAll} = checkboxState;
  return (
    <Flex
      justify="end"
      align="center"
      gap="md"
      paddingRight="xl"
      paddingLeft="xl"
      style={{marginRight: '1px'}}
    >
      <Text as="label" htmlFor="select-all-repositories" bold={false}>
        {isAllSelected
          ? tct('Un-select all ([count])', {count: countSelected})
          : tct('Select all ([count])', {count: knownIds.length})}
      </Text>
      {isFetching ? (
        <LoadingIndicator mini />
      ) : (
        <Checkbox
          disabled={isFetching || knownIds.length === 0}
          checked={isAllSelected}
          onChange={() => {
            if (isAllSelected === true) {
              deselectAll();
            } else {
              selectAll();
            }
          }}
          id="select-all-repositories"
        />
      )}
    </Flex>
  );
}

function RepositoryListItem({
  checked,
  isLastItem,
  onChange,
  repository,
}: {
  checked: 'all-selected' | boolean;
  isLastItem: boolean;
  onChange: (repositoryId: string, newValue: boolean) => void;
  repository: RepositoryWithSettings;
}) {
  // TODO: Remove marginBottom once `as="label"` stops including a global value of 5px
  return (
    <Stack as="label" htmlFor={repository.id} marginBottom="0">
      <Flex
        borderBottom={isLastItem ? undefined : 'primary'}
        align="center"
        gap="md"
        justify="between"
        padding="xl"
      >
        <Text bold={false}>{repository.name}</Text>
        <Checkbox
          id={repository.id}
          checked={checked !== false}
          onChange={e => onChange?.(repository.id, e.target.checked)}
        />
      </Flex>
    </Stack>
  );
}

function ManageIntegrationFooter() {
  const organization = useOrganization();
  const {provider} = useSeerOnboardingContext();

  const hasAccess = hasEveryAccess(['org:integrations'], {organization});

  if (!provider || !hasAccess) {
    return null;
  }

  return (
    <IntegrationContext
      value={{
        provider,
        type: 'first_party',
        installStatus: 'Not Installed', // `AddIntegrationButton` only handles `Disabled`
        analyticsParams: {
          view: 'seer_onboarding_code_review',
          already_installed: false,
        },
      }}
    >
      <Text density="comfortable">
        {tct(
          `Can't find a repository? [link:Manage your GitHub integration] and ensure you have granted access to the correct repositories.`,
          {
            link: (
              <IntegrationButton
                userHasAccess={hasAccess}
                onAddIntegration={() => {
                  window.location.reload();
                }}
                onExternalClick={() => {}}
                buttonProps={{
                  buttonText: t('Manage your GitHub integration'),
                  priority: 'link',
                  style: {padding: 0},
                }}
              />
            ),
          }
        )}
      </Text>
    </IntegrationContext>
  );
}
