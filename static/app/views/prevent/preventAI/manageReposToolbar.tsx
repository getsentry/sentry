import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import uniqBy from 'lodash/uniqBy';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {TriggerLabel} from 'sentry/components/core/compactSelect/control';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {IconBuilding, IconRepository} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {OrganizationIntegration, Repository} from 'sentry/types/integrations';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useInfiniteRepositories} from 'sentry/views/prevent/preventAI/hooks/usePreventAIInfiniteRepositories';
import {getRepoNameWithoutOrg} from 'sentry/views/prevent/preventAI/utils';

const ALL_REPOS_VALUE = '__$ALL_REPOS__';

function ManageReposToolbar({
  integratedOrgs,
  onOrgChange,
  onRepoChange,
  selectedOrg,
  selectedRepo,
}: {
  integratedOrgs: OrganizationIntegration[];
  onOrgChange: (orgId: string) => void;
  onRepoChange: (repo: Repository | null) => void;
  selectedOrg: string;
  selectedRepo: Repository | null;
}) {
  const [searchValue, setSearchValue] = useState<string | undefined>();
  const debouncedSearch = useDebouncedValue(searchValue, 300);

  const {data, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage} =
    useInfiniteRepositories({
      integrationId: selectedOrg,
      searchTerm: debouncedSearch,
    });

  const scrollParentRef = useRef<HTMLElement | null>(null);
  const scrollListenerIdRef = useRef(0);
  const hasNextPageRef = useRef(hasNextPage);
  const isFetchingNextPageRef = useRef(isFetchingNextPage);
  const fetchNextPageRef = useRef(fetchNextPage);

  useEffect(() => {
    hasNextPageRef.current = hasNextPage;
    isFetchingNextPageRef.current = isFetchingNextPage;
    fetchNextPageRef.current = fetchNextPage;
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleScroll = useCallback(() => {
    const el = scrollParentRef.current;
    if (!el) return;
    if (!hasNextPageRef.current || isFetchingNextPageRef.current) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 100) fetchNextPageRef.current();
  }, []);

  const handleRepoDropdownOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        scrollListenerIdRef.current += 1;
        const currentId = scrollListenerIdRef.current;

        const attachListener = () => {
          if (scrollListenerIdRef.current !== currentId) return;
          const dropdownLists = document.querySelectorAll('ul[role="listbox"]');
          const lastList = dropdownLists[dropdownLists.length - 1];
          if (lastList instanceof HTMLElement) {
            scrollParentRef.current = lastList;
            lastList.addEventListener('scroll', handleScroll, {passive: true});
          } else {
            setTimeout(attachListener, 20);
          }
        };
        attachListener();
      } else if (scrollParentRef.current) {
        scrollParentRef.current.removeEventListener('scroll', handleScroll);
        scrollParentRef.current = null;
      }
    },
    [handleScroll]
  );

  useEffect(
    () => () => {
      if (scrollParentRef.current) {
        scrollParentRef.current.removeEventListener('scroll', handleScroll);
      }
    },
    [handleScroll]
  );

  const organizationOptions = useMemo(
    () =>
      (integratedOrgs ?? []).map(org => ({
        value: org.id,
        label: org.name,
      })),
    [integratedOrgs]
  );

  const allReposData = useMemo(
    () => uniqBy(data?.pages.flatMap(result => result[0]) ?? [], 'id'),
    [data?.pages]
  );
  const filteredReposData = useMemo(() => {
    if (!debouncedSearch) return allReposData;
    const search = debouncedSearch.toLowerCase();
    return allReposData.filter(repo =>
      getRepoNameWithoutOrg(repo.name).toLowerCase().includes(search)
    );
  }, [allReposData, debouncedSearch]);

  const repositoryOptions = useMemo(() => {
    let repoOptions = filteredReposData.map(repo => ({
      value: repo.externalId,
      label: getRepoNameWithoutOrg(repo.name),
    }));

    if (selectedRepo) {
      repoOptions = [
        {
          value: selectedRepo.externalId,
          label: getRepoNameWithoutOrg(selectedRepo.name),
        },
        ...repoOptions,
      ];
    }

    const dedupedRepoOptions = uniqBy(repoOptions, 'value');
    return [{value: ALL_REPOS_VALUE, label: t('All Repos')}, ...dedupedRepoOptions];
  }, [filteredReposData, selectedRepo]);

  const getRepoEmptyMessage = () => {
    if (isLoading) return t('Loading repositories...');
    if (filteredReposData.length === 0) {
      return debouncedSearch
        ? t('No repositories found. Please enter a different search term.')
        : t('No repositories found');
    }
    return undefined;
  };

  return (
    <Fragment>
      <PageFilterBar condensed>
        <CompactSelect
          value={selectedOrg}
          options={organizationOptions}
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
          value={selectedRepo?.externalId ?? ALL_REPOS_VALUE}
          options={repositoryOptions}
          loading={isLoading}
          disabled={!selectedOrg || isLoading}
          onChange={option => {
            const repoExternalId = option?.value;
            if (repoExternalId === ALL_REPOS_VALUE) {
              onRepoChange(null);
            } else {
              const foundRepo = allReposData.find(
                repo => repo.externalId === repoExternalId
              );
              onRepoChange(foundRepo ?? null);
            }
          }}
          searchable
          disableSearchFilter
          onSearch={setSearchValue}
          searchPlaceholder={t('search by repository name')}
          onOpenChange={isOpen => {
            handleRepoDropdownOpenChange(isOpen);
            if (!isOpen) setSearchValue(undefined);
          }}
          emptyMessage={getRepoEmptyMessage()}
          menuWidth="250px"
          triggerProps={{
            icon: <IconRepository />,
            children: (
              <TriggerLabel>
                {repositoryOptions.find(
                  opt => opt.value === (selectedRepo?.externalId ?? ALL_REPOS_VALUE)
                )?.label || t('Select repository')}
              </TriggerLabel>
            ),
          }}
        />
      </PageFilterBar>
    </Fragment>
  );
}

export default ManageReposToolbar;
