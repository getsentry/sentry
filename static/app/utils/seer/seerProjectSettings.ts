import {
  type InfiniteData,
  mutationOptions,
  type QueryClient,
} from '@tanstack/react-query';
import {z} from 'zod';

import {PROVIDER_TO_HANDOFF_TARGET} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getInternalStoppingPoint} from 'sentry/utils/seer/stoppingPoint';
import type {
  SeerProjectSetting,
  SeerAgent,
  SeerProjectSettingResponse,
  SeerProjectSettingUpdate,
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
  stoppingPoint: z.enum(['off', 'root_cause', 'plan', 'create_pr']),
});

export function getSeerProjectSettingsQueryOptions({
  organization,
  project,
}: {
  organization: Organization;
  project: AvatarProject;
}) {
  return apiOptions.as<SeerProjectSettingResponse>()(
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
) {
  if (!knownAgents) {
    return;
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
    mutationFn: (data: SeerProjectSettingUpdate) => {
      const integrationId =
        data.agent && data.agent !== 'seer'
          ? resolveIntegrationId(data.agent, knownAgents)
          : undefined;

      const isOff = data.stoppingPoint === 'off';
      const tuning =
        data.stoppingPoint === undefined
          ? undefined
          : isOff
            ? ('off' as const)
            : ('medium' as const);

      const {stoppingPoint, ...rest} = data;

      return fetchMutation<SeerProjectSettingResponse>({
        method: 'PUT',
        url,
        data: {
          ...rest,
          ...(!isOff &&
            stoppingPoint !== undefined && {
              stoppingPoint: getInternalStoppingPoint(stoppingPoint, true),
            }),
          ...(integrationId !== undefined && {integrationId}),
          ...(tuning !== undefined && {automationTuning: tuning}),
        },
      });
    },
    onMutate: async data => {
      const infiniteQueryKey = getInfiniteSeerProjectsSettingsQueryOptions({
        organization,
        query: {},
      }).queryKey;
      const [infiniteUrl] = infiniteQueryKey;

      await queryClient.cancelQueries({queryKey});
      await queryClient.cancelQueries({
        queryKey: [infiniteUrl],
        exact: false,
      });

      const previousData = queryClient.getQueryData(queryKey);

      const jsonUpdates: Partial<SeerProjectSettingResponse> = {};
      if (data.agent !== undefined) {
        jsonUpdates.agent = data.agent;
        const resolved = resolveIntegrationId(data.agent, knownAgents);
        if (resolved !== undefined) {
          jsonUpdates.integrationId = resolved;
        }
      }
      if (data.stoppingPoint !== undefined) {
        if (data.stoppingPoint === 'off') {
          jsonUpdates.automationTuning = 'off';
        } else {
          jsonUpdates.stoppingPoint = getInternalStoppingPoint(data.stoppingPoint, true);
          jsonUpdates.automationTuning = 'medium';
        }
      }

      queryClient.setQueryData(
        queryKey,
        (prev: ApiResponse<SeerProjectSettingResponse> | undefined) => {
          if (!prev) {
            return prev;
          }
          return {...prev, json: {...prev.json, ...jsonUpdates}};
        }
      );

      queryClient.setQueriesData(
        {queryKey: [infiniteUrl], exact: false},
        (prev: InfiniteData<ApiResponse<SeerProjectSettingResponse[]>> | undefined) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            pages: prev.pages.map(page => ({
              ...page,
              json: page.json.map(item =>
                item.projectSlug === project.slug ? {...item, ...jsonUpdates} : item
              ),
            })),
          };
        }
      );

      return {previousData, infiniteUrl};
    },
    onError: (_error, _data, context) => {
      queryClient.setQueryData(queryKey, context?.previousData);
      if (context?.infiniteUrl) {
        queryClient.invalidateQueries({
          queryKey: [context.infiniteUrl],
          exact: false,
        });
      }
    },
    onSettled: () => {
      const infiniteQueryKey = getInfiniteSeerProjectsSettingsQueryOptions({
        organization,
        query: {},
      }).queryKey;
      const [infiniteUrl] = infiniteQueryKey;

      queryClient.invalidateQueries({queryKey});
      queryClient.invalidateQueries({queryKey: [infiniteUrl], exact: false});
    },
  });
}

export function getInfiniteSeerProjectsSettingsQueryOptions({
  organization,
  query,
}: {
  organization: Organization;
  query: {
    cursor?: string;
    per_page?: number;
    query?: string;
    sort?: Sort;
  };
}) {
  const {per_page = 100, sort, ...rest} = query;
  const sortQuery = sort ? encodeSort(sort) : undefined;
  return apiOptions.asInfinite<SeerProjectSettingResponse[]>()(
    '/organizations/$organizationIdOrSlug/seer/projects/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {per_page, sort: sortQuery, ...rest},
      staleTime: 60_000, // 1 minute
    }
  );
}

export function getMutateSeerProjectsSettingsOptions({
  organization,
  queryClient,
}: {
  organization: Organization;
  queryClient: QueryClient;
}) {
  const queryKey = getInfiniteSeerProjectsSettingsQueryOptions({
    organization,
    query: {},
  }).queryKey;
  const [url] = queryKey;

  return mutationOptions({
    mutationFn: (data: Partial<SeerProjectSetting>) => {
      return fetchMutation({
        method: 'PUT',
        url,
        data,
      });
    },
    onMutate: async _data => {
      await queryClient.cancelQueries({queryKey: [url]});
      const previousData = queryClient.getQueryData(queryKey);

      // TODO: Optimistically update the query cache? We need to convert some
      // values, if we have them
      //
      // queryClient.setQueryData(
      //   queryKey,
      //   (prev: ApiResponse<SeerProjectSettingsResponse> | undefined) =>
      //     prev
      //       ? {...prev, json: {...prev.json, ...data}}
      //       : {headers: {}, json: {...(data as SeerProjectSettingsResponse)}}
      // );

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
