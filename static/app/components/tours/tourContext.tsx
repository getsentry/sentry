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
type TourRegisterStepAction<T extends TourEnumType> = {
  step: TourStep<T>;
  type: 'REGISTER_STEP';
};

export type TourAction<T extends TourEnumType> =
  | TourStartAction<T>
  | TourNextStepAction
  | TourPreviousStepAction
  | TourEndAction
  | TourRegisterStepAction<T>;

export interface TourState<T extends TourEnumType> {
  /**
   * The current active tour step. If this is null, the tour is not active.
   */
  currentStep: TourStep<T> | null;
  /**
   * Whether the tour is available to the user. Should be set by flags or other conditions.
   */
  isAvailable: boolean;
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
  const registry = useRef<TourRegistry<T>>({} as TourRegistry<T>);
  const isCompletelyRegistered = Object.values(registry.current).every(Boolean);

  const reducer: Reducer<TourState<T>, TourAction<T>> = useCallback(
    (state, action) => {
      const completeTourState = {
        ...state,
        isActive: false,
        currentStep: null,
      };
      switch (action.type) {
        case 'REGISTER_STEP': {
          registry.current[action.step.id] = action.step;
          return state;
        }
        case 'START_TOUR': {
          // If the tour is not available, or not all steps are registered, do nothing
          if (!state.isAvailable || !isCompletelyRegistered) {
            return state;
          }

          // If the stepId is provided, set the current step to the stepId
          const startStepIndex = action.stepId
            ? orderedStepIds.indexOf(action.stepId)
            : -1;
          if (action.stepId && startStepIndex !== -1) {
            return {
              ...state,
              currentStep: registry.current[action.stepId] ?? null,
            };
          }
          // If no stepId is provided, set the current step to the first step
          if (orderedStepIds[0]) {
            return {
              ...state,
              currentStep: registry.current[orderedStepIds[0]] ?? null,
            };
          }

          return state;
        }
        case 'NEXT_STEP': {
          if (!state.currentStep) {
            return state;
          }
          const nextStepIndex = orderedStepIds.indexOf(state.currentStep.id) + 1;
          const nextStepId = orderedStepIds[nextStepIndex];
          if (nextStepId) {
            return {
              ...state,
              currentStep: registry.current[nextStepId] ?? null,
            };
          }
          // If there is no next step, complete the tour
          return completeTourState;
        }
        case 'PREVIOUS_STEP': {
          if (!state.currentStep) {
            return state;
          }
          const prevStepIndex = orderedStepIds.indexOf(state.currentStep.id) - 1;
          const prevStepId = orderedStepIds[prevStepIndex];
          if (prevStepId) {
            return {
              ...state,
              currentStep: registry.current[prevStepId] ?? null,
            };
          }
          // If there is no previous step, do nothing
          return state;
        }
        case 'END_TOUR':
          return completeTourState;
        default:
          return state;
      }
    },
    [orderedStepIds, isCompletelyRegistered]
  );

  const [tour, dispatch] = useReducer(reducer, initialState);
  return useMemo<TourContextType<T>>(
    () => ({
      dispatch,
      currentStep: tour.currentStep,
      isAvailable: tour.isAvailable,
      orderedStepIds: tour.orderedStepIds,
    }),
    [tour.currentStep, tour.isAvailable, tour.orderedStepIds, dispatch]
  );
}

export interface TourContextType<T extends TourEnumType> extends TourState<T> {
  dispatch: Dispatch<TourAction<T>>;
}
