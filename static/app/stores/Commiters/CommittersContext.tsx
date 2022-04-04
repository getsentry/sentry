import {createContext, useContext, useEffect, useReducer} from 'react';

import {Client} from 'sentry/api';
import {
  AvatarProject,
  Committer,
  Event,
  Group,
  Organization,
  Project,
} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';
import useApi from 'sentry/utils/useApi';

function exhaustive(x?: never) {
  throw new Error(
    `Unhandled ${JSON.stringify(x)} switch case action in CommittersReducer`
  );
}

function makeCommitterStoreKey({
  organizationSlug,
  projectSlug,
  eventId,
}: {
  eventId: string;
  organizationSlug: string;
  projectSlug: string;
}): string {
  return `${organizationSlug} ${projectSlug} ${eventId}`;
}

export function fetchCommitters(
  api: Client,
  params: {eventId: string; organizationSlug: string; projectSlug: string}
): Promise<{committers: Committer[]}> {
  return api.requestPromise(
    `/projects/${params.organizationSlug}/${params.projectSlug}/events/${params.eventId}/committers/`,
    {
      method: 'GET',
    }
  );
}

type ResetAction = {
  type: 'reset';
};

type SetCommittersError = {
  payload: {
    eventId: string;
    organizationSlug: string;
    projectSlug: string;
  };
  type: 'set error';
};

type StartLoadingCommitters = {
  payload: {
    eventId: string;
    organizationSlug: string;
    projectSlug: string;
  };
  type: 'start loading';
};

type AddCommitters = {
  payload: {
    committers: Committer[];
    eventId: string;
    organizationSlug: string;
    projectSlug: string;
  };
  type: 'add Committers';
};

export type CommittersState = Record<
  string,
  {
    committers: Committer[];
    committersError: boolean;
    committersLoading: boolean;
  }
>;

export type CommittersAction =
  | ResetAction
  | AddCommitters
  | StartLoadingCommitters
  | SetCommittersError;

function CommitterssReducer(state, action: CommittersAction): CommittersState {
  switch (action.type) {
    case 'add Committers': {
      const key = makeCommitterStoreKey({
        organizationSlug: action.payload.organizationSlug,
        projectSlug: action.payload.projectSlug,
        eventId: action.payload.eventId,
      });

      return {
        ...state,
        [key]: {
          committers: action.payload.committers,
          committersLoading: false,
          committersError: undefined,
        },
      };
    }

    case 'start loading': {
      const key = makeCommitterStoreKey({
        organizationSlug: action.payload.organizationSlug,
        projectSlug: action.payload.projectSlug,
        eventId: action.payload.eventId,
      });
      return {
        ...state,
        [key]: {
          committers: [],
          committersLoading: true,
          committersError: undefined,
        },
      };
    }
    case 'set error': {
      const key = makeCommitterStoreKey({
        organizationSlug: action.payload.organizationSlug,
        projectSlug: action.payload.projectSlug,
        eventId: action.payload.eventId,
      });

      return {
        ...state,
        [key]: {
          committers: [],
          committersLoading: false,
          committersError: true,
        },
      };
    }
    case 'reset': {
      return {};
    }
    default: {
      exhaustive(action);
      return state;
    }
  }
}

export const CommittersContext = createContext<
  [CommittersState, React.Dispatch<CommittersAction>] | null
>(null);

interface CommittersContextProviderProps {
  children: React.ReactNode;
  initialState?: CommittersState;
}

export function CommittersProvider(props: CommittersContextProviderProps) {
  const contextValue = useReducer(CommitterssReducer, props.initialState ?? {});

  return (
    <CommittersContext.Provider value={contextValue}>
      {props.children}
    </CommittersContext.Provider>
  );
}

export function useCommitterss(): [CommittersState, React.Dispatch<CommittersAction>] {
  const context = useContext(CommittersContext);

  if (!context) {
    throw new Error('useCommitters called outside of CommittersContext.Provider');
  }

  return context;
}

interface RequiredWithCommittersProps {
  event: Event;
  organization: Organization;
  project: Project | AvatarProject;
  group?: Group;
}

export interface WithCommittersProps {
  committers: Committer[] | undefined;
}

export function withCommitters<P extends WithCommittersProps>(
  Component: React.ComponentType<P>
) {
  const wrappedComponent: React.ComponentType<
    Omit<P, keyof WithCommittersProps> & RequiredWithCommittersProps
  > = (props): React.ReactElement => {
    const api = useApi();
    const [state, dispatch] = useCommitterss();

    useEffect(() => {
      if (!props.group?.firstRelease) {
        return undefined;
      }

      let unmounted = false;

      dispatch({
        type: 'start loading',
        payload: {
          eventId: props.event.id,
          organizationSlug: props.organization.slug,
          projectSlug: props.project.slug,
        },
      });

      fetchCommitters(api, {
        organizationSlug: props.organization.slug,
        projectSlug: props.project.slug,
        eventId: props.event.id,
      })
        .then(response => {
          if (unmounted) {
            return;
          }
          dispatch({
            type: 'add Committers',
            payload: {
              committers: response.committers,
              eventId: props.event.id,
              organizationSlug: props.organization.slug,
              projectSlug: props.project.slug,
            },
          });
        })
        .catch(() => {
          if (unmounted) {
            return;
          }
          dispatch({
            type: 'set error',
            payload: {
              eventId: props.event.id,
              organizationSlug: props.organization.slug,
              projectSlug: props.project.slug,
            },
          });
        });

      return () => {
        unmounted = true;
      };
    }, [props.group, props.organization.slug, props.project.slug, props.event.id]);

    const key = makeCommitterStoreKey({
      organizationSlug: props.organization.slug,
      projectSlug: props.project.slug,
      eventId: props.event.id,
    });

    const committers = state[key]?.committers ?? [];
    return <Component {...(props as unknown as P)} committers={committers} />;
  };

  wrappedComponent.displayName = `withCommitters(${getDisplayName(Component)})`;
  return wrappedComponent;
}
