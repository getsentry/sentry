import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {toast} from '@sentry/scraps/toast';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  getInvestigationDetailQueryOptions,
  useStartManualInvestigationMutation,
} from 'sentry/views/investigations/api';
import {
  getInvestigationPath,
  useInvestigationsEnabled,
} from 'sentry/views/investigations/utils';
import {usePageContextCapture} from 'sentry/views/seerExplorer/hooks/usePageContextCapture';
import {usePageReferrer} from 'sentry/views/seerExplorer/utils';

// A run without a prompt waits for input, which the investigation page has no
// way to give, so there is always a question to start from.
const DEFAULT_PROMPT = 'Investigate what I am looking at on this page.';

function isProjectSelected(project: Project, selectedProjects: number[]) {
  if (selectedProjects.includes(ALL_ACCESS_PROJECTS)) {
    return project.hasAccess;
  }
  // An empty selection is My Projects.
  if (selectedProjects.length === 0) {
    return project.isMember;
  }
  return selectedProjects.includes(Number(project.id));
}

/**
 * The run can only read the investigation's projects. My Projects is empty for
 * someone on no project's team, and investigations need open membership, so
 * that falls back to every project they can access.
 */
function getProjectIds(selectedProjects: number[], projects: Project[]) {
  const selected = projects.filter(project =>
    isProjectSelected(project, selectedProjects)
  );
  return (
    selected.length > 0 ? selected : projects.filter(project => project.hasAccess)
  ).map(project => Number(project.id));
}

/** The page's date range, resolved to the absolute range a run takes. */
function getTimeRange(datetime: PageFilters['datetime']) {
  const {statsPeriod, start, end} = normalizeDateTimeParams(datetime);
  if (typeof statsPeriod === 'string') {
    return parseStatsPeriod(statsPeriod, null, true);
  }
  // Absolute page dates normalize to UTC without an offset.
  return {start: moment.utc(start).format(), end: moment.utc(end).format()};
}

/**
 * Starts an investigation seeded with the current page's context and opens it,
 * resolving to whether it started. Undefined when the organization can't use
 * investigations.
 */
export function useStartInvestigation():
  | ((prompt?: string) => Promise<boolean>)
  | undefined {
  const organization = useOrganization({allowNull: true});
  const organizationSlug = organization?.slug ?? '';
  const investigationsEnabled = useInvestigationsEnabled();
  const capturePageContext = usePageContextCapture();
  const {getPageReferrer} = usePageReferrer();
  const {selection} = usePageFilters();
  const {projects} = useProjects();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {mutateAsync, isPending} = useStartManualInvestigationMutation(organizationSlug, {
    onSuccess: investigation => {
      toast.dismiss();
      queryClient.setQueryData(
        getInvestigationDetailQueryOptions(organizationSlug, investigation.id).queryKey,
        {json: investigation, headers: {}}
      );
      navigate(getInvestigationPath(organizationSlug, investigation.id));
    },
    onError: () => toast.error(t('Unable to start investigation.')),
  });

  const startInvestigation = useCallback(
    async (prompt?: string) => {
      if (isPending) {
        return false;
      }
      const projectIds = getProjectIds(selection.projects, projects);
      if (projectIds.length === 0) {
        toast.error(t('There are no projects to investigate.'));
        return false;
      }
      // Like a chat message: pages without structured context are described by
      // what's on screen.
      const {snapshot, screenshot, isStructured} = capturePageContext({
        route: getPageReferrer(),
        allowStructured: true,
      });
      toast.loading(t('Starting investigation…'));
      try {
        await mutateAsync({
          source: {
            type: 'manual',
            prompt: prompt || DEFAULT_PROMPT,
            timeRange: getTimeRange(selection.datetime),
            seed: {
              pageContext: snapshot,
              ...(isStructured ? {} : {screenshot}),
              ...(selection.environments.length > 0
                ? {environments: selection.environments}
                : {}),
            },
          },
          projectIds,
        });
        return true;
      } catch {
        // `onError` has already said so.
        return false;
      }
    },
    [
      isPending,
      mutateAsync,
      capturePageContext,
      getPageReferrer,
      projects,
      selection.projects,
      selection.datetime,
      selection.environments,
    ]
  );

  return investigationsEnabled ? startInvestigation : undefined;
}
