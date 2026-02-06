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
        orderedStepIds: [DemoTourStep.RELEASES_LIST, DemoTourStep.RELEASES_CHART],
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

      const {result} = renderHookWithProviders(useDemoTour, {
        initialProps: DemoTour.RELEASES,
      });

      expect(result.current).toBeNull();

      jest.restoreAllMocks();
    });

    it('provides tour context when used inside provider', () => {
      const {result} = renderHookWithProviders(useDemoTour, {
        additionalWrapper: createWrapper(),
        initialProps: DemoTour.RELEASES,
      });

      const tour = result.current;

      expect(tour?.currentStepId).toBeNull();
      expect(tour?.isCompleted).toBe(false);
      expect(tour?.orderedStepIds).toEqual([
        DemoTourStep.RELEASES_LIST,
        DemoTourStep.RELEASES_CHART,
      ]);
    });

    it('handles tour actions', () => {
      const {result} = renderHookWithProviders(useDemoTour, {
        additionalWrapper: createWrapper(),
        initialProps: DemoTour.RELEASES,
      });

      const tour = result.current;

      act(() => {
        tour?.startTour(DemoTourStep.RELEASES_LIST);
      });

      expect(mockState[DemoTour.RELEASES].currentStepId).toBe(DemoTourStep.RELEASES_LIST);

      act(() => {
        tour?.setStep(DemoTourStep.RELEASES_CHART);
      });

      expect(mockState[DemoTour.RELEASES].currentStepId).toBe(
        DemoTourStep.RELEASES_CHART
      );

      act(() => {
        tour?.endTour();
      });

      expect(mockState[DemoTour.RELEASES].isCompleted).toBe(true);
      expect(mockState[DemoTour.RELEASES].currentStepId).toBeUndefined();

      expect(recordFinish).toHaveBeenCalledWith(DemoTour.RELEASES, null);
    });

    it('maintains separate state for different tours', () => {
      const {result: sideBarResult} = renderHookWithProviders(useDemoTour, {
        additionalWrapper: createWrapper(),
        initialProps: DemoTour.RELEASES,
      });

      const sidebarTour = sideBarResult.current;

      const {result: issuesResult} = renderHookWithProviders(useDemoTour, {
        additionalWrapper: createWrapper(),
        initialProps: DemoTour.ISSUES,
      });

      const issuesTour = issuesResult.current;

      act(() => {
        sidebarTour?.startTour(DemoTourStep.RELEASES_LIST);
      });

      expect(mockState[DemoTour.RELEASES].currentStepId).toBe(DemoTourStep.RELEASES_LIST);
      expect(mockState[DemoTour.ISSUES].currentStepId).toBeNull();

      act(() => {
        issuesTour?.startTour(DemoTourStep.ISSUES_STREAM);
      });

      expect(mockState[DemoTour.RELEASES].currentStepId).toBe(DemoTourStep.RELEASES_LIST);
      expect(mockState[DemoTour.ISSUES].currentStepId).toBe(DemoTourStep.ISSUES_STREAM);

      act(() => {
        sidebarTour?.setStep(DemoTourStep.RELEASES_CHART);
      });

      expect(mockState[DemoTour.RELEASES].currentStepId).toBe(
        DemoTourStep.RELEASES_CHART
      );
      expect(mockState[DemoTour.ISSUES].currentStepId).toBe(DemoTourStep.ISSUES_STREAM);

      act(() => {
        sidebarTour?.endTour();
      });

      expect(mockState[DemoTour.RELEASES].isCompleted).toBe(true);
      expect(mockState[DemoTour.RELEASES].currentStepId).toBeUndefined();
      expect(mockState[DemoTour.ISSUES].isCompleted).toBe(false);
      expect(mockState[DemoTour.ISSUES].currentStepId).toBe(DemoTourStep.ISSUES_STREAM);

      expect(recordFinish).toHaveBeenCalledWith(DemoTour.RELEASES, null);
    });

    it('correctly advances through tour steps', () => {
      const {result} = renderHookWithProviders(useDemoTour, {
        additionalWrapper: createWrapper(),
        initialProps: DemoTour.RELEASES,
      });

      const sidebarTour = result.current;

      act(() => {
        sidebarTour?.startTour(DemoTourStep.RELEASES_LIST);
      });
      expect(mockState[DemoTour.RELEASES].currentStepId).toBe(DemoTourStep.RELEASES_LIST);

      act(() => {
        sidebarTour?.setStep(DemoTourStep.RELEASES_CHART);
      });
      expect(mockState[DemoTour.RELEASES].currentStepId).toBe(
        DemoTourStep.RELEASES_CHART
      );

      act(() => {
        sidebarTour?.endTour();
      });
      expect(mockState[DemoTour.RELEASES].currentStepId).toBeUndefined();
      expect(mockState[DemoTour.RELEASES].isCompleted).toBe(true);
    });
  });

  describe('DemoTourElement', () => {
    it('renders children correctly', () => {
      render(
        <DemoToursProvider>
          <DemoTourElement
            id={DemoTourStep.RELEASES_LIST}
            title="Test Title"
            description="Test Description"
          >
            {props => (
              <div {...props} data-test-id="element-content">
                Element Content
              </div>
            )}
          </DemoTourElement>
        </DemoToursProvider>
      );

      expect(screen.getByTestId('element-content')).toBeInTheDocument();
      expect(screen.getByText('Element Content')).toBeInTheDocument();
    });
  });
});
