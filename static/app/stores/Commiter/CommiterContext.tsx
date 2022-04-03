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
import useApi from 'sentry/utils/useApi';

function exhaustive(x?: never) {
  throw new Error(`Unhandled ${JSON.stringify(x)} switch case action in CommiterReducer`);
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

type AddCommitersAction = {
  payload: {
    committers: Committer[];
    eventId: string;
    organizationSlug: string;
    projectSlug: string;
  };
  type: 'add commiter';
};

type CommiterState = Record<
  string,
  {
    committers: Committer[];
    committersError: boolean;
    committersLoading: boolean;
  }
>;

type CommiterAction = ResetAction | AddCommitersAction;

function CommitersReducer(state, action: CommiterAction): CommiterState {
  switch (action.type) {
    case 'add commiter': {
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
    case 'reset': {
      return {};
    }
    default: {
      exhaustive(action);
      return state;
    }
  }
}

export const CommiterContext = createContext<
  [CommiterState, React.Dispatch<CommiterAction>] | null
>(null);

interface CommiterContextProviderProps {
  children: React.ReactNode;
  initialState?: CommiterState;
}

export function CommiterContextProvider(props: CommiterContextProviderProps) {
  const contextValue = useReducer(CommitersReducer, props.initialState ?? {});

  return (
    <CommiterContext.Provider value={contextValue}>
      {props.children}
    </CommiterContext.Provider>
  );
}

export function useCommiters() {
  const context = useContext(CommiterContext);

  if (!context) {
    throw new Error('useCommiter called outside of CommiterContext.Provider');
  }

  return context;
}

interface RequiredProps {
  event: Event;
  group: Group;
  organization: Organization;
  project: Project | AvatarProject;
}

export function withCommitters<P extends RequiredProps>(
  Component: React.ComponentType<P>
) {
  return (props: P): React.ReactElement => {
    const api = useApi();
    const [state, dispatch] = useCommiters();

    useEffect(() => {
      if (!props.group?.firstRelease) {
        return undefined;
      }

      let unmounted = false;

      fetchCommitters(api, {
        organizationSlug: props.organization.slug,
        projectSlug: props.project.slug,
        eventId: props.event.id,
      }).then(response => {
        if (unmounted) {
          return;
        }

        dispatch({
          type: 'add commiter',
          payload: {
            committers: response.committers,
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

    return (
      <Component
        {...props}
        committers={
          state[
            makeCommitterStoreKey({
              organizationSlug: props.organization.slug,
              projectSlug: props.project.slug,
              eventId: props.event.id,
            })
          ]
        }
      />
    );
  };
}
