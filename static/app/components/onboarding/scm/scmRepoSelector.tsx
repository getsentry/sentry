import {useMemo, useState} from 'react';

import {Select} from '@sentry/scraps/select';

import {t} from 'sentry/locale';
import type {Integration, Repository} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {type ScmAnalyticsFlow, scmFlowVariantParams} from './scmAnalyticsFlow';
import {ScmSearchControl} from './scmSearchControl';
import {ScmVirtualizedMenuList} from './scmVirtualizedMenuList';
import {useScmRepos} from './useScmRepos';
import {useScmRepoSelection} from './useScmRepoSelection';

const REPO_SELECTED_EVENT = {
  onboarding: 'onboarding.scm_connect_repo_selected',
  'project-creation': 'project_creation.connect_repo_selected',
} as const;

function getRepositoryNameTokens(label: string) {
  return label
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[-_.\s/]+/)
    .filter(Boolean)
    .map(token => token.toLowerCase());
}

function getSearchRank(label: string, search: string) {
  const normalizedLabel = label.toLowerCase();
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return 0;
  }
  if (normalizedLabel === normalizedSearch) {
    return 0;
  }

  const exactTokenIndex = getRepositoryNameTokens(label).indexOf(normalizedSearch);
  if (exactTokenIndex === 0) {
    return 1;
  }
  if (exactTokenIndex > 0) {
    return 2;
  }
  if (normalizedLabel.startsWith(normalizedSearch)) {
    return 3;
  }
  if (normalizedLabel.includes(normalizedSearch)) {
    return 4;
  }
  return 5;
}

interface ScmRepoSelectorProps {
  // Which flow this component is rendered in. Drives analytics event names.
  analyticsFlow: ScmAnalyticsFlow;
  integration: Integration;
  // Fired once per user-driven change (select or clear) so callers can
  // invalidate state derived from the repo (platform, features, created
  // project). Distinct from onRepositoryChange because the underlying repo
  // selection hook can fire that callback multiple times for one user action
  // (optimistic + resolved + error paths).
  onClearDerivedState: () => void;
  onRepositoryChange: (repo: Repository | undefined) => void;
  selectedRepository: Repository | undefined;
}

export function ScmRepoSelector({
  analyticsFlow,
  integration,
  onClearDerivedState,
  onRepositoryChange,
  selectedRepository,
}: ScmRepoSelectorProps) {
  const organization = useOrganization();
  const [search, setSearch] = useState('');
  const {reposByIdentifier, dropdownItems, isFetching, isError} = useScmRepos(
    integration.id,
    selectedRepository
  );

  const {busy, handleSelect, handleRemove} = useScmRepoSelection({
    integration,
    onSelect: onRepositoryChange,
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
        textValue: selectedRepository.name,
        disabled: true,
      },
      ...dropdownItems,
    ];
  }, [dropdownItems, selectedRepository]);

  const rankedOptions = useMemo(
    () =>
      options
        .map((option, originalIndex) => ({
          option,
          originalIndex,
          rank: getSearchRank(option.label, search),
        }))
        .toSorted((a, b) => a.rank - b.rank || a.originalIndex - b.originalIndex)
        // react-select preserves focus by object identity. Clone reordered
        // options so keyboard focus follows the highest-ranked result.
        .map(({option}) => ({...option})),
    [options, search]
  );

  function handleChange(option: {value: string} | null) {
    onClearDerivedState();

    if (option === null) {
      handleRemove();
    } else {
      const repo = reposByIdentifier.get(option.value);
      if (repo) {
        trackAnalytics(REPO_SELECTED_EVENT[analyticsFlow], {
          organization,
          provider: integration.provider.key,
          repo: repo.name,
          ...scmFlowVariantParams(analyticsFlow),
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
      options={rankedOptions}
      value={selectedRepository?.externalSlug ?? null}
      onChange={handleChange}
      inputValue={search}
      onInputChange={setSearch}
      noOptionsMessage={noOptionsMessage}
      isLoading={isFetching}
      isDisabled={busy}
      clearable
      searchable
      components={{Control: ScmSearchControl, MenuList: ScmVirtualizedMenuList}}
      styles={{container: base => ({...base, width: '100%'})}}
    />
  );
}
