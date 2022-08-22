import styled from '@emotion/styled';

import {t} from 'sentry/locale';

import {ReleasesDisplayOption} from './releasesDisplayOptions';
import ReleasesDropdown from './releasesDropdown';

export enum ReleasesSortOption {
  CRASH_FREE_USERS = 'crash_free_users',
  CRASH_FREE_SESSIONS = 'crash_free_sessions',
  USERS_24_HOURS = 'users_24h',
  SESSIONS_24_HOURS = 'sessions_24h',
  SESSIONS = 'sessions',
  DATE = 'date',
  BUILD = 'build',
  SEMVER = 'semver',
  ADOPTION = 'adoption',
}

type Props = {
  environments: string[];
  onSelect: (key: string) => void;
  selected: ReleasesSortOption;
  selectedDisplay: ReleasesDisplayOption;
};

function ReleasesSortOptions({selected, selectedDisplay, onSelect, environments}: Props) {
  const sortOptions = {
    [ReleasesSortOption.DATE]: {label: t('Date Created')},
    [ReleasesSortOption.SESSIONS]: {label: t('Total Sessions')},
    ...(selectedDisplay === ReleasesDisplayOption.USERS
      ? {
          [ReleasesSortOption.USERS_24_HOURS]: {label: t('Active Users')},
          [ReleasesSortOption.CRASH_FREE_USERS]: {label: t('Crash Free Users')},
        }
      : {
          [ReleasesSortOption.SESSIONS_24_HOURS]: {label: t('Active Sessions')},
          [ReleasesSortOption.CRASH_FREE_SESSIONS]: {label: t('Crash Free Sessions')},
        }),
    [ReleasesSortOption.BUILD]: {label: t('Build Number')},
    [ReleasesSortOption.SEMVER]: {label: t('Semantic Version')},
  } as React.ComponentProps<typeof ReleasesDropdown>['options'];

  const isDisabled = environments.length !== 1;
  sortOptions[ReleasesSortOption.ADOPTION] = {
    label: t('Date Adopted'),
    disabled: isDisabled,
    tooltip: isDisabled
      ? t('Select one environment to use this sort option.')
      : undefined,
  };

  return (
    <StyledReleasesDropdown
      label={t('Sort By')}
      options={sortOptions}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

export default ReleasesSortOptions;

const StyledReleasesDropdown = styled(ReleasesDropdown)`
  z-index: 2;
  @media (max-width: ${p => p.theme.breakpoints.large}) {
    order: 2;
  }
`;
