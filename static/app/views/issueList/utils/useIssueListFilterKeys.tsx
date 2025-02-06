import {getUtcDateString} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useFetchIssueTags} from 'sentry/views/issueList/utils/useFetchIssueTags';

export function useIssueListFilterKeys() {
  const organization = useOrganization();
  const {selection: pageFilters} = usePageFilters();
  const hasFeatureFlagSearch = organization.features.includes(
    'feature-flag-autocomplete'
  );

  const {tags: issueTags} = useFetchIssueTags({
    org: organization,
    projectIds: pageFilters.projects.map(id => id.toString()),
    keepPreviousData: true,
    includeFeatureFlags: hasFeatureFlagSearch,
    start: pageFilters.datetime.start
      ? getUtcDateString(pageFilters.datetime.start)
      : undefined,
    end: pageFilters.datetime.end
      ? getUtcDateString(pageFilters.datetime.end)
      : undefined,
    statsPeriod: pageFilters.datetime.period,
  });

  return issueTags;
}
