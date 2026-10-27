import {useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
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
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';

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
 * Starts an investigation seeded with the current page's LLM context and opens
 * it. Undefined when the organization can't use investigations.
 */
export function useStartInvestigation(): ((prompt?: string) => void) | undefined {
  const organization = useOrganization({allowNull: true});
  const organizationSlug = organization?.slug ?? '';
  const investigationsEnabled = useInvestigationsEnabled();
  const {getLLMContext} = useLLMContext();
  const {selection} = usePageFilters();
  const {projects} = useProjects();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {mutate, isPending} = useStartManualInvestigationMutation(organizationSlug, {
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
    (prompt?: string) => {
      if (isPending) {
        return;
      }
      toast.loading(t('Starting investigation…'));
      mutate({
        source: {
          type: 'manual',
          prompt: prompt || DEFAULT_PROMPT,
          seed: {pageContext: getLLMContext()},
        },
        projectIds: projects
          .filter(project => isProjectSelected(project, selection.projects))
          .map(project => Number(project.id)),
      });
    },
    [isPending, mutate, getLLMContext, projects, selection.projects]
  );

  return investigationsEnabled ? startInvestigation : undefined;
}
