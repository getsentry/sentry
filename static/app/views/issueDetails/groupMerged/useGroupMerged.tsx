import {createContext, useContext, useMemo, useReducer, type ReactNode} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';
import type {Location} from 'history';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';

interface ApiFingerprint {
  id: string;
  latestEvent: Event | null;
  mergedBySeer?: boolean;
}

export interface Fingerprint {
  id: string;
  latestEvent: Event | null;
  mergedBySeer?: boolean;
}

export interface FingerprintWithLatestEvent extends Fingerprint {
  latestEvent: Event;
}

interface FingerprintState {
  busy?: boolean;
  checked?: boolean;
  collapsed?: boolean;
}

interface GroupMergedState {
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

interface GroupMergedContextValue {
  enableFingerprintCompare: boolean;
  error: boolean;
  fingerprints: Fingerprint[];
  fingerprintsWithLatestEvent: FingerprintWithLatestEvent[];
  loading: boolean;
  refetch: () => void;
  selectedEventIds: string[];
  state: GroupMergedState;
  toggleAllCollapsed: () => void;
  toggleCollapsed: (fingerprintId: string) => void;
  toggleSelected: (fingerprintId: string, eventId: string) => void;
  unmerge: (messages: UnmergeMessages) => void;
  unmergeDisabled: boolean;
  pageLinks?: string;
}

interface ProviderProps {
  children: ReactNode;
  groupId: Group['id'];
  location: Location;
  organization: Organization;
}

interface GroupMergedStateProviderProps {
  children: ReactNode;
  error: boolean;
  fingerprints: Fingerprint[];
  groupId: Group['id'];
  loading: boolean;
  organization: Organization;
  refetch: () => void;
  pageLinks?: string;
}

const GroupMergedContext = createContext<GroupMergedContextValue | null>(null);

export function processMergedFingerprints(items: ApiFingerprint[]): Fingerprint[] {
  return items;
}

export function createInitialGroupMergedState(
  _fingerprints: Fingerprint[]
): GroupMergedState {
  return {
    fingerprintState: new Map(),
    unmergeLastCollapsed: false,
    unmergeList: new Map(),
  };
}

export function hasLatestEvent(
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
  const lockedItems = Array.from(state.fingerprintState.values()).filter(
    ({busy}) => busy
  );

  return (
    state.unmergeList.size ===
    fingerprints.filter(({latestEvent}) => !!latestEvent).length - lockedItems.length
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
      const collapsed = state.fingerprintState.get(action.fingerprintId)?.collapsed;

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

export function GroupMergedProvider({
  children,
  groupId,
  location,
  organization,
}: ProviderProps) {
  const {
    data,
    dataUpdatedAt,
    isError,
    isPending: isLoading,
    refetch,
  } = useQuery({
    ...apiOptions.as<ApiFingerprint[]>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/hashes/',
      {
        path: {organizationIdOrSlug: organization.slug, issueId: groupId},
        query: {...location.query, limit: 50, query: location.query.query ?? ''},
        staleTime: 30_000,
      }
    ),
    retry: false,
    select: selectJsonWithHeaders,
  });

  const fingerprints = useMemo(
    () => processMergedFingerprints(data?.json ?? []),
    [data?.json]
  );

  return (
    <GroupMergedStateProvider
      key={`${groupId}:${dataUpdatedAt}`}
      error={isError}
      fingerprints={fingerprints}
      groupId={groupId}
      loading={isLoading}
      organization={organization}
      pageLinks={data?.headers.Link}
      refetch={refetch}
    >
      {children}
    </GroupMergedStateProvider>
  );
}

function GroupMergedStateProvider({
  children,
  error,
  fingerprints,
  groupId,
  loading,
  organization,
  pageLinks,
  refetch,
}: GroupMergedStateProviderProps) {
  const [state, dispatch] = useReducer(
    groupMergedReducer,
    fingerprints,
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
        url: `/organizations/${organization.slug}/issues/${groupId}/hashes/`,
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

  const value = useMemo<GroupMergedContextValue>(
    () => ({
      enableFingerprintCompare,
      error,
      fingerprints,
      fingerprintsWithLatestEvent,
      loading,
      pageLinks,
      refetch: () => {
        refetch();
      },
      selectedEventIds,
      state,
      toggleAllCollapsed: () => {
        dispatch({
          type: 'toggleAllCollapsed',
          fingerprintIds: fingerprints.map(({id}) => id),
        });
      },
      toggleCollapsed: fingerprintId => {
        dispatch({type: 'toggleCollapsed', fingerprintId});
      },
      toggleSelected: (fingerprintId, eventId) => {
        dispatch({type: 'toggleSelected', fingerprintId, eventId});
      },
      unmerge: ({loadingMessage, successMessage, errorMessage}) => {
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
    }),
    [
      enableFingerprintCompare,
      error,
      fingerprints,
      fingerprintsWithLatestEvent,
      loading,
      pageLinks,
      refetch,
      selectedEventIds,
      state,
      unmergeDisabled,
      unmergeFingerprints,
    ]
  );

  return (
    <GroupMergedContext.Provider value={value}>{children}</GroupMergedContext.Provider>
  );
}

export function useGroupMerged() {
  const context = useContext(GroupMergedContext);

  if (!context) {
    throw new Error('useGroupMerged must be used within GroupMergedProvider');
  }

  return context;
}
