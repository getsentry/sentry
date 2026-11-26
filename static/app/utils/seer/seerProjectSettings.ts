import {
  type InfiniteData,
  mutationOptions,
  type QueryClient,
} from '@tanstack/react-query';
import {z} from 'zod';

import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {Sort} from 'sentry/utils/discover/fields';
import type {ListItemCheckboxState} from 'sentry/utils/list/useListItemCheckboxState';
import {fetchMutation} from 'sentry/utils/queryClient';
import {encodeSort} from 'sentry/utils/queryString';

import {isPreferredAgentProvider, parseAgentOption} from './preferredAgent';
import type {
  PreferredAgentProvider,
  SeerProjectSettingResponse,
  SeerProjectSettingUpdatePayload,
  SeerBulkProjectSettingUpdatePayload,
  AutofixAgentSelectOption,
  AgentIntegration,
} from './types';

export const seerProjectSettingsSchema = z.object({
  agentOption: z.custom<AutofixAgentSelectOption>(value => {
    if (typeof value !== 'string') {
      return false;
    }
    if (value === 'seer') {
      return true;
    }
    const [provider] = value.split('::');
    return isPreferredAgentProvider(provider);
  }),
  stoppingPoint: z.enum(['off', 'root_cause', 'solution', 'code_changes', 'open_pr']),
  openPrs: z.boolean(),
  prIteration: z.boolean(),
});

/**
 * Matches the org's seer projects settings lists for every filter and page size.
 */
export function allSeerProjectsSettingsFilter(organization: Organization) {
  return apiOptions.queryFilter('/organizations/$organizationIdOrSlug/seer/projects/', {
    path: {organizationIdOrSlug: organization.slug},
  });
}

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
    agent?: PreferredAgentProvider;
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

/**
 * Mutation key for saving one project's settings. Leave out `projectSlug` to
 * match a save for any project in the organization, e.g. with `useIsMutating`.
 */
export const getSeerProjectSettingsMutationKey = (
  orgSlug: string,
  projectSlug?: string
) =>
  projectSlug === undefined
    ? (['seer-project-settings', orgSlug] as const)
    : (['seer-project-settings', orgSlug, projectSlug] as const);

export function getMutateSeerProjectSettingsOptions({
  organization,
  project,
  queryClient,
  knownAgents,
}: {
  organization: Organization;
  project: AvatarProject;
  queryClient: QueryClient;
  knownAgents?: AgentIntegration[];
}) {
  const queryKey = getSeerProjectSettingsQueryOptions({organization, project}).queryKey;
  const url = parseQueryKey(queryKey).url;

  return mutationOptions({
    mutationKey: getSeerProjectSettingsMutationKey(organization.slug, project.slug),
    mutationFn: (data: SeerProjectSettingUpdatePayload) => {
      const {stoppingPoint, agentOption, ...rest} = data;

      const agentObj = agentOption
        ? parseAgentOption(agentOption ?? 'seer', knownAgents)
        : {};

      const isOff = stoppingPoint === 'off';
      const tuning =
        stoppingPoint === undefined
          ? undefined
          : isOff
            ? ('off' as const)
            : ('medium' as const);

      return fetchMutation<SeerProjectSettingResponse>({
        method: 'PUT',
        url,
        data: {
          ...rest,
          ...(!isOff && stoppingPoint !== undefined && {stoppingPoint}),
          ...agentObj,
          ...(tuning !== undefined && {automationTuning: tuning}),
        },
      });
    },
    onMutate: async data => {
      await queryClient.cancelQueries({queryKey});
      await queryClient.cancelQueries(allSeerProjectsSettingsFilter(organization));

      const previousData = queryClient.getQueryData(queryKey);

      const jsonUpdates: Partial<SeerProjectSettingResponse> = {};
      if (data.agentOption !== undefined) {
        const {agent, integrationId} = parseAgentOption(data.agentOption, knownAgents);
        jsonUpdates.agent = agent;
        jsonUpdates.integrationId = integrationId;
      }
      if (data.stoppingPoint !== undefined) {
        if (data.stoppingPoint === 'off') {
          jsonUpdates.automationTuning = 'off';
        } else {
          jsonUpdates.stoppingPoint = data.stoppingPoint;
          jsonUpdates.automationTuning = 'medium';
        }
      }
      if (data.autoCreatePr !== undefined) {
        jsonUpdates.autoCreatePr = data.autoCreatePr;
      }
      if (data.prIteration !== undefined) {
        jsonUpdates.prIteration = data.prIteration;
      }
      if (data.openPrs !== undefined) {
        jsonUpdates.openPrs = data.openPrs;
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
        allSeerProjectsSettingsFilter(organization),
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

      return {previousData};
    },
    onError: (_error, _data, context) => {
      queryClient.setQueryData(queryKey, context?.previousData);
      queryClient.invalidateQueries(allSeerProjectsSettingsFilter(organization));
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey});
      queryClient.invalidateQueries(allSeerProjectsSettingsFilter(organization));
    },
  });
}

/**
 * What a bulk save sends: the new settings and which projects to apply them to.
 */
export type SeerBulkEditVariables = SeerBulkProjectSettingUpdatePayload & {
  selectedIds: ListItemCheckboxState['selectedIds'];
};

export function getMutateSeerProjectsSettingsOptions({
  organization,
  projectsById,
  queryClient,
  knownAgents,
}: {
  organization: Organization;
  projectsById: Map<string, AvatarProject>;
  queryClient: QueryClient;
  knownAgents?: AgentIntegration[];
}) {
  const infiniteQueryKey = getInfiniteSeerProjectsSettingsQueryOptions({
    organization,
    query: {},
  }).queryKey;
  const infiniteUrl = parseQueryKey(infiniteQueryKey).url;

  const singleProjectSettingsFilter = apiOptions.queryFilter(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/settings/*',
    {path: {organizationIdOrSlug: organization.slug}}
  );

  return mutationOptions({
    mutationFn: (data: SeerBulkEditVariables) => {
      const {stoppingPoint, agentOption, query, selectedIds, ...rest} = data;

      const agentObj = agentOption
        ? parseAgentOption(agentOption ?? 'seer', knownAgents)
        : {};

      const isOff = stoppingPoint === 'off';
      const tuning =
        stoppingPoint === undefined
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
          ...(!isOff && stoppingPoint !== undefined && {stoppingPoint}),
          ...agentObj,
          ...(tuning !== undefined && {automationTuning: tuning}),
        } satisfies SeerBulkProjectSettingUpdatePayload,
      });
    },
    onMutate: async data => {
      await queryClient.cancelQueries(allSeerProjectsSettingsFilter(organization));
      await queryClient.cancelQueries(singleProjectSettingsFilter);

      const jsonUpdates: Partial<SeerProjectSettingResponse> = {};
      if (data.agentOption !== undefined) {
        const {agent, integrationId} = parseAgentOption(data.agentOption, knownAgents);
        jsonUpdates.agent = agent;
        jsonUpdates.integrationId = integrationId;
      }
      if (data.stoppingPoint !== undefined) {
        if (data.stoppingPoint === 'off') {
          jsonUpdates.automationTuning = 'off';
        } else {
          jsonUpdates.stoppingPoint = data.stoppingPoint;
          jsonUpdates.automationTuning = 'medium';
        }
      }
      if (data.prIteration !== undefined) {
        jsonUpdates.prIteration = data.prIteration;
      }
      if (data.openPrs !== undefined) {
        jsonUpdates.openPrs = data.openPrs;
      }

      const shouldUpdate = (item: SeerProjectSettingResponse) =>
        data.selectedIds === 'all' || data.selectedIds.includes(item.projectId);

      queryClient.setQueriesData(
        allSeerProjectsSettingsFilter(organization),
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
          singleProjectSettingsFilter,
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
      queryClient.invalidateQueries(allSeerProjectsSettingsFilter(organization));
      queryClient.invalidateQueries(singleProjectSettingsFilter);
    },
    onSettled: () => {
      queryClient.invalidateQueries(allSeerProjectsSettingsFilter(organization));
      queryClient.invalidateQueries(singleProjectSettingsFilter);
    },
  });
}
