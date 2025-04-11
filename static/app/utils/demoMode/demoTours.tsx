import {createContext, useCallback, useContext, useMemo} from 'react';

import {recordFinish} from 'sentry/actionCreators/guides';
import {TourElementContent} from 'sentry/components/tours/components';
import {
  type TourContextType,
  type TourState,
  useTourReducer,
} from 'sentry/components/tours/tourContext';
import useOrganization from 'sentry/utils/useOrganization';

import {useLocalStorageState} from '../useLocalStorageState';

export const DEMO_TOURS_STATE_KEY = 'demo-mode:tours';

export const enum DemoTour {
  SIDEBAR = 'sidebar',
  ISSUES = 'issues',
  RELEASES = 'releases',
  PERFORMANCE = 'performance',
}

export const enum DemoTourStep {
  // Sidebar steps
  SIDEBAR_PROJECTS = 'demo-tour-sidebar-projects',
  SIDEBAR_ISSUES = 'demo-tour-sidebar-issues',
  SIDEBAR_PERFORMANCE = 'demo-tour-sidebar-performance',
  SIDEBAR_RELEASES = 'demo-tour-sidebar-releases',
  SIDEBAR_DISCOVER = 'demo-tour-sidebar-discover',
  // Issues steps
  ISSUES_STREAM = 'demo-tour-issues-stream',
  ISSUES_TAGS = 'demo-tour-issues-tags',
  ISSUES_STACKTRACE = 'demo-tour-issues-stacktrace',
  ISSUES_BREADCRUMBS = 'demo-tour-issues-breadcrumbs',
  // Releases steps
  RELEASES_COMPARE = 'demo-tour-releases-compare',
  RELEASES_DETAILS = 'demo-tour-releases-details',
  RELEASES_STATES = 'demo-tour-releases-states',
  // Performance steps
  PERFORMANCE_TABLE = 'demo-tour-performance-table',
  PERFORMANCE_TRANSACTION_SUMMARY = 'demo-tour-performance-transaction-summary',
  PERFORMANCE_TRANSACTIONS_TABLE = 'demo-tour-performance-transactions-table',
  PERFORMANCE_SPAN_TREE = 'demo-tour-performance-span-tree',
}

type DemoToursContextType = {
  issues: TourContextType<DemoTourStep>;
  performance: TourContextType<DemoTourStep>;
  releases: TourContextType<DemoTourStep>;
  sidebar: TourContextType<DemoTourStep>;
};

const DemoToursContext = createContext<DemoToursContextType | null>(null);

export function useDemoTours(tourKey: DemoTour): TourContextType<DemoTourStep> {
  const tourContext = useContext(DemoToursContext);

  if (!tourContext) {
    throw new Error('Must be used within a TourContextProvider');
  }
  return tourContext[tourKey];
}

const TOUR_STEPS: Record<DemoTour, DemoTourStep[]> = {
  [DemoTour.SIDEBAR]: [
    DemoTourStep.SIDEBAR_PROJECTS,
    DemoTourStep.SIDEBAR_ISSUES,
    DemoTourStep.SIDEBAR_PERFORMANCE,
    DemoTourStep.SIDEBAR_RELEASES,
    DemoTourStep.SIDEBAR_DISCOVER,
  ],
  [DemoTour.ISSUES]: [
    DemoTourStep.ISSUES_STREAM,
    DemoTourStep.ISSUES_TAGS,
    DemoTourStep.ISSUES_STACKTRACE,
    DemoTourStep.ISSUES_BREADCRUMBS,
  ],
  [DemoTour.RELEASES]: [
    DemoTourStep.RELEASES_COMPARE,
    DemoTourStep.RELEASES_DETAILS,
    DemoTourStep.RELEASES_STATES,
  ],
  [DemoTour.PERFORMANCE]: [
    DemoTourStep.PERFORMANCE_TABLE,
    DemoTourStep.PERFORMANCE_TRANSACTION_SUMMARY,
    DemoTourStep.PERFORMANCE_TRANSACTIONS_TABLE,
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
  [DemoTour.SIDEBAR]: {
    ...emptyTourState,
    orderedStepIds: TOUR_STEPS[DemoTour.SIDEBAR],
    tourKey: DemoTour.SIDEBAR,
  },
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
  const org = useOrganization();
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
      recordFinish(tourKey, org.id, org.slug, org);
    },
    [setTourState, org]
  );

  const getTourOptions = useCallback(
    (tourKey: DemoTour) => ({
      onEndTour: () => handleEndTour(tourKey),
      onStepChange: (stepId: DemoTourStep) => handleStepChange(tourKey, stepId),
      requireAllStepsRegistered: false,
    }),
    [handleEndTour, handleStepChange]
  );

  const sidebarTour = useTourReducer<DemoTourStep>(
    tourState[DemoTour.SIDEBAR],
    getTourOptions(DemoTour.SIDEBAR)
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
      [DemoTour.SIDEBAR]: sidebarTour,
      [DemoTour.ISSUES]: issuesTour,
      [DemoTour.RELEASES]: releasesTour,
      [DemoTour.PERFORMANCE]: performanceTour,
    }),
    [issuesTour, releasesTour, performanceTour, sidebarTour]
  );

  return <DemoToursContext value={tours}>{children}</DemoToursContext>;
}

// Helper to get tour category from step remains the same
const getTourFromStep = (step: DemoTourStep): DemoTour => {
  for (const [category, steps] of Object.entries(TOUR_STEPS)) {
    if (steps.includes(step)) {
      return category as DemoTour;
    }
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
  const tourContextValue = useDemoTours(tourKey);

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
