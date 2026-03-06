import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import {ExternalLink} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {useInfiniteRepositories} from 'sentry/components/prevent/repoSelector/useInfiniteRepositories';
import {IconRepository} from 'sentry/icons/iconRepository';
import {t, tct} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {useSyncRepos} from './useSyncRepos';

export function RepoSelector() {
  const {
    repository,
    integratedOrgId,
    integratedOrgName,
    preventPeriod,
    changeContextValue,
  } = usePreventContext();
  const organization = useOrganization();

  const [searchValue, setSearchValue] = useState<string | undefined>();
  const {isSyncing, triggerResync} = useSyncRepos({searchValue});

  const {
    data: repositories,
    isFetching,
    isLoading,
  } = useInfiniteRepositories({term: searchValue});

  const {data: integrations = []} = useApiQuery<OrganizationIntegration[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/integrations/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {includeConfig: 0, provider_key: 'github'}},
    ],
    {staleTime: 0}
  );

  const currentOrgGHIntegration = integrations.find(
    integration => integration.id === integratedOrgId
  );
  const currentOrgGHIntegrationExternalId = currentOrgGHIntegration?.externalId;
  const currentOrgGHIntegrationRepoAccessLink = currentOrgGHIntegrationExternalId
    ? `https://github.com/settings/installations/${currentOrgGHIntegrationExternalId}/permissions/update`
    : 'https://github.com/settings/installations/';

  const disabled = !integratedOrgId;

  const handleChange = useCallback(
    (selectedOption: SelectOption<string>) => {
      changeContextValue({
        integratedOrgId,
        integratedOrgName,
        preventPeriod,
        repository: selectedOption.value,
      });
    },
    [changeContextValue, integratedOrgName, integratedOrgId, preventPeriod]
  );

  const handleOnSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValue(value);
      }, 300),
    [setSearchValue]
  );

  const displayedRepos = useMemo(
    () => (isFetching ? [] : (repositories?.map(item => item.name) ?? [])),
    [repositories, isFetching]
  );

  const options = useMemo((): Array<SelectOption<string>> => {
    const repoSet = new Set([
      ...(repository && !searchValue ? [repository] : []),
      ...displayedRepos,
    ]);

    return [...repoSet].map((value): SelectOption<string> => {
      return {
        // TODO: ideally this has a unique id, possibly adjust set to an
        // object when you have backend response
        value,
        label: value,
      };
    });
  }, [displayedRepos, repository, searchValue]);

  function getEmptyMessage() {
    if (isFetching) {
      return t('Getting repositories...');
    }

    if (!repositories?.length) {
      if (searchValue?.length) {
        return t('No repositories found. Please enter a different search term.');
      }

      return t('No repositories found');
    }

    return undefined;
  }

  useEffect(() => {
    // Create a use effect to cancel handleOnSearch fn on unmount to avoid memory leaks
    return () => {
      handleOnSearch.cancel();
    };
  }, [handleOnSearch]);

  return (
    <CompactSelect
      menuTitle={t('Select a Repository')}
      loading={isLoading || isSyncing}
      search={{
        placeholder: t('search by repository name'),
        filter: false,
        onChange: handleOnSearch,
      }}
      options={options}
      value={repository ?? ''}
      onChange={handleChange}
      onOpenChange={_ => setSearchValue(undefined)}
      menuWidth="16rem"
      menuHeaderTrailingItems={
        <MenuComponents.HeaderButton disabled={isSyncing} onClick={() => triggerResync()}>
          {t('Sync Repos')}
        </MenuComponents.HeaderButton>
      }
      menuFooter={
        <MenuComponents.Alert variant="info">
          {tct(
            "Sentry only displays repos you've authorized. Manage [repoAccessLink:repo access] in your GitHub settings.",
            {
              repoAccessLink: (
                <ExternalLink openInNewTab href={currentOrgGHIntegrationRepoAccessLink} />
              ),
            }
          )}
        </MenuComponents.Alert>
      }
      disabled={disabled}
      emptyMessage={getEmptyMessage()}
      trigger={triggerProps => {
        const defaultLabel = options.some(item => item.value === repository)
          ? repository
          : t('Select Repo');

        return (
          <OverlayTrigger.Button
            icon={<IconRepository />}
            data-test-id="page-filter-prevent-repository-selector"
            {...triggerProps}
          >
            <TriggerLabel>{defaultLabel}</TriggerLabel>
          </OverlayTrigger.Button>
        );
      }}
    />
  );
}

const TriggerLabel = styled('span')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;
