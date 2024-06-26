import {useEffect} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import type {ModuleName} from 'sentry/views/insights/types';

export function useHasDataTrackAnalytics(module: ModuleName, analyticEvent: string) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const hasData = useHasFirstSpan(module);

  const projects = JSON.stringify(pageFilters.selection.projects);

  useEffect(() => {
    trackAnalytics(analyticEvent, {
      organization,
      has_data: hasData,
    });
  }, [organization, hasData, analyticEvent, projects]);
}
