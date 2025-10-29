import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import debounce from 'lodash/debounce';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {TriggerLabel} from 'sentry/components/core/compactSelect/control';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {IconBuilding, IconRepository} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {useInfiniteRepositories} from './hooks/useInfiniteRepositories';

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
  const organization = useOrganization();

  // Search state for the repo search box - following RepoSelector pattern
  const [searchValue, setSearchValue] = useState<string | undefined>();

  // Debounced search handler - following RepoSelector pattern
  const handleOnSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValue(value);
      }, 300),
    []
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      handleOnSearch.cancel();
    };
  }, [handleOnSearch]);

  // Fetch GitHub integrations to power the organization dropdown
  const {data: githubIntegrations = [], isLoading: isLoadingIntegrations} = useApiQuery<
    OrganizationIntegration[]
  >(
    [
      `/organizations/${organization.slug}/integrations/`,
      {query: {includeConfig: 0, provider_key: 'github'}},
    ],
    {
      staleTime: 0,
    }
  );

  // Options for organization selector - use integration ID as value
  const organizationOptions = useMemo(
    () =>
      githubIntegrations.map(integration => ({
        value: integration.id, // Use integration ID as the value
        label: integration.name, // Display the GitHub org name
      })),
    [githubIntegrations]
  );

  // Fetch repos for the selected integration with infinite scroll
  // Filter results to only show matches in the repo name (after the slash)
  const {
    data: allReposData = [],
    isLoading: reposLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteRepositories({
    integrationId: selectedOrg,
    term: searchValue,
  });

  // Filter out repos where search only matches org name, not repo name
  const reposData = useMemo(() => {
    if (!searchValue) {
      return allReposData;
    }

    return allReposData.filter(repo => {
      const parts = repo.name.split('/');
      if (parts.length !== 2) {
        return true;
      }

      const repoName = parts[1];
      if (!repoName) {
        return true;
      }

      return repoName.toLowerCase().includes(searchValue.toLowerCase());
    });
  }, [allReposData, searchValue]);

  // Auto-fetch more pages if filtering reduced visible results below threshold
  const MIN_VISIBLE_RESULTS = 50;
  useEffect(() => {
    // Only auto-fetch if:
    // 1. We have a search filter active (otherwise all results are visible)
    // 2. We have fewer than MIN_VISIBLE_RESULTS after filtering
    // 3. There are more pages available
    // 4. Not currently fetching
    if (
      searchValue &&
      reposData.length < MIN_VISIBLE_RESULTS &&
      hasNextPage &&
      !isFetchingNextPage &&
      !reposLoading
    ) {
      fetchNextPage();
    }
  }, [
    searchValue,
    reposData.length,
    hasNextPage,
    isFetchingNextPage,
    reposLoading,
    fetchNextPage,
  ]);

  // Displayed repos - hide during initial load only (not during refetch when switching orgs)
  const displayedRepos = useMemo(
    () => (reposLoading ? [] : reposData),
    [reposData, reposLoading]
  );

  // Compose repo options for CompactSelect, add 'All Repos'
  const repositoryOptions = useMemo(() => {
    const repoOptions =
      displayedRepos?.map(repo => {
        // Extract just the repo name without the org prefix (e.g., "suejung-sentry/tools" → "tools")
        const repoNameWithoutOrg = repo.name.includes('/')
          ? repo.name.split('/').pop() || repo.name
          : repo.name;

        return {
          value: repo.id,
          label: repoNameWithoutOrg,
        };
      }) ?? [];

    return [
      {
        value: ALL_REPOS_VALUE,
        label: t('All Repos'),
      },
      ...repoOptions,
    ];
  }, [displayedRepos]);

  // Empty message handler - following RepoSelector pattern
  function getEmptyMessage() {
    if (reposLoading) {
      return t('Loading repositories...');
    }

    if (!displayedRepos?.length) {
      if (searchValue?.length) {
        return t('No repositories found. Please enter a different search term.');
      }

      return t('No repositories found');
    }

    return undefined;
  }

  // Infinite scroll: Attach scroll listener to the list
  const scrollListenerRef = useRef<HTMLElement | null>(null);
  const scrollListenerIdRef = useRef<number>(0);

  // Use refs to avoid stale closures
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
          loading={isLoadingIntegrations}
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
          loading={reposLoading}
          disabled={!selectedOrg || reposLoading}
          onChange={option => onRepoChange(option?.value ?? '')}
          searchable
          disableSearchFilter
          onSearch={handleOnSearch}
          searchPlaceholder={t('Filter by repository name')}
          onOpenChange={isOpen => {
            setSearchValue(undefined);
            handleMenuOpenChange(isOpen);
          }}
          emptyMessage={getEmptyMessage()}
          triggerProps={{
            icon: <IconRepository />,
            children: (
              <TriggerLabel>
                {reposLoading
                  ? t('Loading...')
                  : repositoryOptions.find(opt => opt.value === selectedRepo)?.label ||
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
