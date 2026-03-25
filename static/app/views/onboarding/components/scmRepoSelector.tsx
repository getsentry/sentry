import {useMemo} from 'react';

import {Select} from '@sentry/scraps/select';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ScmSearchControl} from './scmSearchControl';
import {useScmRepoSearch} from './useScmRepoSearch';
import {useScmRepoSelection} from './useScmRepoSelection';

interface ScmRepoSelectorProps {
  integration: Integration;
}

export function ScmRepoSelector({integration}: ScmRepoSelectorProps) {
  const organization = useOrganization();
  const {selectedRepository, setSelectedRepository} = useOnboardingContext();
  const {
    reposByIdentifier,
    dropdownItems,
    isFetching,
    isError,
    debouncedSearch,
    setSearch,
  } = useScmRepoSearch(integration.id, selectedRepository);

  const {busy, handleSelect, handleRemove} = useScmRepoSelection({
    integration,
    onSelect: setSelectedRepository,
    reposByIdentifier,
  });

  // Prepend the selected repo so the Select can always resolve and display
  // it, even when search results no longer include it.
  const options = useMemo(() => {
    const selectedSlug = selectedRepository?.externalSlug;
    if (!selectedSlug || dropdownItems.some(item => item.value === selectedSlug)) {
      return dropdownItems;
    }
    return [
      {
        value: selectedSlug,
        label: selectedRepository.name,
        textValue: selectedRepository.name,
        disabled: true,
      },
      ...dropdownItems,
    ];
  }, [dropdownItems, selectedRepository]);

  function handleChange(option: {value: string} | null) {
    if (option === null) {
      handleRemove();
    } else {
      const repo = reposByIdentifier.get(option.value);
      if (repo) {
        trackAnalytics('onboarding.scm_connect_repo_selected', {
          organization,
          provider: integration.provider.key,
          repo: repo.name,
        });
      }
      handleSelect(option);
    }
  }

  function noOptionsMessage() {
    if (isError) {
      return t('Failed to search repositories. Please try again.');
    }
    if (debouncedSearch) {
      return t('No repositories found.');
    }
    return t('Type to search repositories');
  }

  return (
    <Select
      placeholder={t('Search repositories')}
      options={options}
      value={selectedRepository?.externalSlug ?? null}
      onChange={handleChange}
      onInputChange={(value, actionMeta) => {
        if (actionMeta.action === 'input-change') {
          setSearch(value);
        }
      }}
      // Disable client-side filtering; search is handled server-side.
      filterOption={() => true}
      noOptionsMessage={noOptionsMessage}
      isLoading={isFetching}
      isDisabled={busy}
      clearable
      searchable
      components={{Control: ScmSearchControl}}
    />
  );
}
