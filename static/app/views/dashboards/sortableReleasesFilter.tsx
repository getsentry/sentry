import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  ReleasesSort,
  type ReleasesSortByOption,
} from 'sentry/views/insights/common/components/releasesSort';

import ReleasesSelectControl from './releasesSelectControl';
import type {DashboardFilters} from './types';
import {DashboardFilterKeys} from './types';

type Props = {
  selectedReleases: string[];
  sortBy: ReleasesSortByOption;
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
  isDisabled?: boolean;
  onSortChange?: (sortBy: string) => void;
};

export default function SortableReleasesFilter({
  selectedReleases,
  sortBy,
  handleChangeFilter,
  isDisabled,
  onSortChange,
}: Props) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

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
      <ReleasesSort
        sortBy={sortBy}
        environments={selection.environments}
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
