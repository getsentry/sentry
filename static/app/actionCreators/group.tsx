import {queryOptions} from '@tanstack/react-query';

import type {RequestCallbacks, RequestOptions} from 'sentry/api';
import {Client} from 'sentry/api';
import {GroupStore} from 'sentry/stores/groupStore';
import type {Tag as GroupTag, TagValue} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {uniqueId} from 'sentry/utils/guid';
import type {QueryParamValue} from 'sentry/utils/useLocation';

type ParamsType = {
  environment?: string | string[] | null;
  itemIds?: string[];
  project?: number[] | string[] | null;
  query?: string;
};

type UpdateParams = ParamsType & {
  orgId: string;
  projectId?: string;
};

type QueryArgs =
  | {
      query: string;
      environment?: string | string[];
      project?: Array<number | string>;
    }
  | {
      id: number[] | string[];
      environment?: string | string[];
      project?: Array<number | string>;
    }
  | {
      environment?: string | string[];
      project?: Array<number | string>;
    };

/**
 * Converts input parameters to API-compatible query arguments
 */
export function paramsToQueryArgs(params: ParamsType): QueryArgs {
  const p: QueryArgs = params.itemIds
    ? {id: params.itemIds} // items matching array of itemids
    : params.query
      ? {query: params.query} // items matching search query
      : {}; // all items

  // only include environment if it is not null/undefined
  if (params.query && params.environment !== null && params.environment !== undefined) {
    p.environment = params.environment;
  }

  // only include projects if it is not null/undefined/an empty array
  if (params.project?.length) {
    p.project = params.project;
  }

  // only include date filters if they are not null/undefined
  if (params.query) {
    ['start', 'end', 'period', 'utc'].forEach(prop => {
      if (
        params[prop as keyof typeof params] !== null &&
        params[prop as keyof typeof params] !== undefined
      ) {
        (p as any)[prop === 'period' ? 'statsPeriod' : prop] =
          params[prop as keyof typeof params];
      }
    });
  }
  return p;
}

function getUpdateUrl({projectId, orgId}: UpdateParams) {
  return projectId
    ? `/projects/${orgId}/${projectId}/issues/`
    : `/organizations/${orgId}/issues/`;
}

function chainUtil<Args extends any[]>(
  ...funcs: Array<((...args: Args) => any) | undefined>
) {
  const filteredFuncs = funcs.filter(
    (f): f is (...args: Args) => any => typeof f === 'function'
  );
  return (...args: Args): void => {
    filteredFuncs.forEach(func => {
      func.apply(funcs, args);
    });
  };
}

function wrapRequest(
  api: Client,
  path: string,
  options: RequestOptions,
  extraParams: RequestCallbacks = {}
) {
  options.success = chainUtil(options.success, extraParams.success);
  options.error = chainUtil(options.error, extraParams.error);
  options.complete = chainUtil(options.complete, extraParams.complete);

  return api.request(path, options);
}

type BulkDeleteParams = UpdateParams;

export function bulkDelete(
  api: Client,
  params: BulkDeleteParams,
  options: RequestCallbacks
) {
  const {itemIds} = params;
  const path = getUpdateUrl(params);

  const query = paramsToQueryArgs(params);
  const id = uniqueId();

  GroupStore.onDelete(id, itemIds);

  return wrapRequest(
    api,
    path,
    {
      query,
      method: 'DELETE',
      success: response => {
        GroupStore.onDeleteSuccess(id, itemIds, response);
      },
      error: error => {
        GroupStore.onDeleteError(id, itemIds, error);
      },
    },
    options
  );
}

type BulkUpdateParams = UpdateParams & {
  data?: any;
  failSilently?: boolean;
};

export function bulkUpdate(
  api: Client,
  params: BulkUpdateParams,
  options: RequestCallbacks
) {
  const {itemIds, failSilently, data} = params;
  const path = getUpdateUrl(params);

  const query = paramsToQueryArgs(params);
  const id = uniqueId();

  GroupStore.onUpdate(id, itemIds, data);

  return wrapRequest(
    api,
    path,
    {
      query,
      method: 'PUT',
      data,
      success: response => {
        GroupStore.onUpdateSuccess(id, itemIds, response);
      },
      error: () => {
        GroupStore.onUpdateError(id, itemIds, !!failSilently);
      },
    },
    options
  );
}

type MergeGroupsParams = UpdateParams;

export function mergeGroups(
  api: Client,
  params: MergeGroupsParams,
  options: RequestCallbacks
) {
  const {itemIds} = params;
  const path = getUpdateUrl(params);

  const query = paramsToQueryArgs(params);
  const id = uniqueId();

  GroupStore.onMerge(id, itemIds);

  return wrapRequest(
    api,
    path,
    {
      query,
      method: 'PUT',
      data: {merge: 1},
      success: response => {
        GroupStore.onMergeSuccess(id, itemIds, response);
      },
      error: error => {
        GroupStore.onMergeError(id, itemIds, error);
      },
    },
    options
  );
}

type FetchIssueTagValuesParameters = {
  groupId: string;
  organization: Organization;
  tagKey: string;
  cursor?: QueryParamValue;
  environment?: string[];
  sort?: string | string[];
};

export function issueTagValuesApiOptions({
  organization,
  groupId,
  tagKey,
  environment,
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
        query: {environment, sort, cursor},
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
