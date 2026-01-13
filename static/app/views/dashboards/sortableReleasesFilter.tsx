import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ReleasesSortOption} from 'sentry/constants/releases';
import {trackAnalytics} from 'sentry/utils/analytics';
import {ReleasesProvider} from 'sentry/utils/releases/releasesProvider';
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

function getReleasesSortBy(
  sort: ReleasesSortByOption,
  environments: string[]
): ReleasesSortByOption {
  // Require 1 environment for adoption sort
  if (sort === ReleasesSortOption.ADOPTION && environments.length !== 1) {
    return ReleasesSortOption.DATE;
  }

  return sort;
}

export default function SortableReleasesFilter({
  selectedReleases,
  sortBy,
  handleChangeFilter,
  isDisabled,
  onSortChange,
}: Props) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const validatedSortBy = getReleasesSortBy(sortBy, selection.environments);

  return (
    <ReleasesProvider
      organization={organization}
      selection={selection}
      sortBy={validatedSortBy}
    >
      <PageFilterBar>
        <ReleasesSelectControl
          sortBy={validatedSortBy}
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
          sortBy={validatedSortBy}
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
    </ReleasesProvider>
  );
}
