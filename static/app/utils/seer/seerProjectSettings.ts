import {mutationOptions, type QueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {PROVIDER_TO_HANDOFF_TARGET} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getInternalStoppingPoint} from 'sentry/utils/seer/stoppingPoint';
import type {
  SeerAgent,
  SeerProjectSettings,
  SeerProjectSettingsResponse,
} from 'sentry/utils/seer/types';

export const seerProjectSettingsSchema = z.object({
  agent: z.enum(['seer', 'cursor_background_agent', 'claude_code_agent']),
  automation_tuning: z.enum(['off', 'low', 'medium', 'high']),
  handoff: z.object({
    auto_create_pr: z.boolean(),
    handoff_point: z.literal('root_cause'),
    integration_id: z.number(),
    target: z.enum(['cursor_background_agent', 'claude_code_agent']),
  }),
  repos_count: z.number(),
  scanner_automation: z.boolean(),
  stopping_point: z.enum(['off', 'root_cause', 'plan', 'create_pr']),
});

export function getSeerProjectSettingsQueryOptions({
  organization,
  project,
}: {
  organization: Organization;
  project: AvatarProject;
}) {
  return apiOptions.as<SeerProjectSettingsResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/settings/',
    {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      staleTime: 60_000, // 1 minute
    }
  );
}

function resolveIntegrationId(
  agent: SeerAgent,
  knownAgents: CodingAgentIntegration[] | undefined
): string | null | undefined {
  if (!knownAgents) {
    return undefined;
  }
  if (agent === 'seer') {
    return null;
  }
  return (
    knownAgents.find(i => PROVIDER_TO_HANDOFF_TARGET[i.provider] === agent)?.id ?? null
  );
}

export function getMutateSeerProjectSettingsOptions({
  organization,
  project,
  queryClient,
  knownAgents,
}: {
  organization: Organization;
  project: AvatarProject;
  queryClient: QueryClient;
  knownAgents?: CodingAgentIntegration[];
}) {
  const queryKey = getSeerProjectSettingsQueryOptions({organization, project}).queryKey;
  const [url] = queryKey;

  return mutationOptions({
    mutationFn: (data: Partial<SeerProjectSettings>) => {
      const integrationId =
        data.agent && data.agent !== 'seer'
          ? resolveIntegrationId(data.agent, knownAgents)
          : undefined;

      const isOff = data.stopping_point === 'off';
      const tuning =
        data.stopping_point === undefined
          ? undefined
          : isOff
            ? ('off' as const)
            : ('medium' as const);

      const {stopping_point: _sp, ...rest} = data;
      const payload = isOff ? rest : data;

      return fetchMutation<SeerProjectSettingsResponse>({
        method: 'PUT',
        url,
        data: {
          ...payload,
          ...(integrationId !== undefined && {integrationId}),
          ...(tuning !== undefined && {automation_tuning: tuning}),
        },
      });
    },
    onMutate: async data => {
      await queryClient.cancelQueries({queryKey});
      const previousData = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, prev => {
        if (!prev) {
          return prev;
        }
        const jsonUpdates: Partial<SeerProjectSettingsResponse> = {};
        if (data.agent !== undefined) {
          jsonUpdates.agent = data.agent;
          const resolved = resolveIntegrationId(data.agent, knownAgents);
          if (resolved !== undefined) {
            jsonUpdates.integrationId = resolved;
          }
        }
        if (data.stopping_point !== undefined) {
          jsonUpdates.stoppingPoint = getInternalStoppingPoint(data.stopping_point);
          jsonUpdates.automationTuning = data.stopping_point === 'off' ? 'off' : 'medium';
        }
        return {...prev, json: {...prev.json, ...jsonUpdates}};
      });

      return {previousData};
    },
    onError: (_error, _data, context) => {
      queryClient.setQueryData(queryKey, context?.previousData);
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey});
    },
  });
}
