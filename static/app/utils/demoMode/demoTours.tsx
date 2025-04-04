import {createContext, useCallback, useContext} from 'react';

import {TourElementContent} from 'sentry/components/tours/components';
import {
  type TourContextType,
  type TourState,
  useTourReducer,
} from 'sentry/components/tours/tourContext';

import {useLocalStorageState} from '../useLocalStorageState';

export const DEMO_TOURS_KEY = 'demo-mode-tours';

export const enum DemoTourCategory {
  SOURCEMAPS = 'sourcemaps',
  RELEASES = 'releases',
}

export const enum DemoTourStep {
  // Sourcemaps steps
  NAME = 'demo-sourcemaps-tour-name',
  EMAIL = 'demo-sourcemaps-tour-email',
  PASSWORD = 'demo-sourcemaps-tour-password',
  // Releases steps
  TABLE = 'demo-releases-tour-table',
  DETAILS = 'demo-releases-tour-details',
}

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

export const DEMO_SOURCEMAPS_TOUR_STEPS: DemoTourStep[] = [
  DemoTourStep.NAME,
  DemoTourStep.EMAIL,
  DemoTourStep.PASSWORD,
] as const;

export const DEMO_RELEASES_TOUR_STEPS: DemoTourStep[] = [
  DemoTourStep.TABLE,
  DemoTourStep.DETAILS,
] as const;

type DemoToursContextType = {
  releases: TourContextType<DemoTourStep>;
  sourcemaps: TourContextType<DemoTourStep>;
};

export const DemoToursContext = createContext<DemoToursContextType | null>(null);

export function useDemoTours({
  category,
}: {
  category: DemoTourCategory;
}): TourContextType<DemoTourStep> {
  const tourContext = useContext(DemoToursContext);

  if (!tourContext) {
    throw new Error('Must be used within a TourContextProvider');
  }
  return tourContext[category];
}

const emptyTourState = (steps: DemoTourStep[], tourKey: string) => ({
  currentStepId: undefined,
  isCompleted: false,
  orderedStepIds: steps,
  isRegistered: true,
  tourKey,
});

export function DemoToursProvider({children}: {children: React.ReactNode}) {
  const [tourState, setTourState] = useLocalStorageState<
    Record<DemoTourCategory, TourState<any>>
  >(DEMO_TOURS_KEY, {
    [DemoTourCategory.SOURCEMAPS]: emptyTourState(
      DEMO_SOURCEMAPS_TOUR_STEPS,
      DemoTourCategory.SOURCEMAPS
    ),
    [DemoTourCategory.RELEASES]: emptyTourState(
      DEMO_RELEASES_TOUR_STEPS,
      DemoTourCategory.RELEASES
    ),
  });

  const handleStepChange = useCallback(
    (tourKey: DemoTourCategory, stepId: DemoTourStep) => {
      setTourState(prev => ({
        ...prev,
        [tourKey]: {...prev[tourKey], currentStepId: stepId},
      }));
    },
    [setTourState]
  );

  const handleEndTour = useCallback(
    (tourKey: DemoTourCategory) => {
      setTourState(prev => ({
        ...prev,
        [tourKey]: {
          ...prev[tourKey],
          currentStepId: null,
          isCompleted: true,
        },
      }));
    },
    [setTourState]
  );

  const sourcemapsTour = useTourReducer<DemoTourStep>(
    tourState[DemoTourCategory.SOURCEMAPS],
    {
      onEndTour: () => handleEndTour(DemoTourCategory.SOURCEMAPS),
      onStepChange: (stepId: DemoTourStep) =>
        handleStepChange(DemoTourCategory.SOURCEMAPS, stepId),
      requireAllStepsRegistered: false,
    }
  );

  const releasesTour = useTourReducer<DemoTourStep>(
    tourState[DemoTourCategory.RELEASES],
    {
      onEndTour: () => handleEndTour(DemoTourCategory.RELEASES),
      onStepChange: (stepId: DemoTourStep) =>
        handleStepChange(DemoTourCategory.RELEASES, stepId),
      requireAllStepsRegistered: false,
    }
  );

  const value = {
    [DemoTourCategory.SOURCEMAPS]: sourcemapsTour,
    [DemoTourCategory.RELEASES]: releasesTour,
  };

  return <DemoToursContext.Provider value={value}>{children}</DemoToursContext.Provider>;
}

const getTourFromStep = (step: DemoTourStep) => {
  if (DEMO_TOURS[DemoTourCategory.SOURCEMAPS][step]) {
    return DemoTourCategory.SOURCEMAPS;
  }
  if (DEMO_TOURS[DemoTourCategory.RELEASES][step]) {
    return DemoTourCategory.RELEASES;
  }
  throw new Error(`Unknown tour step: ${step}`);
};

export function DemoTourElement({
  id,
  title,
  description,
  children,
}: {
  children: React.ReactNode;
  description: string;
  id: DemoTourStep;
  title: string;
}) {
  const tourKey = getTourFromStep(id);
  const tourContextValue = useDemoTours({category: tourKey});

  if (!tourContextValue) {
    return children;
  }

  return (
    <TourElementContent
      id={id}
      title={title}
      description={description}
      tourContextValue={tourContextValue}
    >
      {children}
    </TourElementContent>
  );
}
