import {useEffect} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export type PreprodBuildsAnalyticsPageSource =
  | 'preprod_builds_list'
  | 'releases_mobile_builds_tab'
  | 'releases_details_preprod_builds';

export type PreprodBuildsAnalyticsDisplay = 'size' | 'distribution';

interface UsePreprodBuildsAnalyticsProps {
  builds: BuildDetailsApiResponse[];
  buildsTotalCount: number;
  display: PreprodBuildsAnalyticsDisplay;
  isLoading: boolean;
  pageSource: PreprodBuildsAnalyticsPageSource;
  perPage: number;
  cursor?: string | null;
  enabled?: boolean;
  error?: boolean;
  projectCount?: number;
  searchQuery?: string | null;
}

export function usePreprodBuildsAnalytics({
  builds,
  buildsTotalCount,
  cursor,
  display,
  enabled = true,
  error,
  isLoading,
  pageSource,
  perPage,
  projectCount,
  searchQuery,
}: UsePreprodBuildsAnalyticsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const datetimeSelection = `${selection.datetime.start || ''}-${selection.datetime.end || ''}-${selection.datetime.period || ''}`;
  const resolvedProjectCount = projectCount ?? selection.projects.length;
  const normalizedSearchQuery = searchQuery?.trim() ?? '';
  const hasSearchQuery = normalizedSearchQuery.length > 0;
  const buildsPageCount = builds.length;

  useEffect(() => {
    if (!enabled || isLoading) {
      return;
    }

    trackAnalytics('preprod.builds.list.metadata', {
      organization,
      builds_page_count: buildsPageCount,
      builds_total_count: buildsTotalCount,
      query_status: error ? 'error' : 'success',
      is_empty: !error && buildsTotalCount === 0,
      has_search_query: hasSearchQuery,
      page_source: pageSource,
      display,
      cursor: cursor ?? null,
      per_page: perPage,
      project_count: resolvedProjectCount,
      datetime_selection: datetimeSelection,
    });
  }, [
    buildsPageCount,
    buildsTotalCount,
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
    perPage,
    resolvedProjectCount,
  ]);
}
