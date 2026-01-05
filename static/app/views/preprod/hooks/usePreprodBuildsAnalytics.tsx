import {useEffect} from 'react';

import type {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {BuildListPageSource} from 'sentry/utils/analytics/preprodBuildAnalyticsEvents';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

interface UsePreprodBuildsAnalyticsProps {
  builds: BuildDetailsApiResponse[];
  display: PreprodBuildsDisplay;
  isLoading: boolean;
  pageSource: BuildListPageSource;
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

  useEffect(() => {
    if (!enabled || isLoading) {
      return;
    }
    const buildCountOnPage = builds.length;

    trackAnalytics('preprod.builds.list.metadata', {
      organization,
      build_count_on_page: buildCountOnPage,
      query_status: error ? 'error' : 'success',
      is_empty: !error && buildCountOnPage === 0,
      has_search_query: (searchQuery?.trim() ?? '').length > 0,
      page_source: pageSource,
      display,
      cursor: cursor ?? null,
      project_count: projectCount ?? selection.projects.length,
      datetime_selection: datetimeSelection,
    });
  }, [
    builds.length,
    cursor,
    datetimeSelection,
    display,
    enabled,
    error,
    isLoading,
    organization,
    pageSource,
    projectCount,
    searchQuery,
    selection.projects.length,
  ]);
}
