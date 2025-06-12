import React, {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {TraceExploreAiQueryContext} from 'sentry/views/explore/contexts/traceExploreAiQueryContext';

export function TraceExploreAiQueryProvider({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const client = useApi();
  const {projects} = useProjects();
  const memberProjects = projects.filter(p => p.isMember);

  useEffect(() => {
    const selectedProjects =
      pageFilters.selection.projects &&
      pageFilters.selection.projects.length > 0 &&
      pageFilters.selection.projects[0] !== -1
        ? pageFilters.selection.projects
        : memberProjects.map(p => p.id);

    (async () => {
      try {
        await client.requestPromise(
          `/api/0/organizations/${organization.slug}/trace-explorer-ai/setup/`,
          {
            method: 'POST',
            data: {
              org_id: organization.id,
              project_ids: selectedProjects,
            },
          }
        );
      } catch (err) {
        Sentry.captureException(err);
      }
    })();
  }, [
    client,
    organization.id,
    organization.slug,
    pageFilters.selection.projects,
    projects,
    memberProjects,
  ]);

  return (
    <TraceExploreAiQueryContext.Provider value={{}}>
      {children}
    </TraceExploreAiQueryContext.Provider>
  );
}
