import {useCallback, useMemo, useReducer, useRef} from 'react';

export type TourEnumType = string | number;

export interface TourStep<T extends TourEnumType> {
  /**
   * Unique ID for the tour step.
   */
  id: T;
}

type TourStartAction<T extends TourEnumType> = {
  stepId: T;
  type: 'START_TOUR';
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

type TourAction<T extends TourEnumType> =
  | TourStartAction<T>
  | TourNextStepAction
  | TourPreviousStepAction
  | TourSetStepAction<T>
  | TourEndAction
  | TourSetRegistrationAction;

export interface TourState<T extends TourEnumType> {
  /**
   * The current active tour step. If this is null, the tour is not active.
   */
  currentStepId: TourStep<T>['id'] | null;
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
  /**
   * The assistant guide key of the tour. Should be declared in `src/sentry/assistant/guides.py`.
   * Optional, only used if the tour viewing is saved to the database.
   */
  tourKey?: string;
}

// XXX: TourSteps are currently just IDs, so we could use a set here instead, but we're using a
// dictionary in case we ever want to add more data to the steps.
type TourRegistry<T extends TourEnumType> = Record<T, TourStep<T> | null>;

type TourOptions<T extends TourEnumType> = Partial<{
  onEndTour: () => void;
  onStartTour: (stepId?: T) => void;
  onStepChange: (stepId: T) => void;
  requireAllStepsRegistered: boolean;
}>;

function computeStartTourStep<T extends TourEnumType>(
  state: TourState<T>,
  stepId?: T
): T | null {
  if (stepId && state.orderedStepIds.includes(stepId)) {
    return stepId;
  }

  return state.orderedStepIds[0] ?? null;
}

function computeNextStep<T extends TourEnumType>(state: TourState<T>): T | null {
  if (!state.currentStepId) {
    return null;
  }
  const nextStepIndex = state.orderedStepIds.indexOf(state.currentStepId) + 1;
  const nextStepId = state.orderedStepIds[nextStepIndex] ?? null;
  if (nextStepId) {
    return nextStepId;
  }

  return null;
}

function computePreviousStep<T extends TourEnumType>(state: TourState<T>): T | null {
  if (!state.currentStepId) {
    return null;
  }
  const prevStepIndex = state.orderedStepIds.indexOf(state.currentStepId) - 1;
  const prevStepId = state.orderedStepIds[prevStepIndex] ?? null;
  if (prevStepId) {
    return prevStepId;
  }
  // If there is no previous step, do nothing
  return state.currentStepId;
}

function tourReducer<T extends TourEnumType>(
  state: TourState<T>,
  action: TourAction<T>
): TourState<T> {
  const completeTourState = {...state, currentStepId: null, isCompleted: true};

  switch (action.type) {
    case 'START_TOUR': {
      return {
        ...state,
        isCompleted: false,
        currentStepId: action.stepId,
      };
    }
    case 'NEXT_STEP': {
      if (!state.currentStepId) {
        return state;
      }

      const nextStepId = computeNextStep(state);

      if (nextStepId) {
        return {
          ...state,
          currentStepId: nextStepId,
        };
      }

      return completeTourState;
    }
    case 'PREVIOUS_STEP': {
      const prevStepId = computePreviousStep(state);

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
    case 'SET_REGISTRATION':
      return {...state, isRegistered: action.isRegistered};
    default:
      return state;
  }
}

export function useTourReducer<T extends TourEnumType>(
  initialState: TourState<T>,
  options?: TourOptions<T>
): TourContextType<T> {
  const {orderedStepIds} = initialState;

  const [state, dispatch] = useReducer(tourReducer<T>, initialState);
  const registry = useRef<TourRegistry<T>>({} as TourRegistry<T>);

  const handleStepRegistration = useCallback(
    (step: TourStep<T>) => {
      if (options?.requireAllStepsRegistered === false) {
        return () => {};
      }

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
    [orderedStepIds, options?.requireAllStepsRegistered]
  );

  const startTour = useCallback(
    (incomingStepId?: T) => {
      if (options?.requireAllStepsRegistered !== false && !state.isRegistered) {
        return;
      }

      const stepId = computeStartTourStep(state, incomingStepId);

      if (stepId) {
        dispatch({type: 'START_TOUR', stepId});
        options?.onStartTour?.(stepId);
        options?.onStepChange?.(stepId);
      }
    },
    [options, state]
  );

  const endTour = useCallback(() => {
    dispatch({type: 'END_TOUR'});
    options?.onEndTour?.();
  }, [options]);

  const nextStep = useCallback(() => {
    dispatch({type: 'NEXT_STEP'});
    const nextStepId = computeNextStep(state);
    if (nextStepId && nextStepId !== state.currentStepId) {
      options?.onStepChange?.(nextStepId);
    }
  }, [state, options]);

  const previousStep = useCallback(() => {
    dispatch({type: 'PREVIOUS_STEP'});
    const prevStepId = computePreviousStep(state);
    if (prevStepId && prevStepId !== state.currentStepId) {
      options?.onStepChange?.(prevStepId);
    }
  }, [state, options]);

  const setStep = useCallback(
    (stepId: T) => {
      dispatch({type: 'SET_STEP', stepId});
      if (stepId !== state.currentStepId) {
        options?.onStepChange?.(stepId);
      }
    },
    [state, options]
  );

  return useMemo<TourContextType<T>>(
    () => ({
      tourKey: initialState.tourKey,
      endTour,
      nextStep,
      previousStep,
      setStep,
      startTour,
      handleStepRegistration,
      currentStepId: state.currentStepId,
      isRegistered: state.isRegistered,
      isCompleted: state.isCompleted,
      orderedStepIds: state.orderedStepIds,
    }),
    [
      initialState.tourKey,
      endTour,
      nextStep,
      previousStep,
      setStep,
      startTour,
      handleStepRegistration,
      state.currentStepId,
      state.isRegistered,
      state.isCompleted,
      state.orderedStepIds,
    ]
  );
}

export interface TourContextType<T extends TourEnumType> extends TourState<T> {
  endTour: () => void;
  /**
   * Callback to handle step registration. Should be used within a useEffect hook to sync the step
   * registration with the component's mounting/unmounting.
   */
  handleStepRegistration: (step: TourStep<T>) => () => void;
  nextStep: () => void;
  previousStep: () => void;
  setStep: (stepId: T) => void;
  startTour: (stepId?: T) => void;
}
