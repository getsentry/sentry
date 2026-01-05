import {useEffect} from 'react';

import type {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export type PreprodBuildsAnalyticsPageSource =
  | 'preprod_builds_list'
  | 'releases_mobile_builds_tab'
  | 'releases_details_preprod_builds';

interface UsePreprodBuildsAnalyticsProps {
  builds: BuildDetailsApiResponse[];
  display: PreprodBuildsDisplay;
  isLoading: boolean;
  pageSource: PreprodBuildsAnalyticsPageSource;
  cursor?: string | null;
  enabled?: boolean;
  error?: boolean;
  projectCount?: number;
  searchQuery?: string | null;
}

export function usePreprodBuildsAnalytics({
  builds,
  cursor,
  display,
  enabled = true,
  error,
  isLoading,
  pageSource,
  projectCount,
  searchQuery,
}: UsePreprodBuildsAnalyticsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const datetimeSelection = `${selection.datetime.start || ''}-${selection.datetime.end || ''}-${selection.datetime.period || ''}`;
  const resolvedProjectCount = projectCount ?? selection.projects.length;
  const normalizedSearchQuery = searchQuery?.trim() ?? '';
  const hasSearchQuery = normalizedSearchQuery.length > 0;
  const buildCountOnPage = builds.length;

  useEffect(() => {
    if (!enabled || isLoading) {
      return;
    }

    trackAnalytics('preprod.builds.list.metadata', {
      organization,
      build_count_on_page: buildCountOnPage,
      query_status: error ? 'error' : 'success',
      is_empty: !error && buildCountOnPage === 0,
      has_search_query: hasSearchQuery,
      page_source: pageSource,
      display,
      cursor: cursor ?? null,
      project_count: resolvedProjectCount,
      datetime_selection: datetimeSelection,
    });
  }, [
    buildCountOnPage,
    cursor,
    datetimeSelection,
    display,
    enabled,
    error,
    hasSearchQuery,
    isLoading,
    normalizedSearchQuery,
    organization,
    pageSource,
    resolvedProjectCount,
  ]);
}
