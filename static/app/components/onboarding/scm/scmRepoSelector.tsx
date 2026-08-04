import {useMemo} from 'react';

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
        disabled: true,
      },
      ...dropdownItems,
    ];
  }, [dropdownItems, selectedRepository]);

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
      options={options}
      value={selectedRepository?.externalSlug ?? null}
      onChange={handleChange}
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
