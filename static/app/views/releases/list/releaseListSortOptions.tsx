import {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization} from 'app/types';

import ReleaseListDropdown from './releaseListDropdown';
import {DisplayOption, SortOption} from './utils';

type Props = {
  selected: SortOption;
  selectedDisplay: DisplayOption;
  onSelect: (key: string) => void;
  organization: Organization;
  environments: string[];
};

function ReleaseListSortOptions({
  selected,
  selectedDisplay,
  onSelect,
  organization,
  environments,
}: Props) {
  const sortOptions = {
    [SortOption.DATE]: {label: t('Date Created')},
    [SortOption.SESSIONS]: {label: t('Total Sessions')},
    ...(selectedDisplay === DisplayOption.USERS
      ? {
          [SortOption.USERS_24_HOURS]: {label: t('Active Users')},
          [SortOption.CRASH_FREE_USERS]: {label: t('Crash Free Users')},
        }
      : {
          [SortOption.SESSIONS_24_HOURS]: {label: t('Active Sessions')},
          [SortOption.CRASH_FREE_SESSIONS]: {label: t('Crash Free Sessions')},
        }),
  } as ComponentProps<typeof ReleaseListDropdown>['options'];

  if (organization.features.includes('semver')) {
    sortOptions[SortOption.BUILD] = {label: t('Build Number')};
    sortOptions[SortOption.SEMVER] = {label: t('Semantic Version')};
  }

  if (organization.features.includes('release-adoption-stage')) {
    const isDisabled = environments.length !== 1;
    sortOptions[SortOption.ADOPTION] = {
      label: t('Date Adopted'),
      disabled: isDisabled,
      tooltip: isDisabled
        ? t('Select one environment to use this sort option.')
        : undefined,
    };
  }

  return (
    <StyledReleaseListDropdown
      label={t('Sort By')}
      options={sortOptions}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

export default ReleaseListSortOptions;

const StyledReleaseListDropdown = styled(ReleaseListDropdown)`
  z-index: 2;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    order: 2;
  }
`;
