import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {
  projectSeerPreferencesApiOptions,
  type SeerPreferencesResponse,
} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {projectSeerReposApiOptions} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerRepos';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {makeDetailedProjectQueryKey} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {
  buildHandoffPayload,
  knownAgentIntegrationsQueryOptions,
  parseAgentOption,
} from 'sentry/utils/seer/preferredAgent';
import {
  getTuningFromStoppingPoint,
  resolveStoppingPoint,
} from 'sentry/utils/seer/stoppingPoint';
import type {
  AutofixAgentSelectOption,
  UserFacingStoppingPoint,
} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

type TVariables = {
  agentOption: AutofixAgentSelectOption;
  project: Project;
  repoEntries: Array<{
    branch: string;
    repoId: string;
  }>;
  stoppingPoint: UserFacingStoppingPoint;
};

export function useMutateAutofixProject() {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const {data: knownAgents} = useQuery(
    knownAgentIntegrationsQueryOptions({organization})
  );

  return useMutation({
    mutationFn: async ({
      project,
      repoEntries,
      agentOption,
      stoppingPoint,
    }: TVariables): Promise<void> => {
      const tuning = getTuningFromStoppingPoint(stoppingPoint);
      const {agent, integrationId} = parseAgentOption(agentOption, knownAgents);
      const handoff = buildHandoffPayload(
        agent,
        integrationId,
        stoppingPoint === 'create_pr'
      );
      const {stoppingPointValue, automationHandoff} = resolveStoppingPoint(
        stoppingPoint,
        handoff
      );

      const repos = repoEntries
        .filter(e => Boolean(e.repoId))
        .map(e => ({
          repositoryId: Number(e.repoId),
          branchName: e.branch || null,
        }));

      // 1. Connected repos go through the dedicated endpoint. It is addressed by
      //    repositoryId, so it handles GitLab's nested-group names that the
      //    legacy preferences endpoint's provider/owner/name matching cannot.
      await fetchMutation({
        method: 'PUT',
        url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/repos/', {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: project.slug,
          },
        }),
        data: {repos},
      });

      // 2. Tuning + stopping point go through the bulk automation-settings
      //    endpoint. Its write path rewrites existing repos by repository_id
      //    (read back from the DB), so it avoids the legacy preferences
      //    filter_repo_by_provider path that 400s ("Invalid repository") on
      //    GitLab repos.
      await fetchMutation({
        method: 'POST',
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/autofix/automation-settings/',
          {path: {organizationIdOrSlug: organization.slug}}
        ),
        data: {
          autofixAutomationTuning: tuning,
          projectIds: [Number(project.id)],
          ...(stoppingPointValue ? {automatedRunStoppingPoint: stoppingPointValue} : {}),
        },
      });

      // 3. Coding-agent handoff (external agents only) isn't settable via the
      //    bulk endpoint, so fall back to the preferences endpoint for it. The
      //    Seer agent needs no handoff and skips this. We read back the repos we
      //    just wrote (same SeerProjectRepository store) so we don't clobber
      //    them on the preferences replace-all.
      if (automationHandoff) {
        const prefsData = await queryClient.fetchQuery({
          ...projectSeerPreferencesApiOptions(organization.slug, project.slug),
          staleTime: 0,
        });

        await fetchMutation<SeerPreferencesResponse>({
          method: 'POST',
          url: getApiUrl(
            '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/preferences/',
            {
              path: {
                organizationIdOrSlug: organization.slug,
                projectIdOrSlug: project.slug,
              },
            }
          ),
          data: {
            repositories: prefsData.json.preference?.repositories ?? [],
            automated_run_stopping_point: stoppingPointValue,
            automation_handoff: automationHandoff,
          },
        });
      }
    },
    onSuccess: (_data, variables) => {
      const {project, stoppingPoint} = variables;
      const tuning = getTuningFromStoppingPoint(stoppingPoint);

      const updatedProject = {...project, autofixAutomationTuning: tuning};
      ProjectsStore.onUpdateSuccess(updatedProject);
    },
    onSettled: (_data, _error, variables, _context) => {
      const {project} = variables;
      queryClient.invalidateQueries({
        queryKey: projectSeerReposApiOptions(organization.slug, project.slug).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: projectSeerPreferencesApiOptions(organization.slug, project.slug)
          .queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: bulkAutofixAutomationSettingsInfiniteOptions({organization}).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: makeDetailedProjectQueryKey({
          orgSlug: organization.slug,
          projectSlug: project.slug,
        }),
      });
    },
  });
}
