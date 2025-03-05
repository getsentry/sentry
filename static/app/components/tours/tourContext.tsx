import {type Dispatch, useCallback, useMemo, useRef} from 'react';
import {useReducer} from 'react';

export type TourEnumType = string | number;

export interface TourStep<T extends TourEnumType> {
  /**
   * Unique ID for the tour step.
   */
  id: T;
}

type TourStartAction<T extends TourEnumType> = {
  type: 'START_TOUR';
  stepId?: T;
};
type TourNextStepAction = {
  type: 'NEXT_STEP';
};
type TourPreviousStepAction = {
  type: 'PREVIOUS_STEP';
};
type TourSetStepAction<T extends TourEnumType> = {
  stepId: T;
  type: 'SET_STEP';
};
type TourEndAction = {
  type: 'END_TOUR';
};
type TourSetRegistrationAction = {
  isRegistered: boolean;
  type: 'SET_REGISTRATION';
};
type TourSetCompletionAction = {
  isCompleted: boolean;
  type: 'SET_COMPLETION';
};

export type TourAction<T extends TourEnumType> =
  | TourStartAction<T>
  | TourNextStepAction
  | TourPreviousStepAction
  | TourSetStepAction<T>
  | TourEndAction
  | TourSetRegistrationAction
  | TourSetCompletionAction;

export interface TourState<T extends TourEnumType> {
  /**
   * The current active tour step. If this is null, the tour is not active.
   */
  currentStepId: TourStep<T>['id'] | null;
  /**
   * Whether the tour is available to the user. Should be set by flags or other conditions.
   */
  isAvailable: boolean;
  /**
   * Whether the tour has been completed.
   */
  isCompleted: boolean;
  /**
   * Whether every step of the tour has been registered in the DOM.
   */
  isRegistered: boolean;
  /**
   * The ordered step IDs. Declared once when the provider is initialized.
   */
  orderedStepIds: readonly T[];
}

// XXX: TourSteps are currently just IDs, so we could use a set here instead, but we're using a
// dictionary in case we ever want to add more data to the steps.
type TourRegistry<T extends TourEnumType> = {
  [key in T]: TourStep<T> | null;
};

function tourReducer<T extends TourEnumType>(
  state: TourState<T>,
  action: TourAction<T>
): TourState<T> {
  const completeTourState = {...state, currentStepId: null, isCompleted: true};
  switch (action.type) {
    case 'START_TOUR': {
      // If the tour is not available, or not all steps are registered, do nothing
      if (!state.isAvailable || !state.isRegistered) {
        return state;
      }
      // If the stepId is provided, set the current step to the stepId
      const startStepIndex = action.stepId
        ? state.orderedStepIds.indexOf(action.stepId)
        : -1;
      if (action.stepId && startStepIndex !== -1) {
        return {
          ...state,
          isCompleted: false,
          currentStepId: action.stepId ?? null,
        };
      }
      // If no stepId is provided, set the current step to the first step
      if (state.orderedStepIds[0]) {
        return {
          ...state,
          isCompleted: false,
          currentStepId: state.orderedStepIds[0] ?? null,
        };
      }
      return state;
    }
    case 'NEXT_STEP': {
      if (!state.currentStepId) {
        return state;
      }
      const nextStepIndex = state.orderedStepIds.indexOf(state.currentStepId) + 1;
      const nextStepId = state.orderedStepIds[nextStepIndex] ?? null;
      if (nextStepId) {
        return {
          ...state,
          currentStepId: nextStepId,
        };
      }
      // If there is no next step, complete the tour
      return completeTourState;
    }
    case 'PREVIOUS_STEP': {
      if (!state.currentStepId) {
        return state;
      }
      const prevStepIndex = state.orderedStepIds.indexOf(state.currentStepId) - 1;
      const prevStepId = state.orderedStepIds[prevStepIndex] ?? null;
      if (prevStepId) {
        return {
          ...state,
          currentStepId: prevStepId,
        };
      }
      // If there is no previous step, do nothing
      return state;
    }
    case 'SET_STEP':
      return {
        ...state,
        currentStepId: action.stepId,
      };
    case 'END_TOUR':
      return completeTourState;
    case 'SET_COMPLETION':
      return {...state, isCompleted: action.isCompleted};
    case 'SET_REGISTRATION':
      return {...state, isRegistered: action.isRegistered};
    default:
      return state;
  }
}

export function useTourReducer<T extends TourEnumType>(
  initialState: TourState<T>
): TourContextType<T> {
  const {orderedStepIds} = initialState;

  const [state, dispatch] = useReducer(tourReducer<T>, initialState);
  const registry = useRef<TourRegistry<T>>({} as TourRegistry<T>);

  const handleStepRegistration = useCallback(
    (step: TourStep<T>) => {
      registry.current[step.id] = step;
      const isCompletelyRegistered = orderedStepIds.every(stepId =>
        Boolean(registry.current[stepId])
      );
      if (isCompletelyRegistered) {
        dispatch({type: 'SET_REGISTRATION', isRegistered: true});
      }
      return () => {
        delete registry.current[step.id];
        dispatch({type: 'SET_REGISTRATION', isRegistered: false});
      };
    },
    [orderedStepIds]
  );

  return useMemo<TourContextType<T>>(
    () => ({
      dispatch,
      handleStepRegistration,
      currentStepId: state.currentStepId,
      isAvailable: state.isAvailable,
      isRegistered: state.isRegistered,
      isCompleted: state.isCompleted,
      orderedStepIds: state.orderedStepIds,
    }),
    [
      dispatch,
      handleStepRegistration,
      state.currentStepId,
      state.isAvailable,
      state.isRegistered,
      state.isCompleted,
      state.orderedStepIds,
    ]
  );
}

export interface TourContextType<T extends TourEnumType> extends TourState<T> {
  dispatch: Dispatch<TourAction<T>>;
  /**
   * Callback to handle step registration. Should be used within a useEffect hook to sync the step
   * registration with the component's mounting/unmounting.
   */
  handleStepRegistration: (step: TourStep<T>) => () => void;
}
