import * as Sentry from '@sentry/react';

import type {RequestCallbacks, RequestOptions} from 'sentry/api';
import {Client} from 'sentry/api';
import GroupStore from 'sentry/stores/groupStore';
import type {Actor} from 'sentry/types/core';
import type {Group, Note, Tag as GroupTag, TagValue} from 'sentry/types/group';
import type {Member} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {buildTeamId, buildUserId} from 'sentry/utils';
import {uniqueId} from 'sentry/utils/guid';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';

type AssignedBy = 'suggested_assignee' | 'assignee_selector';
type AssignToUserParams = {
  assignedBy: AssignedBy;
  /**
   * Issue id
   */
  id: string;
  orgSlug: string;
  user: User | Actor;
  member?: Member;
};

export function assignToUser(params: AssignToUserParams) {
  const api = new Client();

  const endpoint = `/organizations/${params.orgSlug}/issues/${params.id}/`;

  const id = uniqueId();

  GroupStore.onAssignTo(id, params.id, {
    email: params.member?.email ?? '',
  });

  const request = api.requestPromise(endpoint, {
    method: 'PUT',
    // Sending an empty value to assignedTo is the same as "clear",
    // so if no member exists, that implies that we want to clear the
    // current assignee.
    data: {
      assignedTo: params.user ? buildUserId(params.user.id) : '',
      assignedBy: params.assignedBy,
    },
  });

  request
    .then(data => {
      GroupStore.onAssignToSuccess(id, params.id, data);
    })
    .catch(data => {
      GroupStore.onAssignToError(id, params.id, data);
    });

  return request;
}

export function clearAssignment(
  groupId: string,
  orgSlug: string,
  assignedBy: AssignedBy
) {
  const api = new Client();

  const endpoint = `/organizations/${orgSlug}/issues/${groupId}/`;

  const id = uniqueId();

  GroupStore.onAssignTo(id, groupId, {
    email: '',
  });

  const request = api.requestPromise(endpoint, {
    method: 'PUT',
    // Sending an empty value to assignedTo is the same as "clear"
    data: {
      assignedTo: '',
      assignedBy,
    },
  });

  request
    .then(data => {
      GroupStore.onAssignToSuccess(id, groupId, data);
    })
    .catch(data => {
      GroupStore.onAssignToError(id, groupId, data);
    });

  return request;
}

type AssignToActorParams = {
  actor: Pick<Actor, 'id' | 'type'>;
  assignedBy: AssignedBy;
  /**
   * Issue id
   */
  id: string;
  orgSlug: string;
};

export function assignToActor({id, actor, assignedBy, orgSlug}: AssignToActorParams) {
  const api = new Client();

  const endpoint = `/organizations/${orgSlug}/issues/${id}/`;

  const guid = uniqueId();
  let actorId = '';

  GroupStore.onAssignTo(guid, id, {email: ''});

  switch (actor.type) {
    case 'user':
      actorId = buildUserId(actor.id);
      break;

    case 'team':
      actorId = buildTeamId(actor.id);
      break;

    default:
      Sentry.withScope(scope => {
        scope.setExtra('actor', actor);
        Sentry.captureException('Unknown assignee type');
      });
  }

  return api
    .requestPromise(endpoint, {
      method: 'PUT',
      data: {assignedTo: actorId, assignedBy},
    })
    .then(data => {
      GroupStore.onAssignToSuccess(guid, id, data);
    })
    .catch(data => {
      GroupStore.onAssignToSuccess(guid, id, data);
    });
}

export function deleteNote(
  api: Client,
  orgSlug: string,
  group: Group,
  id: string,
  _oldText: string
) {
  const restore = group.activity.find(activity => activity.id === id);
  const index = GroupStore.removeActivity(group.id, id);

  if (index === -1 || restore === undefined) {
    // I dunno, the id wasn't found in the GroupStore
    return Promise.reject(new Error('Group was not found in store'));
  }

  const promise = api.requestPromise(
    `/organizations/${orgSlug}/issues/${group.id}/comments/${id}/`,
    {
      method: 'DELETE',
    }
  );

  promise.catch(() => GroupStore.addActivity(group.id, restore, index));

  return promise;
}

export function createNote(api: Client, orgSlug: string, group: Group, note: Note) {
  const promise = api.requestPromise(
    `/organizations/${orgSlug}/issues/${group.id}/comments/`,
    {
      method: 'POST',
      data: note,
    }
  );

  promise.then(data => GroupStore.addActivity(group.id, data));

  return promise;
}

export function updateNote(
  api: Client,
  orgSlug: string,
  group: Group,
  note: Note,
  id: string,
  oldText: string
) {
  GroupStore.updateActivity(group.id, id, {text: note.text});

  const promise = api.requestPromise(
    `/organizations/${orgSlug}/issues/${group.id}/comments/${id}/`,
    {
      method: 'PUT',
      data: note,
    }
  );

  promise.catch(() => GroupStore.updateActivity(group.id, id, {text: oldText}));

  return promise;
}

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
      environment?: string | Array<string>;
      project?: Array<number | string>;
    }
  | {
      id: Array<number> | Array<string>;
      environment?: string | Array<string>;
      project?: Array<number | string>;
    }
  | {
      environment?: string | Array<string>;
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

  const query: QueryArgs = paramsToQueryArgs(params);
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

  const query: QueryArgs = paramsToQueryArgs(params);
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

  const query: QueryArgs = paramsToQueryArgs(params);
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
  orgSlug: string;
  tagKey: string;
  cursor?: string;
  environment?: string[];
  sort?: string | string[];
};

export const makeFetchIssueTagValuesQueryKey = ({
  orgSlug,
  groupId,
  tagKey,
  environment,
  sort,
  cursor,
}: FetchIssueTagValuesParameters): ApiQueryKey => [
  `/organizations/${orgSlug}/issues/${groupId}/tags/${tagKey}/values/`,
  {query: {environment, sort, cursor}},
];

export function useFetchIssueTagValues(
  parameters: FetchIssueTagValuesParameters,
  options: Partial<UseApiQueryOptions<TagValue[]>> = {}
) {
  return useApiQuery<TagValue[]>(makeFetchIssueTagValuesQueryKey(parameters), {
    staleTime: 0,
    retry: false,
    ...options,
  });
}

type FetchIssueTagParameters = {
  groupId: string;
  orgSlug: string;
  tagKey: string;
};

export const makeFetchIssueTagQueryKey = ({
  orgSlug,
  groupId,
  tagKey,
  environment,
  sort,
}: FetchIssueTagValuesParameters): ApiQueryKey => [
  `/organizations/${orgSlug}/issues/${groupId}/tags/${tagKey}/`,
  {query: {environment, sort}},
];

export function useFetchIssueTag(
  parameters: FetchIssueTagParameters,
  options: Partial<UseApiQueryOptions<GroupTag>> = {}
) {
  return useApiQuery<GroupTag>(makeFetchIssueTagQueryKey(parameters), {
    staleTime: 0,
    retry: false,
    ...options,
  });
}
