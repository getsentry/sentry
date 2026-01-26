import styled from '@emotion/styled';

import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import type {ReleasesSortOption} from 'sentry/constants/releases';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import {ReleasesSortSelect} from './components/releasesSortSelect';
import {ReleasesSelectControl} from './releasesSelectControl';
import type {DashboardFilters} from './types';

interface SortableReleasesSelectProps {
  selectedReleases: string[];
  sortBy: ReleasesSortOption;
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
  isDisabled?: boolean;
  onSortChange?: (sortBy: ReleasesSortOption) => void;
}

export function SortableReleasesSelect({
  selectedReleases,
  sortBy,
  handleChangeFilter,
  isDisabled,
  onSortChange,
}: SortableReleasesSelectProps) {
  const organization = useOrganization();

  return (
    <StyledPageFilterBar>
      <ReleasesSelectControl
        sortBy={sortBy}
        handleChangeFilter={activeFilters => {
          handleChangeFilter?.(activeFilters);
          trackAnalytics('dashboards2.filter.change', {
            organization,
            filter_type: 'release',
          });
        }}
        selectedReleases={selectedReleases}
        isDisabled={isDisabled}
      />
      <ReleasesSortSelect
        sortBy={sortBy}
        onChange={value => {
          onSortChange?.(value);
          trackAnalytics('dashboards2.filter.change', {
            organization,
            filter_type: 'release_sort',
          });
        }}
        disabled={isDisabled}
      />
    </StyledPageFilterBar>
  );
}

// TURBOHACK: The regular `PageFilterBar` forces its last child (which is
// usually the date range selector) to have a minimum width of 4rem. In _this_
// case the last child is a release sort selector, which does not need a minimum
// width at all. This is a short-term turbohack because what we want is to move
// the sort selector _into_ the release selector, at which point this will
// become moot.
const StyledPageFilterBar = styled(PageFilterBar)`
  & > * {
    &:last-child {
      min-width: 0;
    }
  }
`;
