import {queryOptions} from '@tanstack/react-query';

import type {RequestCallbacks} from 'sentry/api';
import {Client} from 'sentry/api';
import {GroupStore} from 'sentry/stores/groupStore';
import type {PageFilterDatetime} from 'sentry/types/core';
import type {Group, Tag as GroupTag, TagValue} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getUtcDateString} from 'sentry/utils/dates';
import {uniqueId} from 'sentry/utils/guid';
import {parseActorString} from 'sentry/utils/parseActorString';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {QueryParamValue} from 'sentry/utils/useLocation';

type GroupQueryParams = Partial<PageFilterDatetime> & {
  environment?: string | string[] | null;
  itemIds?: string[];
  project?: number[] | string[] | null;
  query?: string;
  sort?: string;
};

type UpdateParams = GroupQueryParams & {
  orgId: string;
  projectId?: string;
};

/**
 * Converts input parameters to API-compatible query arguments
 */
export function paramsToQueryArgs(params: GroupQueryParams) {
  const project = params.project?.length ? params.project : undefined;

  if (params.itemIds) {
    return {id: params.itemIds, project};
  }

  return {
    // Preserve an empty query; omitting it defaults to unresolved issues.
    query: params.query,
    project,
    environment: params.environment ?? undefined,
    sort: params.sort,
    start: params.start ? getUtcDateString(params.start) : undefined,
    end: params.end ? getUtcDateString(params.end) : undefined,
    statsPeriod: params.period || undefined,
    utc: params.utc ?? undefined,
  };
}

function getUpdateUrl({projectId, orgId}: UpdateParams) {
  return projectId
    ? `/projects/${orgId}/${projectId}/issues/`
    : `/organizations/${orgId}/issues/`;
}

type BulkDeleteParams = UpdateParams;

export async function bulkDelete(
  api: Client,
  params: BulkDeleteParams,
  options: RequestCallbacks = {}
) {
  const {itemIds} = params;
  const path = getUpdateUrl(params);

  const query = paramsToQueryArgs(params);
  const id = uniqueId();

  GroupStore.onDelete(id, itemIds);

  let responseMeta: any;
  let statusText: string | undefined;

  try {
    const [data, status, meta] = await api.requestPromise(path, {
      query,
      method: 'DELETE',
      includeAllArgs: true,
    });
    statusText = status;
    responseMeta = meta;
    GroupStore.onDeleteSuccess(id, itemIds, data);
    options?.success?.(data, statusText, responseMeta);
  } catch (error) {
    GroupStore.onDeleteError(id, itemIds, error as RequestError);
    options?.error?.(error);
  } finally {
    options?.complete?.(responseMeta, statusText ?? '');
  }
}

type BulkUpdateParams = UpdateParams & {
  data?: any;
  failSilently?: boolean;
};

export async function bulkUpdate(
  api: Client,
  params: BulkUpdateParams,
  options: RequestCallbacks = {}
) {
  const {itemIds, failSilently, data} = params;
  const path = getUpdateUrl(params);

  const query = paramsToQueryArgs(params);
  const id = uniqueId();

  const optimisticData: Partial<Group> =
    typeof data.assignedTo === 'string'
      ? {...data, assignedTo: parseActorString(data.assignedTo) ?? null}
      : data;
  GroupStore.onUpdate(id, itemIds, optimisticData);

  let responseMeta: any;
  let statusText: string | undefined;

  try {
    const [response, status, meta] = await api.requestPromise(path, {
      query,
      method: 'PUT',
      data,
      includeAllArgs: true,
    });
    statusText = status;
    responseMeta = meta;
    GroupStore.onUpdateSuccess(id, itemIds, response);
    options?.success?.(response, statusText, responseMeta);
  } catch (error) {
    GroupStore.onUpdateError(id, itemIds, !!failSilently);
    options?.error?.(error);
  } finally {
    options?.complete?.(responseMeta, statusText ?? '');
  }
}

type MergeGroupsParams = UpdateParams;

export async function mergeGroups(
  api: Client,
  params: MergeGroupsParams,
  options: RequestCallbacks = {}
) {
  const {itemIds} = params;
  const path = getUpdateUrl(params);

  const query = paramsToQueryArgs(params);
  const id = uniqueId();

  GroupStore.onMerge(id, itemIds);

  let responseMeta: any;
  let statusText: string | undefined;

  try {
    const [response, status, meta] = await api.requestPromise(path, {
      query,
      method: 'PUT',
      data: {merge: 1},
      includeAllArgs: true,
    });
    statusText = status;
    responseMeta = meta;
    GroupStore.onMergeSuccess(id, itemIds, response);
    options?.success?.(response, statusText, responseMeta);
  } catch (error) {
    GroupStore.onMergeError(id, itemIds, error);
    options?.error?.(error);
  } finally {
    options?.complete?.(responseMeta, statusText ?? '');
  }
}

type FetchIssueTagValuesParameters = {
  groupId: string;
  organization: Organization;
  tagKey: string;
  cursor?: QueryParamValue;
  sort?: string | string[];
};

export function issueTagValuesApiOptions({
  organization,
  groupId,
  tagKey,
  sort,
  cursor,
}: FetchIssueTagValuesParameters) {
  return queryOptions({
    ...apiOptions.as<TagValue[]>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/tags/$key/values/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          issueId: groupId,
          key: tagKey,
        },
        query: {sort, cursor},
        staleTime: 0,
      }
    ),
    retry: false,
  });
}

type FetchIssueTagParameters = {
  groupId: string;
  organization: Organization;
  tagKey: string;
};

export function fetchIssueTagApiOptions<TData = GroupTag>(
  parameters: FetchIssueTagParameters
) {
  return queryOptions({
    ...apiOptions.as<TData>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/tags/$key/',
      {
        path: {
          organizationIdOrSlug: parameters.organization.slug,
          issueId: parameters.groupId,
          key: parameters.tagKey,
        },
        staleTime: 0,
      }
    ),
    retry: false,
  });
}
