import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Button} from 'sentry/components/core/button';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {ExternalLink} from 'sentry/components/core/link';
import DropdownButton from 'sentry/components/dropdownButton';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {useInfiniteRepositories} from 'sentry/components/prevent/repoSelector/useInfiniteRepositories';
import {IconInfo, IconSync} from 'sentry/icons';
import {IconRepository} from 'sentry/icons/iconRepository';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {useSyncRepos} from './useSyncRepos';

function SyncRepoButton({searchValue}: {searchValue?: string}) {
  const {triggerResync, isSyncing} = useSyncRepos({searchValue});

  if (isSyncing) {
    return <StyledLoadingIndicator size={12} />;
  }

  return (
    <StyledButtonContainer>
      <StyledButton
        borderless
        aria-label={t('Sync Now')}
        onClick={() => triggerResync()}
        size="xs"
        icon={<IconSync />}
      >
        sync now
      </StyledButton>
    </StyledButtonContainer>
  );
}

interface MenuFooterProps {
  repoAccessLink: string;
}

function MenuFooter({repoAccessLink}: MenuFooterProps) {
  return (
    <FooterTip>
      <IconInfo size="xs" />
      <span>
        {tct(
          "Sentry only displays repos you've authorized. Manage [repoAccessLink] in your GitHub settings.",
          {
            repoAccessLink: (
              <ExternalLink openInNewTab href={repoAccessLink}>
                repo access
              </ExternalLink>
            ),
          }
        )}
      </span>
    </FooterTip>
  );
}

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
  const {
    data: repositories,
    isFetching,
    isLoading,
  } = useInfiniteRepositories({term: searchValue});

  const {data: integrations = []} = useApiQuery<OrganizationIntegration[]>(
    [
      `/organizations/${organization.slug}/integrations/`,
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
    const repoSet = new Set([...(repository ? [repository] : []), ...displayedRepos]);

    return [...repoSet].map((value): SelectOption<string> => {
      return {
        // TODO: ideally this has a unique id, possibly adjust set to an
        // object when you have backend response
        value,
        label: <OptionLabel>{value}</OptionLabel>,
        textValue: value,
      };
    });
  }, [displayedRepos, repository]);

  function getEmptyMessage() {
    if (isFetching) {
      return t('Getting repositories...');
    }

    if (searchValue && !repositories?.length) {
      return t('No repositories found. Please enter at least 3 characters to search.');
    }

    return t('No repositories found');
  }

  useEffect(() => {
    // Create a use effect to cancel handleOnSearch fn on unmount to avoid memory leaks
    return () => {
      handleOnSearch.cancel();
    };
  }, [handleOnSearch]);

  return (
    <CompactSelect
      loading={isLoading}
      onSearch={handleOnSearch}
      searchable
      disableSearchFilter
      searchPlaceholder={t('search by repository name')}
      options={options}
      value={repository ?? ''}
      onChange={handleChange}
      onOpenChange={_ => setSearchValue(undefined)}
      menuWidth={'16rem'}
      menuBody={<SyncRepoButton searchValue={searchValue} />}
      menuFooter={<MenuFooter repoAccessLink={currentOrgGHIntegrationRepoAccessLink} />}
      disabled={disabled}
      emptyMessage={getEmptyMessage()}
      trigger={(triggerProps, isOpen) => {
        const defaultLabel = options.some(item => item.value === repository)
          ? repository
          : t('Select Repo');

        return (
          <DropdownButton
            isOpen={isOpen}
            icon={<IconRepository />}
            data-test-id="page-filter-prevent-repository-selector"
            {...triggerProps}
          >
            <TriggerLabelWrap>
              <TriggerLabel>{defaultLabel}</TriggerLabel>
            </TriggerLabelWrap>
          </DropdownButton>
        );
      }}
    />
  );
}

const StyledButton = styled(Button)`
  display: inline-flex;
  text-transform: uppercase;
  color: ${p => p.theme.tokens.content.muted};
  padding: ${space(1)};
  &:hover * {
    background-color: transparent;
    border-color: transparent;
  }
`;

const StyledButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: ${space(0.5)};
  margin: 0 ${space(0.5)} ${space(0.5)} 0;
`;

const FooterTip = styled('p')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  margin: 0;
`;

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
  max-width: 200px;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const OptionLabel = styled('span')`
  div {
    margin: 0;
  }
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  && {
    margin: ${p => p.theme.space.lg};
  }
`;
