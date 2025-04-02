import {createContext, useCallback, useContext, useEffect} from 'react';

import {TourElement} from 'sentry/components/tours/components';
import {type TourContextType, useTourReducer} from 'sentry/components/tours/tourContext';

// Define the tour categories
export const enum DemoTourCategory {
  SOURCEMAPS = 'SOURCEMAPS',
  RELEASES = 'RELEASES',
}

// Define the step types for each category
export const enum DemoTourStep {
  // Sourcemaps steps
  NAME = 'demo-sourcemaps-tour-name',
  EMAIL = 'demo-sourcemaps-tour-email',
  PASSWORD = 'demo-sourcemaps-tour-password',
  // Releases steps
  TABLE = 'demo-releases-tour-table',
  DETAILS = 'demo-releases-tour-details',
}

// Type-safe mapping of categories to their steps
export const DEMO_TOURS: Record<DemoTourCategory, Record<string, DemoTourStep>> = {
  [DemoTourCategory.SOURCEMAPS]: {
    NAME: DemoTourStep.NAME,
    EMAIL: DemoTourStep.EMAIL,
    PASSWORD: DemoTourStep.PASSWORD,
  },
  [DemoTourCategory.RELEASES]: {
    TABLE: DemoTourStep.TABLE,
    DETAILS: DemoTourStep.DETAILS,
  },
} as const;

export const DEMO_SOURCEMAPS_TOUR_STEPS = [
  DemoTourStep.NAME,
  DemoTourStep.EMAIL,
  DemoTourStep.PASSWORD,
] as const;

export const DemoSourcemapsTourContext =
  createContext<TourContextType<DemoTourStep> | null>(null);

export function useDemoSourcemapsTour(): TourContextType<DemoTourStep> {
  const tourContext = useContext(DemoSourcemapsTourContext);

  if (!tourContext) {
    throw new Error('Must be used within a TourContextProvider');
  }
  return tourContext;
}

export const DEMO_SOURCEMAPS_TOUR_KEY = 'tour.demo_sourcemaps';

export function DemoSourcemapsTourProvider({children}: {children: React.ReactNode}) {
  // Load initial state from localStorage
  const loadInitialState = () => {
    const savedState = localStorage.getItem(DEMO_SOURCEMAPS_TOUR_KEY);
    if (savedState) {
      const parsed = JSON.parse(savedState);
      return {
        currentStepId: parsed.currentStepId,
        isCompleted: parsed.isCompleted,
        orderedStepIds: DEMO_SOURCEMAPS_TOUR_STEPS,
        tourKey: DEMO_SOURCEMAPS_TOUR_KEY,
        isRegistered: parsed.isRegistered,
      };
    }
    return {
      currentStepId: undefined,
      isCompleted: false,
      orderedStepIds: DEMO_SOURCEMAPS_TOUR_STEPS,
      tourKey: DEMO_SOURCEMAPS_TOUR_KEY,
      isRegistered: true,
    };
  };

  const updateState = useCallback(
    (state: {isCompleted: boolean; currentStepId?: DemoTourStep | null}) => {
      localStorage.setItem(DEMO_SOURCEMAPS_TOUR_KEY, JSON.stringify(state));
    },
    []
  );

  const handleStartTour = useCallback(
    (stepId?: DemoTourStep) => {
      updateState({
        currentStepId: stepId,
        isCompleted: false,
      });
    },
    [updateState]
  );

  const handleEndTour = useCallback(() => {
    updateState({
      currentStepId: undefined,
      isCompleted: true,
    });
  }, [updateState]);

  const handleStepChange = useCallback(
    (stepId: DemoTourStep) => {
      updateState({
        currentStepId: stepId,
        isCompleted: false,
      });
    },
    [updateState]
  );

  const tourContext = useTourReducer<DemoTourStep>(loadInitialState(), {
    onStartTour: handleStartTour,
    onEndTour: handleEndTour,
    onStepChange: handleStepChange,
    requireAllStepsRegistered: false,
  });

  // Save state changes to localStorage
  useEffect(() => {
    updateState({
      currentStepId: tourContext.currentStepId,
      isCompleted: tourContext.isCompleted,
    });
  }, [tourContext.currentStepId, tourContext.isCompleted, updateState]);

  return (
    <DemoSourcemapsTourContext value={tourContext}>{children}</DemoSourcemapsTourContext>
  );
}

interface UseContinueTourOptions {
  /**
   * The step ID that this component represents
   */
  stepId: DemoTourStep;
  /**
   * The tour context to use
   */
  tour: TourContextType<DemoTourStep>;
  /**
   * Whether the component is loading
   */
  isLoadingComplete?: boolean;
}

/**
 * Hook for components to register themselves as available tour steps
 */
export function useContinueTour({
  tour,
  stepId,
  isLoadingComplete,
}: UseContinueTourOptions) {
  useEffect(() => {
    if (tour.currentStepId === stepId && isLoadingComplete) {
      tour.setStep(stepId);
    }
  }, [tour, stepId, isLoadingComplete]);

  return {
    isActive: tour.currentStepId === stepId,
    onComplete: () => {
      tour.endTour();
    },
  };
}

export function DemoTourElement({
  id,
  title,
  description,
  children,
}: {
  children: React.ReactNode;
  description: string;
  id: string;
  title: string;
}) {
  return (
    <TourElement
      // @ts-expect-error fix this later
      tourContext={DemoSourcemapsTourContext}
      id={id}
      title={title}
      description={description}
    >
      {children}
    </TourElement>
  );
}
