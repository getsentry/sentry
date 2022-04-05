import {Committer} from 'sentry/types';

function exhaustive(x?: never) {
  throw new Error(
    `Unhandled ${JSON.stringify(x)} switch case action in committersReducer`
  );
}

export function makeCommitterStoreKey({
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
  type: 'add committers';
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

export function committersReducer(
  state: CommittersState,
  action: CommittersAction
): CommittersState {
  switch (action.type) {
    case 'add committers': {
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
          committersError: false,
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
          committersError: false,
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
