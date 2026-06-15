import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {projectSeerPreferencesApiOptions} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
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
import {getSeerProjectSettingsQueryOptions} from 'sentry/utils/seer/seerProjectSettings';
import {
  getTuningFromStoppingPoint,
  resolveStoppingPoint,
} from 'sentry/utils/seer/stoppingPoint';
import type {
  AutofixAgentSelectOption,
  SeerProjectSettingResponse,
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

/**
 * Thrown when the repos write succeeds but the follow-up settings write fails.
 *
 * The project is left partially saved (repos updated, settings stale). Both
 * writes are idempotent full-replaces, so re-submitting the form re-sends both
 * requests and converges to the desired state. Callers should use this to tell
 * the user their repositories were saved and that retrying is safe, rather than
 * showing a generic "nothing saved" error.
 */
export class AutofixSettingsPartialSaveError extends Error {
  constructor(options?: {cause?: unknown}) {
    super('Repositories were saved, but Seer settings could not be updated.', options);
    this.name = 'AutofixSettingsPartialSaveError';
  }
}

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
      const {stoppingPointValue} = resolveStoppingPoint(stoppingPoint, undefined);
      // For an external coding agent, whether it auto-opens a PR is the handoff's
      // auto_create_pr flag. Seat-based orgs derive this server-side from the
      // stopping point, but legacy orgs do not — so send it explicitly. Seat-based
      // ignores the unknown field and uses its own derivation, so this is safe for
      // both. (Returns undefined for Seer, which has no handoff.)
      const handoff = buildHandoffPayload(
        agent,
        integrationId,
        stoppingPoint === 'create_pr'
      );

      const repos = repoEntries
        .filter(e => Boolean(e.repoId))
        .map(e => ({
          repositoryId: Number(e.repoId),
          branchName: e.branch || null,
        }));

      // There is no single endpoint that writes both repos and settings, so
      // this is two sequential requests. The ordering is deliberate and the
      // sequencing is load-bearing — do NOT parallelize with Promise.all:
      //
      // 1. Repos are written FIRST because they are the higher-priority write.
      //    The endpoint is addressed by repositoryId, so it handles GitLab's
      //    nested-group names that the legacy preferences endpoint's
      //    provider/owner/name matching cannot. Its replace-all is transactional,
      //    so if this request fails we abort before touching settings and
      //    nothing is persisted.
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

      // 2. Agent, tuning, and stopping point are written SECOND, through the
      //    project settings endpoint added for the new Seer settings UI. Because
      //    settings goes last, the only reachable partial-failure state is
      //    "repos saved, settings stale" — the benign one, since repos matter
      //    more. Both endpoints take idempotent full-replace payloads, so a
      //    failure here is recoverable by re-submitting. Surface it as a
      //    distinct error so the caller can tell the user their repos were saved.
      const settingsQueryOptions = getSeerProjectSettingsQueryOptions({
        organization,
        project: {slug: project.slug},
      });
      const [settingsUrl] = settingsQueryOptions.queryKey;
      try {
        await fetchMutation<SeerProjectSettingResponse>({
          method: 'PUT',
          url: settingsUrl,
          data: {
            agent,
            ...(integrationId ? {integrationId} : {}),
            automationTuning: tuning,
            ...(stoppingPointValue ? {stoppingPoint: stoppingPointValue} : {}),
            ...(handoff ? {autoCreatePr: handoff.auto_create_pr} : {}),
          },
        });
      } catch (error) {
        throw new AutofixSettingsPartialSaveError({cause: error});
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
        queryKey: projectSeerPreferencesApiOptions(organization.slug, project.slug)
          .queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: bulkAutofixAutomationSettingsInfiniteOptions({organization}).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: getSeerProjectSettingsQueryOptions({
          organization,
          project: {slug: project.slug},
        }).queryKey,
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
