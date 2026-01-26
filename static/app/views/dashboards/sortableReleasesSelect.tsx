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
    <PageFilterBar>
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
    </PageFilterBar>
  );
}
