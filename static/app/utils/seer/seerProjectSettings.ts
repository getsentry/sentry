import {
  type InfiniteData,
  mutationOptions,
  type QueryClient,
} from '@tanstack/react-query';
import {z} from 'zod';

import {
  CodingAgentProvider,
  PROVIDER_TO_HANDOFF_TARGET,
} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import type {ListItemCheckboxState} from 'sentry/utils/list/useListItemCheckboxState';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {
  SeerAgent,
  SeerProjectSettingResponse,
  SeerProjectSettingUpdatePayload,
  SeerBulkProjectSettingUpdatePayload,
} from 'sentry/utils/seer/types';

export const seerProjectSettingsSchema = z.object({
  agent: z.enum([
    'seer',
    CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
    CodingAgentProvider.CLAUDE_CODE_AGENT,
  ]),
  stoppingPoint: z.enum(['off', 'root_cause', 'solution', 'code_changes', 'open_pr']),
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

export function getInfiniteSeerProjectsSettingsQueryOptions({
  organization,
  query,
}: {
  organization: Organization;
  query: {
    agent?: SeerAgent;
    cursor?: string;
    per_page?: number;
    query?: MutableSearch;
    sortBy?: Sort;
  };
}) {
  const {per_page = 100, sortBy, query: mutableSearch, ...rest} = query;
  const sortQuery = sortBy ? encodeSort(sortBy) : undefined;
  return apiOptions.asInfinite<SeerProjectSettingResponse[]>()(
    '/organizations/$organizationIdOrSlug/seer/projects/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {per_page, sortBy: sortQuery, query: mutableSearch?.formatString(), ...rest},
      staleTime: 60_000, // 1 minute
    }
  );
}

function resolveIntegrationId(
  agent: SeerAgent,
  knownAgents: CodingAgentIntegration[] | undefined
) {
  if (!knownAgents || agent === 'seer') {
    return;
  }
  return (
    knownAgents.find(i => PROVIDER_TO_HANDOFF_TARGET[i.provider] === agent)?.id ??
    undefined
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
    mutationFn: (data: SeerProjectSettingUpdatePayload) => {
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
              stoppingPoint,
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
        jsonUpdates.integrationId = resolveIntegrationId(data.agent, knownAgents) ?? null;
      }
      if (data.stoppingPoint !== undefined) {
        if (data.stoppingPoint === 'off') {
          jsonUpdates.automationTuning = 'off';
        } else {
          jsonUpdates.stoppingPoint = data.stoppingPoint;
          jsonUpdates.automationTuning = 'medium';
        }
      }

      queryClient.setQueryData(
        queryKey,
        (prev: ApiResponse<SeerProjectSettingResponse> | undefined) => {
          if (prev) {
            return {...prev, json: {...prev.json, ...jsonUpdates}};
          }
          return;
        }
      );

      queryClient.setQueriesData(
        {queryKey: [infiniteUrl], exact: false},
        (prev: InfiniteData<ApiResponse<SeerProjectSettingResponse[]>> | undefined) => {
          if (prev) {
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
          return;
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

export function getMutateSeerProjectsSettingsOptions({
  organization,
  projectsById,
  queryClient,
  knownAgents,
}: {
  organization: Organization;
  projectsById: Map<string, AvatarProject>;
  queryClient: QueryClient;
  knownAgents?: CodingAgentIntegration[];
}) {
  const infiniteQueryKey = getInfiniteSeerProjectsSettingsQueryOptions({
    organization,
    query: {},
  }).queryKey;
  const [infiniteUrl] = infiniteQueryKey;

  const singleProjectPrefix = `/projects/${encodeURIComponent(organization.slug)}/`;
  const singleProjectSuffix = '/seer/settings/';
  const isSingleProjectSettingsQuery = (queryKey: readonly unknown[]) => {
    const url = queryKey[0];
    return (
      typeof url === 'string' &&
      url.startsWith(singleProjectPrefix) &&
      url.endsWith(singleProjectSuffix)
    );
  };

  return mutationOptions({
    mutationFn: (
      data: SeerBulkProjectSettingUpdatePayload & {
        selectedIds: ListItemCheckboxState['selectedIds'];
      }
    ) => {
      const {stoppingPoint, query, selectedIds, ...rest} = data;

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

      return fetchMutation<SeerProjectSettingResponse>({
        method: 'PUT',
        url: infiniteUrl,
        data: {
          ...rest,
          query: selectedIds === 'all' ? query : `id:[${selectedIds.join(',')}]`,
          ...(!isOff &&
            stoppingPoint !== undefined && {
              stoppingPoint,
            }),
          ...(integrationId !== undefined && {integrationId}),
          ...(tuning !== undefined && {automationTuning: tuning}),
        } satisfies SeerBulkProjectSettingUpdatePayload,
      });
    },
    onMutate: async data => {
      await queryClient.cancelQueries({queryKey: [infiniteUrl], exact: false});
      await queryClient.cancelQueries({
        predicate: q => isSingleProjectSettingsQuery(q.queryKey),
      });

      const jsonUpdates: Partial<SeerProjectSettingResponse> = {};
      if (data.agent !== undefined) {
        jsonUpdates.agent = data.agent;
        jsonUpdates.integrationId = resolveIntegrationId(data.agent, knownAgents) ?? null;
      }
      if (data.stoppingPoint !== undefined) {
        if (data.stoppingPoint === 'off') {
          jsonUpdates.automationTuning = 'off';
        } else {
          jsonUpdates.stoppingPoint = data.stoppingPoint;
          jsonUpdates.automationTuning = 'medium';
        }
      }

      const shouldUpdate = (item: SeerProjectSettingResponse) =>
        data.selectedIds === 'all' || data.selectedIds.includes(item.projectId);

      queryClient.setQueriesData(
        {queryKey: [infiniteUrl], exact: false},
        (prev: InfiniteData<ApiResponse<SeerProjectSettingResponse[]>> | undefined) => {
          if (prev) {
            return {
              ...prev,
              pages: prev.pages.map(page => ({
                ...page,
                json: page.json.map(item =>
                  shouldUpdate(item) ? {...item, ...jsonUpdates} : item
                ),
              })),
            };
          }
          return;
        }
      );

      if (data.selectedIds === 'all') {
        queryClient.setQueriesData(
          {predicate: q => isSingleProjectSettingsQuery(q.queryKey)},
          (prev: ApiResponse<SeerProjectSettingResponse> | undefined) => {
            if (prev) {
              return {...prev, json: {...prev.json, ...jsonUpdates}};
            }
            return;
          }
        );
      } else {
        for (const projectId of data.selectedIds) {
          const project = projectsById.get(projectId);
          if (!project) {
            continue;
          }
          const singleQueryKey = getSeerProjectSettingsQueryOptions({
            organization,
            project,
          }).queryKey;
          queryClient.setQueryData(
            singleQueryKey,
            (prev: ApiResponse<SeerProjectSettingResponse> | undefined) => {
              if (prev) {
                return {...prev, json: {...prev.json, ...jsonUpdates}};
              }
              return;
            }
          );
        }
      }
    },
    onError: () => {
      queryClient.invalidateQueries({queryKey: [infiniteUrl], exact: false});
      queryClient.invalidateQueries({
        predicate: q => isSingleProjectSettingsQuery(q.queryKey),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: [infiniteUrl], exact: false});
      queryClient.invalidateQueries({
        predicate: q => isSingleProjectSettingsQuery(q.queryKey),
      });
    },
  });
}
