import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import debounce from 'lodash/debounce';
import uniqBy from 'lodash/uniqBy';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {TriggerLabel} from 'sentry/components/core/compactSelect/control';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {IconBuilding, IconRepository} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useInfiniteRepositories} from 'sentry/views/prevent/preventAI/hooks/usePreventAIInfiniteRepositories';
import {usePreventAIOrgRepos} from 'sentry/views/prevent/preventAI/hooks/usePreventAIOrgs';
import {getRepoNameWithoutOrg} from 'sentry/views/prevent/preventAI/utils';

export const ALL_REPOS_VALUE = '__$ALL_REPOS__';

function ManageReposToolbar({
  onOrgChange,
  onRepoChange,
  selectedOrg,
  selectedRepo,
}: {
  onOrgChange: (orgId: string) => void;
  onRepoChange: (repoId: string) => void;
  selectedOrg: string;
  selectedRepo: string;
}) {
  const [searchValue, setSearchValue] = useState<string | undefined>();
  const debouncedSearch = useMemo(
    () => debounce((value: string) => setSearchValue(value), 300),
    []
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const {data: integrations, isPending: isLoadingOrgs} = usePreventAIOrgRepos();

  const organizationOptions =
    integrations?.map(org => ({
      label: org.name,
      value: org.id,
    })) ?? [];

  const queryResult = useInfiniteRepositories({
    integrationId: selectedOrg,
    searchTerm: searchValue,
  });

  const {hasNextPage, isFetchingNextPage, isLoading, fetchNextPage} = queryResult;

  const allReposData = useMemo(
    () => uniqBy(queryResult.data?.pages.flatMap(result => result[0]) ?? [], 'id'),
    [queryResult.data?.pages]
  );

  // Filter out repos where search only matches org name, not repo name
  const reposData = useMemo(() => {
    if (!searchValue) {
      return allReposData;
    }
    return allReposData.filter(repo => {
      const repoName = getRepoNameWithoutOrg(repo.name);
      return repoName.toLowerCase().includes(searchValue.toLowerCase());
    });
  }, [allReposData, searchValue]);

  // Auto-fetch more pages if filtering reduced visible results below threshold
  useEffect(() => {
    const MIN_VISIBLE_RESULTS = 50;
    if (
      searchValue &&
      reposData.length < MIN_VISIBLE_RESULTS &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isLoading
    ) {
      fetchNextPage();
    }
  }, [
    searchValue,
    reposData.length,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    fetchNextPage,
  ]);

  const repositoryOptions = useMemo(() => {
    const repos = isLoading ? [] : reposData;
    const repoOptions = repos.map(repo => ({
      value: repo.id,
      label: getRepoNameWithoutOrg(repo.name),
    }));

    return [{value: ALL_REPOS_VALUE, label: t('All Repos')}, ...repoOptions];
  }, [reposData, isLoading]);

  function getEmptyMessage() {
    if (isLoading) {
      return t('Loading repositories...');
    }
    if (reposData.length === 0) {
      return searchValue
        ? t('No repositories found. Please enter a different search term.')
        : t('No repositories found');
    }
    return undefined;
  }

  const scrollListenerRef = useRef<HTMLElement | null>(null);
  const scrollListenerIdRef = useRef<number>(0);

  const hasNextPageRef = useRef(hasNextPage);
  const isFetchingNextPageRef = useRef(isFetchingNextPage);
  const fetchNextPageRef = useRef(fetchNextPage);

  useEffect(() => {
    hasNextPageRef.current = hasNextPage;
    isFetchingNextPageRef.current = isFetchingNextPage;
    fetchNextPageRef.current = fetchNextPage;
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleScroll = useCallback(() => {
    const listElement = scrollListenerRef.current;

    if (!listElement) {
      return;
    }

    // Check if user has scrolled near the bottom
    const scrollTop = listElement.scrollTop;
    const scrollHeight = listElement.scrollHeight;
    const clientHeight = listElement.clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (!hasNextPageRef.current || isFetchingNextPageRef.current) {
      return;
    }

    // Trigger when within 100px of bottom
    if (distanceFromBottom < 100) {
      fetchNextPageRef.current();
    }
  }, []);

  // Set up scroll listener when menu opens
  const handleMenuOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        // Increment ID to track this specific open instance
        scrollListenerIdRef.current += 1;
        const currentId = scrollListenerIdRef.current;

        // Try multiple times to find the list element as it may take time to render
        const tryAttachListener = (attempts = 0) => {
          // Stop if menu was closed (ID changed) or too many attempts
          if (scrollListenerIdRef.current !== currentId || attempts > 10) {
            return;
          }

          // Find all listbox elements and get the last one (most recently opened)
          const listElements = document.querySelectorAll('ul[role="listbox"]');
          const listElement = listElements[listElements.length - 1];

          if (listElement instanceof HTMLElement) {
            scrollListenerRef.current = listElement;
            listElement.addEventListener('scroll', handleScroll, {passive: true});
          } else {
            // Retry after a short delay
            setTimeout(() => tryAttachListener(attempts + 1), 20);
          }
        };

        tryAttachListener();
      } else {
        // Clean up listener when menu closes
        if (scrollListenerRef.current) {
          scrollListenerRef.current.removeEventListener('scroll', handleScroll);
          scrollListenerRef.current = null;
        }
      }
    },
    [handleScroll]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollListenerRef.current) {
        scrollListenerRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, [handleScroll]);

  return (
    <Fragment>
      <PageFilterBar condensed>
        <CompactSelect
          value={selectedOrg}
          options={organizationOptions}
          loading={isLoadingOrgs}
          onChange={option => onOrgChange(option?.value ?? '')}
          triggerProps={{
            icon: <IconBuilding />,
            children: (
              <TriggerLabel>
                {organizationOptions.find(opt => opt.value === selectedOrg)?.label ||
                  t('Select organization')}
              </TriggerLabel>
            ),
          }}
        />

        <CompactSelect
          value={selectedRepo}
          options={repositoryOptions}
          loading={isLoading}
          disabled={!selectedOrg || isLoading}
          onChange={option => onRepoChange(option?.value ?? '')}
          searchable
          disableSearchFilter
          onSearch={debouncedSearch}
          searchPlaceholder={t('search by repository name')}
          onOpenChange={isOpen => {
            setSearchValue(undefined);
            handleMenuOpenChange(isOpen);
          }}
          emptyMessage={getEmptyMessage()}
          triggerProps={{
            icon: <IconRepository />,
            children: (
              <TriggerLabel>
                {repositoryOptions.find(opt => opt.value === selectedRepo)?.label ||
                  t('Select repository')}
              </TriggerLabel>
            ),
          }}
          menuFooter={
            hasNextPage || isFetchingNextPage ? (
              <div
                style={{
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#999',
                }}
              >
                {isFetchingNextPage ? t('Loading...') : '\u00A0'}
              </div>
            ) : null
          }
        />
      </PageFilterBar>
    </Fragment>
  );
}

export default ManageReposToolbar;
