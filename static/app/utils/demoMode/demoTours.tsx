import {createContext, useCallback, useContext, useMemo} from 'react';

import {recordFinish} from 'sentry/actionCreators/guides';
import {
  TourElement,
  TourElementContent,
  type TourElementProps,
} from 'sentry/components/tours/components';
import {
  useTourReducer,
  type TourContextType,
  type TourEnumType,
  type TourState,
} from 'sentry/components/tours/tourContext';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

export const DEMO_TOURS_STATE_KEY = 'demo-mode:tours';

export const enum DemoTour {
  ISSUES = 'issues',
  RELEASES = 'releases',
  PERFORMANCE = 'performance',
}

export const enum DemoTourStep {
  // Issues steps
  ISSUES_STREAM = 'demo-tour-issues-stream',
  ISSUES_AGGREGATES = 'demo-tour-issues-aggregates',
  ISSUES_EVENT_DETAILS = 'demo-tour-issues-event-details',
  ISSUES_DETAIL_SIDEBAR = 'demo-tour-issues-detail-sidebar',
  // Releases steps
  RELEASES_COMPARE = 'demo-tour-releases-compare',
  RELEASES_DETAILS = 'demo-tour-releases-details',
  RELEASES_STATES = 'demo-tour-releases-states',
  // Performance steps
  PERFORMANCE_TABLE = 'demo-tour-performance-table',
  PERFORMANCE_USER_MISERY = 'demo-tour-performance-user-misery',
  PERFORMANCE_TRANSACTION_SUMMARY_TABLE = 'demo-tour-performance-transaction-summary-table',
  PERFORMANCE_SPAN_TREE = 'demo-tour-performance-span-tree',
}

type DemoToursContextType = {
  issues: TourContextType<DemoTourStep>;
  performance: TourContextType<DemoTourStep>;
  releases: TourContextType<DemoTourStep>;
};

const DemoToursContext = createContext<DemoToursContextType | null>(null);

export function useDemoTours(): DemoToursContextType | null {
  const tourContext = useContext(DemoToursContext);

  return tourContext;
}

export function useDemoTour(tourKey: DemoTour): TourContextType<DemoTourStep> | null {
  const tourContext = useDemoTours();

  if (!tourContext) {
    return null;
  }

  return tourContext[tourKey];
}

const TOUR_STEPS: Record<DemoTour, DemoTourStep[]> = {
  [DemoTour.ISSUES]: [
    DemoTourStep.ISSUES_STREAM,
    DemoTourStep.ISSUES_AGGREGATES,
    DemoTourStep.ISSUES_EVENT_DETAILS,
    DemoTourStep.ISSUES_DETAIL_SIDEBAR,
  ],
  [DemoTour.RELEASES]: [
    DemoTourStep.RELEASES_COMPARE,
    DemoTourStep.RELEASES_DETAILS,
    DemoTourStep.RELEASES_STATES,
  ],
  [DemoTour.PERFORMANCE]: [
    DemoTourStep.PERFORMANCE_TABLE,
    DemoTourStep.PERFORMANCE_USER_MISERY,
    DemoTourStep.PERFORMANCE_TRANSACTION_SUMMARY_TABLE,
    DemoTourStep.PERFORMANCE_SPAN_TREE,
  ],
};

const emptyTourState = {
  currentStepId: undefined,
  isCompleted: false,
  isRegistered: true,
  orderedStepIds: [],
};

const TOUR_STATE_INITIAL_VALUE: Record<DemoTour, TourState<any>> = {
  [DemoTour.ISSUES]: {
    ...emptyTourState,
    orderedStepIds: TOUR_STEPS[DemoTour.ISSUES],
    tourKey: DemoTour.ISSUES,
  },
  [DemoTour.RELEASES]: {
    ...emptyTourState,
    orderedStepIds: TOUR_STEPS[DemoTour.RELEASES],
    tourKey: DemoTour.RELEASES,
  },
  [DemoTour.PERFORMANCE]: {
    ...emptyTourState,
    orderedStepIds: TOUR_STEPS[DemoTour.PERFORMANCE],
    tourKey: DemoTour.PERFORMANCE,
  },
};

export function DemoToursProvider({children}: {children: React.ReactNode}) {
  const [tourState, setTourState] = useLocalStorageState<
    Record<DemoTour, TourState<any>>
  >(DEMO_TOURS_STATE_KEY, TOUR_STATE_INITIAL_VALUE);

  const handleStepChange = useCallback(
    (tourKey: DemoTour, stepId: DemoTourStep) => {
      setTourState(prev => ({
        ...prev,
        [tourKey]: {...prev[tourKey], currentStepId: stepId},
      }));
    },
    [setTourState]
  );

  const handleEndTour = useCallback(
    (tourKey: DemoTour) => {
      setTourState(prev => ({
        ...prev,
        [tourKey]: {
          ...prev[tourKey],
          currentStepId: undefined,
          isCompleted: true,
        },
      }));
      recordFinish(tourKey, null);
    },
    [setTourState]
  );

  const getTourOptions = useCallback(
    (tourKey: DemoTour) => ({
      onEndTour: () => handleEndTour(tourKey),
      onStepChange: (stepId: DemoTourStep) => handleStepChange(tourKey, stepId),
      requireAllStepsRegistered: false,
    }),
    [handleEndTour, handleStepChange]
  );

  const issuesTour = useTourReducer<DemoTourStep>(
    tourState[DemoTour.ISSUES],
    getTourOptions(DemoTour.ISSUES)
  );

  const releasesTour = useTourReducer<DemoTourStep>(
    tourState[DemoTour.RELEASES],
    getTourOptions(DemoTour.RELEASES)
  );

  const performanceTour = useTourReducer<DemoTourStep>(
    tourState[DemoTour.PERFORMANCE],
    getTourOptions(DemoTour.PERFORMANCE)
  );

  const tours = useMemo(
    () => ({
      [DemoTour.ISSUES]: issuesTour,
      [DemoTour.RELEASES]: releasesTour,
      [DemoTour.PERFORMANCE]: performanceTour,
    }),
    [issuesTour, releasesTour, performanceTour]
  );

  return <DemoToursContext value={tours}>{children}</DemoToursContext>;
}

const getTourFromStep = (step: DemoTourStep): DemoTour | null => {
  for (const [category, steps] of Object.entries(TOUR_STEPS)) {
    if (steps.includes(step)) {
      return category as DemoTour;
    }
  }
  return null;
};

type DemoTourElementProps = Omit<
  TourElementProps<DemoTourStep>,
  'tourContextValue' | 'tourContext'
> & {disabled?: boolean};

export function DemoTourElement({
  id,
  title,
  description,
  children,
  position = 'top-start',
  disabled = false,
  ...props
}: DemoTourElementProps) {
  const tourKey = getTourFromStep(id);

  if (!tourKey) {
    return children;
  }

  return (
    <DemoTourElementContent
      {...props}
      id={id}
      title={title}
      description={description}
      position={position}
      tourKey={tourKey}
    >
      {children}
    </DemoTourElementContent>
  );
}

function DemoTourElementContent({
  id,
  title,
  description,
  children,
  position = 'top-start',
  disabled = false,
  tourKey,
  ...props
}: DemoTourElementProps & {tourKey: DemoTour}) {
  const tourContextValue = useDemoTour(tourKey);

  if (!isDemoModeActive() || !tourContextValue || disabled) {
    return children;
  }

  return (
    <TourElementContent
      {...props}
      id={id}
      title={title}
      description={description}
      tourContextValue={tourContextValue}
      position={position}
    >
      {children}
    </TourElementContent>
  );
}

/**
 * A component that renders either a DemoTourElement or regular TourElement depending on whether
 * demo mode is active. This allows the same tour content to be shared between demo mode and
 * regular product tours.
 */
export function SharedTourElement<T extends TourEnumType>({
  id,
  demoTourId,
  title,
  description,
  children,
  tourContext,
  ...props
}: TourElementProps<T> & {demoTourId?: DemoTourStep}) {
  if (isDemoModeActive() && demoTourId) {
    return (
      <DemoTourElement id={demoTourId} title={title} description={description}>
        {children}
      </DemoTourElement>
    );
  }

  return (
    <TourElement
      {...props}
      id={id}
      title={title}
      description={description}
      tourContext={tourContext}
    >
      {children}
    </TourElement>
  );
}
