import {useCallback} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {makeProjectSeerPreferencesQueryKey} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {SeerPreferencesResponse} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {PROVIDER_TO_HANDOFF_TARGET} from 'sentry/components/events/autofix/types';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {processInChunks} from 'sentry/utils/array/procesInChunks';
import {
  fetchDataQuery,
  fetchMutation,
  useQueryClient,
  useQuery,
} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

type PreferredAgent = 'seer' | CodingAgentIntegration;

export function useFetchAgentOptions({
  organization,
  enabled = true,
}: {
  organization: Organization;
  enabled?: boolean;
}) {
  return useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    enabled,
    select: (data): Array<{label: string; value: PreferredAgent}> => {
      return [
        {value: 'seer', label: t('Seer Agent')},
        ...(data.json.integrations ?? [])
          .filter(integration => integration.id)
          .map(integration => ({
            value: integration,
            label: integration.name,
          })),
      ];
    },
  });
}

export function useBulkMutateSelectedAgent() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useCallback(
    async (projects: Project[], integration: PreferredAgent) => {
      const results = await processInChunks({
        items: projects,
        chunkSize: 15,
        fn: async project => {
          const [preferencesData] = await queryClient.fetchQuery({
            queryKey: makeProjectSeerPreferencesQueryKey(organization.slug, project.slug),
            queryFn: fetchDataQuery<SeerPreferencesResponse>,
            staleTime: 0,
          });
          const preference = preferencesData?.preference;

          const handoff: ProjectSeerPreferences['automation_handoff'] =
            integration !== 'seer' && integration
              ? {
                  handoff_point: 'root_cause',
                  target: PROVIDER_TO_HANDOFF_TARGET[integration.provider]!,
                  integration_id: Number(integration.id),
                  auto_create_pr: preference?.automated_run_stopping_point === 'open_pr',
                }
              : undefined;

          return Promise.all([
            fetchMutation({
              method: 'PUT',
              url: `/projects/${organization.slug}/${project.slug}/`,
              data: {autofixAutomationTuning: 'medium'},
            }),
            fetchMutation({
              method: 'POST',
              url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
              data: {
                repositories: preference?.repositories ?? [],
                automated_run_stopping_point: preference?.automated_run_stopping_point,
                automation_handoff: handoff,
              },
            }),
          ]);
        },
      });

      // Update store only for projects that succeeded
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          ProjectsStore.onUpdateSuccess({
            id: projects[i]!.id,
            autofixAutomationTuning: 'medium',
          });
        }
      });

      // Always invalidate to sync cache with whatever the server actually saved
      queryClient.invalidateQueries({
        queryKey: bulkAutofixAutomationSettingsInfiniteOptions({
          organization,
        }).queryKey,
      });
      for (const project of projects) {
        queryClient.invalidateQueries({
          queryKey: makeProjectSeerPreferencesQueryKey(organization.slug, project.slug),
        });
      }

      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length) {
        const has429 = failures.some(
          r => r.reason instanceof RequestError && r.reason.status === 429
        );
        if (has429) {
          addErrorMessage(
            t('Too many requests. Please wait a moment before trying again.')
          );
        } else {
          addErrorMessage(
            t(
              'Failed to update settings for %s project(s). Please try again.',
              failures.length
            )
          );
        }
      }
    },
    [organization, queryClient]
  );
}
