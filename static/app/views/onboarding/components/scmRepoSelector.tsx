import {useMemo} from 'react';

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
 *
 * Props are typed as `any` because react-select's generic types don't
 * match the specific option shape our Select wrapper uses, and there's
 * no clean way to type custom components without casting. This matches
 * the pattern used elsewhere (e.g. ruleConditionsForm, typeSelector).
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
      components={{Control: SearchControl}}
    />
  );
}
