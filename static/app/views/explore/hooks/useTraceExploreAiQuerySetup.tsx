import {useEffect, useRef} from 'react';
import * as Sentry from '@sentry/react';

import {fetchMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

interface UseTraceExploreAiQuerySetupArgs {
  enableAISearch: boolean;
}

export function useTraceExploreAiQuerySetup({
  enableAISearch,
}: UseTraceExploreAiQuerySetupArgs) {
  const hasSetupRun = useRef(false);
  const previousProjects = useRef<number[]>([]);

  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const client = useApi();
  const {projects} = useProjects();
  const memberProjects = projects.filter(p => p.isMember);

  useEffect(() => {
    if (!enableAISearch) return;

    const selectedProjects =
      pageFilters.selection.projects &&
      pageFilters.selection.projects.length > 0 &&
      pageFilters.selection.projects[0] !== -1
        ? pageFilters.selection.projects
        : memberProjects.map(p => p.id);

    if (hasSetupRun.current) {
      const prevSet = new Set(previousProjects.current);
      const currentSet = new Set(selectedProjects.map(Number));

      const projectsChanged =
        prevSet.size !== currentSet.size || ![...prevSet].every(id => currentSet.has(id));

      if (!projectsChanged) return;
    }

    previousProjects.current = selectedProjects.map(Number);
    hasSetupRun.current = true;

    (async () => {
      try {
        await fetchMutation({
          url: `/organizations/${organization.slug}/trace-explorer-ai/setup/`,
          method: 'POST',
          data: {
            org_id: organization.id,
            project_ids: selectedProjects,
          },
        });
      } catch (err) {
        Sentry.captureException(err);
      }
    })();
  }, [
    client,
    enableAISearch,
    memberProjects,
    organization.id,
    organization.slug,
    pageFilters.selection.projects,
  ]);
}
