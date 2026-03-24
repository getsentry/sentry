import {useCallback, useMemo} from 'react';

import {Select} from '@sentry/scraps/select';

import {components as selectComponents} from 'sentry/components/forms/controls/reactSelectWrapper';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useScmRepoSearch} from './useScmRepoSearch';
import {useScmRepoSelection} from './useScmRepoSelection';

/**
 * Custom Control that prepends a search icon inside the select input.
 * Control is the outermost flex container around ValueContainer + Indicators,
 * so adding a child here doesn't break react-select's internal layout.
 */
function SearchControl({children, ...props}: any) {
  return (
    <selectComponents.Control {...props}>
      <IconSearch size="sm" variant="muted" style={{marginLeft: 12, flexShrink: 0}} />
      {children}
    </selectComponents.Control>
  );
}

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

  // Ensure the selected repo is always in the options list so the Select
  // can resolve the value and display it. Search results change as the user
  // types, so the selected option may no longer be in dropdownItems.
  const options = useMemo(() => {
    if (!selectedRepository) {
      return dropdownItems;
    }
    const selectedSlug = selectedRepository.externalSlug;
    const alreadyIncluded = dropdownItems.some(item => item.value === selectedSlug);
    if (alreadyIncluded) {
      return dropdownItems;
    }
    return [
      {
        value: selectedSlug ?? '',
        label: selectedRepository.name,
        textValue: selectedRepository.name,
        disabled: true,
      },
      ...dropdownItems,
    ];
  }, [dropdownItems, selectedRepository]);

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
      options={options}
      value={selectedRepository?.externalSlug ?? null}
      onChange={handleChange}
      onInputChange={(value, actionMeta) => {
        if (actionMeta.action === 'input-change') {
          setSearch(value);
        }
      }}
      filterOption={() => true}
      noOptionsMessage={noOptionsMessage}
      isLoading={isFetching}
      isDisabled={busy}
      clearable
      searchable
      components={{Control: SearchControl}}
    />
  );
}
