import {useMemo, useReducer} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';

export interface Fingerprint {
  id: string;
  latestEvent: Event | null;
  mergedBySeer?: boolean;
}

export interface FingerprintWithLatestEvent extends Fingerprint {
  latestEvent: Event;
}

const MERGED_HASH_LIMIT = 20;

// The merged hashes list lives in a drawer over the issue details page, so it
// can't use the generic `cursor` param without clobbering the page's own
// pagination. Scope it to this drawer instead.
export const MERGED_CURSOR_QUERY_KEY = 'mergedCursor';

// Reading returns the current cursor (or null); setting null removes the param,
// which is how we clean it up when the drawer closes.
export function useMergedCursor() {
  return useQueryState(MERGED_CURSOR_QUERY_KEY, parseAsString);
}

interface FingerprintState {
  busy?: boolean;
  checked?: boolean;
  collapsed?: boolean;
}

export interface GroupMergedState {
  fingerprintState: ReadonlyMap<string, Readonly<FingerprintState>>;
  unmergeLastCollapsed: boolean;
  unmergeList: ReadonlyMap<string, string>;
}

type GroupMergedAction =
  | {eventId: string; fingerprintId: string; type: 'toggleSelected'}
  | {fingerprintId: string; type: 'toggleCollapsed'}
  | {fingerprintIds: string[]; type: 'toggleAllCollapsed'}
  | {fingerprintIds: string[]; type: 'unmergePending'}
  | {fingerprintIds: string[]; type: 'unmergeSuccess'}
  | {fingerprintIds: string[]; type: 'unmergeError'};

interface UnmergeMessages {
  errorMessage?: string;
  loadingMessage?: string;
  successMessage?: string;
}

export function createInitialGroupMergedState(): GroupMergedState {
  return {
    fingerprintState: new Map(),
    unmergeLastCollapsed: true,
    unmergeList: new Map(),
  };
}

function hasLatestEvent(
  fingerprint: Fingerprint
): fingerprint is FingerprintWithLatestEvent {
  return Boolean(fingerprint.latestEvent);
}

function setFingerprintState(
  currentState: GroupMergedState['fingerprintState'],
  fingerprintIds: string[],
  newState: FingerprintState
) {
  const nextState = new Map(currentState);

  fingerprintIds.forEach(id => {
    const state = nextState.get(id) ?? {};
    nextState.set(id, {...state, ...newState});
  });

  return nextState;
}

export function isAllUnmergedSelected(
  state: Pick<GroupMergedState, 'fingerprintState' | 'unmergeList'>,
  fingerprints: Fingerprint[]
) {
  const busyItems = Array.from(state.fingerprintState.values()).filter(({busy}) => busy);

  return (
    state.unmergeList.size ===
    fingerprints.filter(hasLatestEvent).length - busyItems.length
  );
}

export function groupMergedReducer(
  state: GroupMergedState,
  action: GroupMergedAction
): GroupMergedState {
  switch (action.type) {
    case 'toggleSelected': {
      const rowState = state.fingerprintState.get(action.fingerprintId);

      if (rowState?.busy === true) {
        return state;
      }

      const unmergeList = new Map(state.unmergeList);
      const checked = !unmergeList.has(action.fingerprintId);

      if (checked) {
        unmergeList.set(action.fingerprintId, action.eventId);
      } else {
        unmergeList.delete(action.fingerprintId);
      }

      return {
        ...state,
        fingerprintState: setFingerprintState(
          state.fingerprintState,
          [action.fingerprintId],
          {checked}
        ),
        unmergeList,
      };
    }
    case 'toggleCollapsed': {
      const collapsed =
        state.fingerprintState.get(action.fingerprintId)?.collapsed ??
        state.unmergeLastCollapsed;

      return {
        ...state,
        fingerprintState: setFingerprintState(
          state.fingerprintState,
          [action.fingerprintId],
          {collapsed: !collapsed}
        ),
      };
    }
    case 'toggleAllCollapsed': {
      return {
        ...state,
        fingerprintState: setFingerprintState(
          state.fingerprintState,
          action.fingerprintIds,
          {
            collapsed: !state.unmergeLastCollapsed,
          }
        ),
        unmergeLastCollapsed: !state.unmergeLastCollapsed,
      };
    }
    case 'unmergePending': {
      return {
        ...state,
        fingerprintState: setFingerprintState(
          state.fingerprintState,
          action.fingerprintIds,
          {checked: false, busy: true}
        ),
      };
    }
    case 'unmergeSuccess': {
      const unmergeList = new Map(state.unmergeList);
      action.fingerprintIds.forEach(id => unmergeList.delete(id));

      return {
        ...state,
        fingerprintState: setFingerprintState(
          state.fingerprintState,
          action.fingerprintIds,
          // Keep busy until the query refetches and the component remounts
          {checked: false, busy: true}
        ),
        unmergeList,
      };
    }
    case 'unmergeError': {
      return {
        ...state,
        fingerprintState: setFingerprintState(
          state.fingerprintState,
          action.fingerprintIds,
          {checked: true, busy: false}
        ),
      };
    }
    default:
      return state;
  }
}

function getErrorMessage(error: RequestError, fallback?: string) {
  const detail = error.responseJSON?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (typeof detail?.message === 'string') {
    return detail.message;
  }

  return fallback;
}

export function useGroupMergedHashes({
  groupId,
  organization,
}: {
  groupId: Group['id'];
  organization: Organization;
}) {
  const [cursor] = useMergedCursor();
  const {
    data,
    dataUpdatedAt,
    isError,
    isPending: isLoading,
    refetch,
  } = useQuery({
    ...apiOptions.as<Fingerprint[]>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/hashes/',
      {
        path: {organizationIdOrSlug: organization.slug, issueId: groupId},
        query: {
          cursor: cursor ?? undefined,
          full: '0',
          per_page: MERGED_HASH_LIMIT,
        },
        staleTime: 30_000,
      }
    ),
    retry: false,
    select: selectJsonWithHeaders,
  });

  return {
    dataUpdatedAt,
    error: isError,
    fingerprints: data?.json ?? [],
    loading: isLoading,
    pageLinks: data?.headers.Link,
    refetch,
  };
}

export function useGroupMergedState({
  fingerprints,
  groupId,
  organization,
}: {
  fingerprints: Fingerprint[];
  groupId: Group['id'];
  organization: Organization;
}) {
  const [state, dispatch] = useReducer(
    groupMergedReducer,
    undefined,
    createInitialGroupMergedState
  );
  const {isPending: isUnmerging, mutate: unmergeFingerprints} = useMutation<
    unknown,
    RequestError,
    {fingerprintIds: string[]}
  >({
    mutationFn: ({fingerprintIds}) =>
      fetchMutation({
        method: 'PUT',
        url: getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/hashes/', {
          path: {organizationIdOrSlug: organization.slug, issueId: groupId},
        }),
        options: {query: {id: fingerprintIds}},
      }),
  });

  const fingerprintsWithLatestEvent = useMemo(
    () => fingerprints.filter(hasLatestEvent),
    [fingerprints]
  );
  const selectedEventIds = useMemo(
    () => Array.from(state.unmergeList.values()),
    [state.unmergeList]
  );
  const allUnmergedSelected = isAllUnmergedSelected(state, fingerprints);
  const unmergeDisabled =
    isUnmerging ||
    fingerprintsWithLatestEvent.length <= 1 ||
    state.unmergeList.size === 0 ||
    allUnmergedSelected;
  const enableFingerprintCompare = state.unmergeList.size === 2;

  return {
    enableFingerprintCompare,
    fingerprintsWithLatestEvent,
    selectedEventIds,
    state,
    toggleAllCollapsed: () => {
      dispatch({
        type: 'toggleAllCollapsed',
        fingerprintIds: fingerprints.map(({id}) => id),
      });
    },
    toggleCollapsed: (fingerprintId: string) => {
      dispatch({type: 'toggleCollapsed', fingerprintId});
    },
    toggleSelected: (fingerprintId: string, eventId: string) => {
      dispatch({type: 'toggleSelected', fingerprintId, eventId});
    },
    unmerge: ({loadingMessage, successMessage, errorMessage}: UnmergeMessages) => {
      const fingerprintIds = Array.from(state.unmergeList.keys());

      if (isAllUnmergedSelected(state, fingerprints)) {
        return;
      }

      dispatch({type: 'unmergePending', fingerprintIds});
      addLoadingMessage(loadingMessage);

      unmergeFingerprints(
        {fingerprintIds},
        {
          onSuccess: () => {
            addSuccessMessage(successMessage);
            dispatch({type: 'unmergeSuccess', fingerprintIds});
          },
          onError: requestError => {
            addErrorMessage(getErrorMessage(requestError, errorMessage));
            dispatch({type: 'unmergeError', fingerprintIds});
          },
        }
      );
    },
    unmergeDisabled,
  };
}
