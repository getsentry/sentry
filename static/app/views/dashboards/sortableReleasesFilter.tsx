import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import {
  ReleasesSortSelect,
  type ReleasesSortByOption,
} from './components/releasesSortSelect';
import {ReleasesSelectControl} from './releasesSelectControl';
import type {DashboardFilters} from './types';
import {DashboardFilterKeys} from './types';

type Props = {
  selectedReleases: string[];
  sortBy: ReleasesSortByOption;
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
  isDisabled?: boolean;
  onSortChange?: (sortBy: string) => void;
};

export function SortableReleasesFilter({
  selectedReleases,
  sortBy,
  handleChangeFilter,
  isDisabled,
  onSortChange,
}: Props) {
  const organization = useOrganization();

  return (
    <PageFilterBar>
      <ReleasesSelectControl
        sortBy={sortBy}
        handleChangeFilter={activeFilters => {
          handleChangeFilter?.({
            ...activeFilters,
            [DashboardFilterKeys.RELEASE]: activeFilters[DashboardFilterKeys.RELEASE],
          });
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
      />
    </PageFilterBar>
  );
}
