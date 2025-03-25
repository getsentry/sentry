import {useEffect} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

export function useOverviewPageTrackPageload() {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const projects = useProjects();
  const location = useLocation();
  const {view} = useDomainViewFilters();

  const eventView = EventView.fromLocation(location);

  const allProjects = projects.initiallyLoaded ? projects.projects : [];
  const selectedProjects = eventView
    .getFullSelectedProjects(allProjects)
    .filter(p => p !== undefined);
  const hasAllProjectsSelected = pageFilters.selection.projects.length === 0;

  // Stringifying this is just to avoid missing dependencies in the useEffect,
  // Any performance implications are negligible for such a small array
  const selectedPlatformsString = JSON.stringify([
    ...new Set(
      selectedProjects.map(project => project.platform).filter(p => p !== undefined)
    ),
  ]);

  useEffect(() => {
    if (pageFilters.isReady && projects.initiallyLoaded) {
      const selectedPlatforms = JSON.parse(selectedPlatformsString);
      trackAnalytics(`insights.page_loads.overview`, {
        organization,
        platforms: selectedPlatforms,
        hasAllProjectsSelected,
        domain: view,
      });
    }
  }, [
    organization,
    pageFilters.isReady,
    projects.initiallyLoaded,
    selectedPlatformsString,
    hasAllProjectsSelected,
    view,
  ]);
}
