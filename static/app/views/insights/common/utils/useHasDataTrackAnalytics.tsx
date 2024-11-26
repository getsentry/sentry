import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import type {ModuleName} from 'sentry/views/insights/types';

export function useHasDataTrackAnalytics(module: ModuleName, analyticEvent?: string) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const view = useDomainViewFilters();

  const hasEverSentData = useHasFirstSpan(module);

  Sentry.setTag(`insights.${module}.hasEverSentData`, hasEverSentData);

  const projects = JSON.stringify(pageFilters.selection.projects);

  useEffect(() => {
    if (pageFilters.isReady && analyticEvent) {
      trackAnalytics(analyticEvent, {
        organization,
        has_ever_sent_data: hasEverSentData,
        ...(view ? {view} : {}),
      });
    }
  }, [organization, hasEverSentData, analyticEvent, projects, pageFilters.isReady, view]);
}
