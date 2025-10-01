import {
  act,
  render,
  renderHookWithProviders,
  screen,
} from 'sentry-test/reactTestingLibrary';

import {recordFinish} from 'sentry/actionCreators/guides';
import type {TourState} from 'sentry/components/tours/tourContext';
import {
  DEMO_TOURS_STATE_KEY,
  DemoTour,
  DemoTourElement,
  DemoToursProvider,
  DemoTourStep,
  useDemoTour,
} from 'sentry/utils/demoMode/demoTours';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

jest.mock('sentry/actionCreators/guides', () => ({
  recordFinish: jest.fn(),
}));

jest.mock('sentry/utils/useLocalStorageState', () => ({
  useLocalStorageState: jest.fn(),
}));

interface MockToursState {
  [DemoTour.SIDEBAR]: TourState<DemoTourStep>;
  [DemoTour.ISSUES]: TourState<DemoTourStep>;
  [DemoTour.RELEASES]: TourState<DemoTourStep>;
  [DemoTour.PERFORMANCE]: TourState<DemoTourStep>;
}

const mockUseLocalStorageState = useLocalStorageState as jest.Mock;

function createWrapper() {
  return function ({children}: {children?: React.ReactNode}) {
    return <DemoToursProvider>{children}</DemoToursProvider>;
  };
}

describe('DemoTours', () => {
  let mockState: MockToursState;
  let mockSetState: jest.Mock;

  beforeEach(() => {
    mockState = {
      [DemoTour.SIDEBAR]: {
        currentStepId: null,
        isCompleted: false,
        orderedStepIds: [DemoTourStep.SIDEBAR_PROJECTS, DemoTourStep.SIDEBAR_ISSUES],
        isRegistered: true,
        tourKey: DemoTour.SIDEBAR,
      },
      [DemoTour.ISSUES]: {
        currentStepId: null,
        isCompleted: false,
        orderedStepIds: [DemoTourStep.ISSUES_STREAM, DemoTourStep.ISSUES_AGGREGATES],
        isRegistered: true,
        tourKey: DemoTour.ISSUES,
      },
      [DemoTour.RELEASES]: {
        currentStepId: null,
        isCompleted: false,
        orderedStepIds: [],
        isRegistered: true,
        tourKey: DemoTour.RELEASES,
      },
      [DemoTour.PERFORMANCE]: {
        currentStepId: null,
        isCompleted: false,
        orderedStepIds: [],
        isRegistered: true,
        tourKey: DemoTour.PERFORMANCE,
      },
    };

    mockSetState = jest.fn(
      (stateOrUpdater: MockToursState | ((prev: MockToursState) => MockToursState)) => {
        if (typeof stateOrUpdater === 'function') {
          mockState = stateOrUpdater(mockState);
        } else {
          mockState = stateOrUpdater;
        }
        return mockState;
      }
    );

    mockUseLocalStorageState.mockImplementation(() => [mockState, mockSetState]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('DemoToursProvider', () => {
    it('initializes with correct state', () => {
      render(
        <DemoToursProvider>
          <div data-test-id="child" />
        </DemoToursProvider>
      );

      expect(mockUseLocalStorageState).toHaveBeenCalledWith(
        DEMO_TOURS_STATE_KEY,
        expect.any(Object)
      );
    });
  });

  describe('useDemoTour', () => {
    it('returns null when used outside provider', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const {result} = renderHookWithProviders(() => useDemoTour(DemoTour.SIDEBAR));

      expect(result.current).toBeNull();

      jest.restoreAllMocks();
    });

    it('provides tour context when used inside provider', () => {
      const {result} = renderHookWithProviders(() => useDemoTour(DemoTour.SIDEBAR), {
        additionalWrapper: createWrapper(),
      });

      const tour = result.current;

      expect(tour?.currentStepId).toBeNull();
      expect(tour?.isCompleted).toBe(false);
      expect(tour?.orderedStepIds).toEqual([
        DemoTourStep.SIDEBAR_PROJECTS,
        DemoTourStep.SIDEBAR_ISSUES,
      ]);
    });

    it('handles tour actions', () => {
      const {result} = renderHookWithProviders(() => useDemoTour(DemoTour.SIDEBAR), {
        additionalWrapper: createWrapper(),
      });

      const tour = result.current;

      act(() => {
        tour?.startTour(DemoTourStep.SIDEBAR_PROJECTS);
      });

      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(
        DemoTourStep.SIDEBAR_PROJECTS
      );

      act(() => {
        tour?.setStep(DemoTourStep.SIDEBAR_ISSUES);
      });

      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(DemoTourStep.SIDEBAR_ISSUES);

      act(() => {
        tour?.endTour();
      });

      expect(mockState[DemoTour.SIDEBAR].isCompleted).toBe(true);
      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBeUndefined();

      expect(recordFinish).toHaveBeenCalledWith(DemoTour.SIDEBAR, null);
    });

    it('maintains separate state for different tours', () => {
      const {result: sideBarResult} = renderHookWithProviders(
        () => useDemoTour(DemoTour.SIDEBAR),
        {
          additionalWrapper: createWrapper(),
        }
      );

      const sidebarTour = sideBarResult.current;

      const {result: issuesResult} = renderHookWithProviders(
        () => useDemoTour(DemoTour.ISSUES),
        {
          additionalWrapper: createWrapper(),
        }
      );

      const issuesTour = issuesResult.current;

      act(() => {
        sidebarTour?.startTour(DemoTourStep.SIDEBAR_PROJECTS);
      });

      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(
        DemoTourStep.SIDEBAR_PROJECTS
      );
      expect(mockState[DemoTour.ISSUES].currentStepId).toBeNull();

      act(() => {
        issuesTour?.startTour(DemoTourStep.ISSUES_STREAM);
      });

      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(
        DemoTourStep.SIDEBAR_PROJECTS
      );
      expect(mockState[DemoTour.ISSUES].currentStepId).toBe(DemoTourStep.ISSUES_STREAM);

      act(() => {
        sidebarTour?.setStep(DemoTourStep.SIDEBAR_ISSUES);
      });

      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(DemoTourStep.SIDEBAR_ISSUES);
      expect(mockState[DemoTour.ISSUES].currentStepId).toBe(DemoTourStep.ISSUES_STREAM);

      act(() => {
        sidebarTour?.endTour();
      });

      expect(mockState[DemoTour.SIDEBAR].isCompleted).toBe(true);
      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBeUndefined();
      expect(mockState[DemoTour.ISSUES].isCompleted).toBe(false);
      expect(mockState[DemoTour.ISSUES].currentStepId).toBe(DemoTourStep.ISSUES_STREAM);

      expect(recordFinish).toHaveBeenCalledWith(DemoTour.SIDEBAR, null);
    });

    it('correctly advances through tour steps', () => {
      const {result} = renderHookWithProviders(() => useDemoTour(DemoTour.SIDEBAR), {
        additionalWrapper: createWrapper(),
      });

      const sidebarTour = result.current;

      act(() => {
        sidebarTour?.startTour(DemoTourStep.SIDEBAR_PROJECTS);
      });
      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(
        DemoTourStep.SIDEBAR_PROJECTS
      );

      act(() => {
        sidebarTour?.setStep(DemoTourStep.SIDEBAR_ISSUES);
      });
      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(DemoTourStep.SIDEBAR_ISSUES);

      act(() => {
        sidebarTour?.endTour();
      });
      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBeUndefined();
      expect(mockState[DemoTour.SIDEBAR].isCompleted).toBe(true);
    });
  });

  describe('DemoTourElement', () => {
    it('renders children correctly', () => {
      render(
        <DemoToursProvider>
          <DemoTourElement
            id={DemoTourStep.SIDEBAR_PROJECTS}
            title="Test Title"
            description="Test Description"
          >
            <div data-test-id="element-content">Element Content</div>
          </DemoTourElement>
        </DemoToursProvider>
      );

      expect(screen.getByTestId('element-content')).toBeInTheDocument();
      expect(screen.getByText('Element Content')).toBeInTheDocument();
    });
  });
});
