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
};

function ReleaseListSortOptions({
  selected,
  selectedDisplay,
  onSelect,
  organization,
}: Props) {
  const sortOptions = {
    [SortOption.DATE]: t('Date Created'),
    [SortOption.SESSIONS]: t('Total Sessions'),
    ...(selectedDisplay === DisplayOption.USERS
      ? {
          [SortOption.USERS_24_HOURS]: t('Active Users'),
          [SortOption.CRASH_FREE_USERS]: t('Crash Free Users'),
        }
      : {
          [SortOption.SESSIONS_24_HOURS]: t('Active Sessions'),
          [SortOption.CRASH_FREE_SESSIONS]: t('Crash Free Sessions'),
        }),
  } as Record<SortOption, string>;

  if (organization.features.includes('semver')) {
    sortOptions[SortOption.BUILD] = t('Build Number');
    sortOptions[SortOption.SEMVER] = t('Semantic Version');
  }

  if (organization.features.includes('release-adoption-stage')) {
    sortOptions[SortOption.ADOPTION] = t('Date Adopted');
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
