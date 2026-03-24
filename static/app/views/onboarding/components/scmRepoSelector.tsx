import {useCallback} from 'react';

import {Select} from '@sentry/scraps/select';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

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
    onSelect: repo => {
      setSelectedRepository(repo);
      if (repo) {
        trackAnalytics('onboarding.scm_connect_repo_selected', {
          organization,
          provider: integration.provider.key,
          repo: repo.name,
        });
      }
    },
    reposByIdentifier,
  });

  const selectedValue = selectedRepository
    ? {value: selectedRepository.externalSlug ?? '', label: selectedRepository.name}
    : null;

  const handleChange = useCallback(
    (option: {value: string} | null) => {
      if (option === null) {
        handleRemove();
      } else {
        handleSelect(option);
      }
    },
    [handleSelect, handleRemove]
  );

  const noOptionsMessage = useCallback(() => {
    if (isError) {
      return t('Failed to search repositories. Please try again.');
    }
    if (debouncedSearch) {
      return t('No repositories found.');
    }
    return t('Type to search repositories');
  }, [isError, debouncedSearch]);

  return (
    <Select
      placeholder={t('Search repositories')}
      options={dropdownItems}
      value={selectedValue?.value}
      onChange={handleChange}
      onInputChange={setSearch}
      filterOption={() => true}
      noOptionsMessage={noOptionsMessage}
      isLoading={isFetching}
      isDisabled={busy}
      clearable={!!selectedRepository}
      searchable
    />
  );
}
