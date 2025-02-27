import {type Dispatch, type Reducer, useCallback, useMemo, useRef} from 'react';
import {useReducer} from 'react';

export type TourEnumType = string | number;

export interface TourStep<T extends TourEnumType> {
  /**
   * The element to focus on when the tour step is active.
   * This is usually set within the TourElement component, which wraps the focused element.
   */
  element: HTMLElement | null;
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
type TourEndAction = {
  type: 'END_TOUR';
};
type TourCompleteRegistrationAction = {
  type: 'COMPLETE_REGISTRATION';
};

export type TourAction<T extends TourEnumType> =
  | TourStartAction<T>
  | TourNextStepAction
  | TourPreviousStepAction
  | TourEndAction
  | TourCompleteRegistrationAction;

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
   * Whether every step of the tour has been registered in the DOM.
   */
  isRegistered: boolean;
  /**
   * The ordered step IDs. Declared once when the provider is initialized.
   */
  orderedStepIds: readonly T[];
}

type TourRegistry<T extends TourEnumType> = {
  [key in T]: TourStep<T> | null;
};

export function useTourReducer<T extends TourEnumType>(
  initialState: TourState<T>
): TourContextType<T> {
  const {orderedStepIds} = initialState;

  const reducer: Reducer<TourState<T>, TourAction<T>> = useCallback(
    (state, action) => {
      const completeTourState = {...state, currentStepId: null};
      switch (action.type) {
        case 'START_TOUR': {
          // If the tour is not available, or not all steps are registered, do nothing
          if (!state.isAvailable || !state.isRegistered) {
            return state;
          }
          // If the stepId is provided, set the current step to the stepId
          const startStepIndex = action.stepId
            ? orderedStepIds.indexOf(action.stepId)
            : -1;
          if (action.stepId && startStepIndex !== -1) {
            return {
              ...state,
              currentStepId: action.stepId ?? null,
            };
          }
          // If no stepId is provided, set the current step to the first step
          if (orderedStepIds[0]) {
            return {
              ...state,
              currentStepId: orderedStepIds[0] ?? null,
            };
          }
          return state;
        }
        case 'NEXT_STEP': {
          if (!state.currentStepId) {
            return state;
          }
          const nextStepIndex = orderedStepIds.indexOf(state.currentStepId) + 1;
          const nextStepId = orderedStepIds[nextStepIndex] ?? null;
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
          const prevStepIndex = orderedStepIds.indexOf(state.currentStepId) - 1;
          const prevStepId = orderedStepIds[prevStepIndex] ?? null;
          if (prevStepId) {
            return {
              ...state,
              currentStepId: prevStepId,
            };
          }
          // If there is no previous step, do nothing
          return state;
        }
        case 'END_TOUR':
          return completeTourState;
        case 'COMPLETE_REGISTRATION':
          return {...state, isRegistered: true};
        default:
          return state;
      }
    },
    [orderedStepIds]
  );

  const [tour, dispatch] = useReducer(reducer, initialState);

  const registry = useRef<TourRegistry<T>>({} as TourRegistry<T>);

  const registerStep = useCallback(
    (step: TourStep<T>) => {
      registry.current[step.id] = step;
      const isCompletelyRegistered = orderedStepIds.every(stepId =>
        Boolean(registry.current[stepId])
      );
      if (isCompletelyRegistered) {
        dispatch({type: 'COMPLETE_REGISTRATION'});
      }
      return () => {
        delete registry.current[step.id];
      };
    },
    [orderedStepIds]
  );

  return useMemo<TourContextType<T>>(
    () => ({
      dispatch,
      registerStep,
      currentStepId: tour.currentStepId,
      isAvailable: tour.isAvailable,
      isRegistered: tour.isRegistered,
      orderedStepIds: tour.orderedStepIds,
    }),
    [
      dispatch,
      registerStep,
      tour.currentStepId,
      tour.isAvailable,
      tour.isRegistered,
      tour.orderedStepIds,
    ]
  );
}

export interface TourContextType<T extends TourEnumType> extends TourState<T> {
  dispatch: Dispatch<TourAction<T>>;
  registerStep: (step: TourStep<T>) => void;
}

// export function useTourRegistration<T extends TourEnumType>(step: TourStep<T>) {
//   const tourContext = useTourContext<T>();
//   const registerStep = tourContext.registerStep;
//   useEffect(() => {
//     registerStep(step);
//   }, [registerStep, step]);
// }
