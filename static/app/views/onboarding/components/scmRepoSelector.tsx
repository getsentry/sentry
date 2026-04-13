import {useMemo} from 'react';

import {Select} from '@sentry/scraps/select';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ScmSearchControl} from './scmSearchControl';
import {ScmVirtualizedMenuList} from './scmVirtualizedMenuList';
import {useScmRepos} from './useScmRepos';
import {useScmRepoSelection} from './useScmRepoSelection';

interface ScmRepoSelectorProps {
  integration: Integration;
}

export function ScmRepoSelector({integration}: ScmRepoSelectorProps) {
  const organization = useOrganization();
  const {selectedRepository, setSelectedRepository, clearDerivedState} =
    useOnboardingContext();
  const {reposByIdentifier, dropdownItems, isFetching, isError} = useScmRepos(
    integration.id,
    selectedRepository
  );

  const {busy, handleSelect, handleRemove} = useScmRepoSelection({
    integration,
    onSelect: setSelectedRepository,
    reposByIdentifier,
  });

  // Prepend the selected repo so the Select can always resolve and display
  // it, even when the fetched list does not include it.
  const options = useMemo(() => {
    const selectedSlug = selectedRepository?.externalSlug;
    if (!selectedSlug || dropdownItems.some(item => item.value === selectedSlug)) {
      return dropdownItems;
    }
    return [
      {
        value: selectedSlug,
        label: selectedRepository.name,
        disabled: true,
      },
      ...dropdownItems,
    ];
  }, [dropdownItems, selectedRepository]);

  function handleChange(option: {value: string} | null) {
    // Changing or clearing the repo invalidates downstream state (platform,
    // features, created project) which are all derived from the selected repo.
    clearDerivedState();

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
      return t('Failed to load repositories. Please try again.');
    }
    return t(
      'No repositories found. Check your installation permissions to ensure your integration has access.'
    );
  }

  return (
    <Select
      placeholder={t('Search repositories')}
      options={options}
      value={selectedRepository?.externalSlug ?? null}
      onChange={handleChange}
      noOptionsMessage={noOptionsMessage}
      isLoading={isFetching}
      isDisabled={busy}
      clearable
      searchable
      components={{Control: ScmSearchControl, MenuList: ScmVirtualizedMenuList}}
    />
  );
}
