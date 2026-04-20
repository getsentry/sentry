import {useMutation, type DefaultError} from '@tanstack/react-query';

import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {makeProjectSeerPreferencesQueryKey} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Repository} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useQueryClient} from 'sentry/utils/queryClient';
import {useRepositoriesById} from 'sentry/utils/repositories/useRepositoriesById';
import {buildHandoffPayload, type PreferredAgent} from 'sentry/utils/seer/preferredAgent';
import {resolveStoppingPoint} from 'sentry/utils/seer/stoppingPoint';
import type {UserFacingStoppingPoint} from 'sentry/utils/seer/stoppingPoint';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  onError?: (error: TError, variables: TVariables, context: TOnMutateResult) => void;
  onSettled?: (
    data: TData,
    error: TError | null,
    variables: TVariables,
    context: TOnMutateResult
  ) => void;
  onSuccess?: (data: TData, variables: TVariables) => void;
}

type TData = unknown;
type TError = DefaultError;
type TVariables = {
  agent: PreferredAgent;
  project: Project;
  repoEntries: Array<{
    branch: string;
    repoId: Repository['id'];
  }>;
  stoppingPoint: UserFacingStoppingPoint;
};
type TOnMutateResult = unknown;

export function useMutateAutofixProject({onSuccess, onError, onSettled}: Props) {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const repositoriesById = useRepositoriesById();

  return useMutation<TData, TError, TVariables, TOnMutateResult>({
    mutationFn: async ({project, repoEntries, agent, stoppingPoint}) => {
      const tuning = stoppingPoint === 'off' ? ('off' as const) : ('medium' as const);

      const handoff = buildHandoffPayload(agent, stoppingPoint === 'create_pr');
      const {stoppingPointValue, automationHandoff} = resolveStoppingPoint(
        stoppingPoint,
        handoff
      );

      const repoDefinitions = repoEntries
        .filter(e => e.repoId !== null)
        .map(e => {
          const repo = repositoriesById.get(e.repoId);
          const [owner, name] = (repo?.name || '/').split('/');
          return {
            integration_id: repo?.integrationId,
            organization_id: parseInt(organization.id, 10),
            provider: repo?.provider?.name?.toLowerCase() || '',
            owner: owner || '',
            name: name || repo?.name || '',
            external_id: repo?.externalId ?? e.repoId,
            branch_name: e.branch || '',
            instructions: '',
            branch_overrides: [],
          };
        });

      return Promise.all([
        fetchMutation<Project>({
          method: 'PUT',
          url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
            },
          }),
          data: {autofixAutomationTuning: tuning},
        }),
        fetchMutation({
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
            repositories: repoDefinitions,
            automated_run_stopping_point: stoppingPointValue,
            automation_handoff: automationHandoff,
          },
        }),
      ]);
    },
    onSuccess: (data, variables) => {
      ProjectsStore.onUpdateSuccess({
        id: variables.project.id,
        autofixAutomationTuning: 'medium',
      });
      onSuccess?.(data, variables);
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context);
    },
    onSettled: (data, error, variables, context) => {
      const {project} = variables;
      queryClient.invalidateQueries({
        queryKey: makeProjectSeerPreferencesQueryKey(organization.slug, project.slug),
      });
      queryClient.invalidateQueries({
        queryKey: bulkAutofixAutomationSettingsInfiniteOptions({organization}).queryKey,
      });
      onSettled?.(data, error, variables, context);
    },
  });
}
