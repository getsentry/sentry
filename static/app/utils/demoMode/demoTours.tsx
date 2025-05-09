import {createContext, useCallback, useContext, useMemo} from 'react';

import {recordFinish} from 'sentry/actionCreators/guides';
import {
  TourElement,
  TourElementContent,
  type TourElementProps,
} from 'sentry/components/tours/components';
import {
  type TourContextType,
  type TourEnumType,
  type TourState,
  useTourReducer,
} from 'sentry/components/tours/tourContext';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export const DEMO_TOURS_STATE_KEY = 'demo-mode:tours';
const DEMO_SELECTED_PROJECT_ID = '4508160347275264';
const DEMO_SELECTED_TRANSACTION = '/products';
const DEMO_SELECTED_TRACE_ID = '171df07fc30e4e269358eb4d7cca7b9f';

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

type DemoTourStepWithUrl = {
  id: DemoTourStep;
  url?: {pathname: string; query?: Record<string, string>};
};

const TOUR_STEPS: Record<DemoTour, DemoTourStepWithUrl[]> = {
  [DemoTour.SIDEBAR]: [
    {
      id: DemoTourStep.SIDEBAR_PROJECTS,
    },
    {
      id: DemoTourStep.SIDEBAR_ISSUES,
    },
    {
      id: DemoTourStep.SIDEBAR_PERFORMANCE,
    },
    {
      id: DemoTourStep.SIDEBAR_RELEASES,
    },
    {
      id: DemoTourStep.SIDEBAR_DISCOVER,
    },
  ],
  [DemoTour.ISSUES]: [
    {
      id: DemoTourStep.ISSUES_STREAM,
    },
    {
      id: DemoTourStep.ISSUES_AGGREGATES,
    },
    {
      id: DemoTourStep.ISSUES_EVENT_DETAILS,
    },
    {
      id: DemoTourStep.ISSUES_DETAIL_SIDEBAR,
    },
  ],
  [DemoTour.RELEASES]: [
    {
      id: DemoTourStep.RELEASES_COMPARE,
    },
    {
      id: DemoTourStep.RELEASES_DETAILS,
    },
    {
      id: DemoTourStep.RELEASES_STATES,
    },
  ],
  [DemoTour.PERFORMANCE]: [
    {
      id: DemoTourStep.PERFORMANCE_TABLE,
      url: {
        pathname: `/insights/frontend/`,
      },
    },
    {
      id: DemoTourStep.PERFORMANCE_USER_MISERY,
      url: {
        pathname: `/insights/frontend/summary/`,
        query: {
          transaction: DEMO_SELECTED_TRANSACTION,
        },
      },
    },
    {
      id: DemoTourStep.PERFORMANCE_TRANSACTION_SUMMARY_TABLE,
      url: {
        pathname: `/insights/frontend/summary/`,
        query: {
          transaction: DEMO_SELECTED_TRANSACTION,
        },
      },
    },
    {
      id: DemoTourStep.PERFORMANCE_SPAN_TREE,
      url: {
        pathname: `/insights/summary/trace/${DEMO_SELECTED_TRACE_ID}`,
      },
    },
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
    orderedStepIds: TOUR_STEPS[DemoTour.SIDEBAR].map(s => s.id),
    tourKey: DemoTour.SIDEBAR,
  },
  [DemoTour.ISSUES]: {
    ...emptyTourState,
    orderedStepIds: TOUR_STEPS[DemoTour.ISSUES].map(s => s.id),
    tourKey: DemoTour.ISSUES,
  },
  [DemoTour.RELEASES]: {
    ...emptyTourState,
    orderedStepIds: TOUR_STEPS[DemoTour.RELEASES].map(s => s.id),
    tourKey: DemoTour.RELEASES,
  },
  [DemoTour.PERFORMANCE]: {
    ...emptyTourState,
    orderedStepIds: TOUR_STEPS[DemoTour.PERFORMANCE].map(s => s.id),
    tourKey: DemoTour.PERFORMANCE,
  },
};

type DemoToursContextType = {
  issues: TourContextType<DemoTourStep>;
  performance: TourContextType<DemoTourStep>;
  releases: TourContextType<DemoTourStep>;
  sidebar: TourContextType<DemoTourStep>;
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

function useNavigateToStep() {
  const location = useLocation();
  const navigate = useNavigate();

  const getUrlFromStep = (stepId: DemoTourStep) => {
    const step = TOUR_STEPS[getTourFromStep(stepId)].find(s => s.id === stepId);

    return {
      pathname: step?.url?.pathname ?? '',
      query: {
        ...step?.url?.query,
        project: DEMO_SELECTED_PROJECT_ID,
      },
    };
  };

  const navigateToStep = (stepId: DemoTourStep) => {
    const target = getUrlFromStep(stepId);
    if (location.pathname !== target.pathname && target.pathname !== '') {
      navigate(target);
    }
  };

  return navigateToStep;
}

export function DemoToursProvider({children}: {children: React.ReactNode}) {
  const [tourState, setTourState] = useLocalStorageState<
    Record<DemoTour, TourState<any>>
  >(DEMO_TOURS_STATE_KEY, TOUR_STATE_INITIAL_VALUE);
  const navigateToStep = useNavigateToStep();

  const handleStepChange = useCallback(
    (tourKey: DemoTour, stepId: DemoTourStep) => {
      setTourState(prev => ({
        ...prev,
        [tourKey]: {...prev[tourKey], currentStepId: stepId},
      }));
      navigateToStep(stepId);
    },
    [setTourState, navigateToStep]
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

const getTourFromStep = (step: DemoTourStep): DemoTour => {
  for (const [category, steps] of Object.entries(TOUR_STEPS)) {
    if (steps.some(s => s.id === step)) {
      return category as DemoTour;
    }
  }
  throw new Error(`Unknown tour step: ${step}`);
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
}: TourElementProps<T> & {demoTourId: DemoTourStep}) {
  if (isDemoModeActive()) {
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
