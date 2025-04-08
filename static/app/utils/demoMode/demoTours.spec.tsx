import {cleanup, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {recordFinish} from 'sentry/actionCreators/guides';
import type {TourState} from 'sentry/components/tours/tourContext';
import {
  DemoTour,
  DemoTourElement,
  DemoToursProvider,
  DemoTourStep,
  useDemoTours,
} from 'sentry/utils/demoMode/demoTours';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

jest.mock('sentry/actionCreators/guides', () => ({
  recordFinish: jest.fn(),
}));

jest.mock('sentry/utils/useLocalStorageState', () => ({
  useLocalStorageState: jest.fn(),
}));

function TourHookTester({tourKey}: {tourKey: DemoTour}) {
  const tour = useDemoTours(tourKey);

  return (
    <div>
      <div data-test-id="tour-active">{tour.currentStepId || 'none'}</div>
      <div data-test-id="tour-completed">{String(tour.isCompleted)}</div>
      <button
        data-test-id="start-tour"
        onClick={() =>
          tour.startTour(
            tourKey === DemoTour.SIDEBAR
              ? DemoTourStep.SIDEBAR_PROJECTS
              : DemoTourStep.ISSUES_STREAM
          )
        }
      >
        Start Tour
      </button>
      <button data-test-id="end-tour" onClick={() => tour.endTour()}>
        End Tour
      </button>
      <button
        data-test-id="set-step"
        onClick={() =>
          tour.setStep(
            tourKey === DemoTour.SIDEBAR
              ? DemoTourStep.SIDEBAR_ISSUES
              : DemoTourStep.ISSUES_TAGS
          )
        }
      >
        Set Step
      </button>
    </div>
  );
}

// Helper component for testing multiple tours
function MultiTourTester() {
  const sidebarTour = useDemoTours(DemoTour.SIDEBAR);
  const issuesTour = useDemoTours(DemoTour.ISSUES);

  return (
    <div>
      <DemoTourElement
        id={DemoTourStep.SIDEBAR_PROJECTS}
        title="Sidebar Projects"
        description="Learn about projects"
      >
        <div data-test-id="sidebar-projects-anchor">
          {sidebarTour.currentStepId === DemoTourStep.SIDEBAR_PROJECTS
            ? 'Active'
            : 'Inactive'}
        </div>
      </DemoTourElement>

      <DemoTourElement
        id={DemoTourStep.SIDEBAR_ISSUES}
        title="Sidebar Issues"
        description="Learn about issues"
      >
        <div data-test-id="sidebar-issues-anchor">
          {sidebarTour.currentStepId === DemoTourStep.SIDEBAR_ISSUES
            ? 'Active'
            : 'Inactive'}
        </div>
      </DemoTourElement>

      <DemoTourElement
        id={DemoTourStep.ISSUES_STREAM}
        title="Issues Stream"
        description="Learn about the issues stream"
      >
        <div data-test-id="issues-stream-anchor">
          {issuesTour.currentStepId === DemoTourStep.ISSUES_STREAM
            ? 'Active'
            : 'Inactive'}
        </div>
      </DemoTourElement>

      <DemoTourElement
        id={DemoTourStep.ISSUES_TAGS}
        title="Issues Tags"
        description="Learn about issues tags"
      >
        <div data-test-id="issues-tags-anchor">
          {issuesTour.currentStepId === DemoTourStep.ISSUES_TAGS ? 'Active' : 'Inactive'}
        </div>
      </DemoTourElement>

      <button
        data-test-id="start-sidebar"
        onClick={() => sidebarTour.startTour(DemoTourStep.SIDEBAR_PROJECTS)}
      >
        Start Sidebar
      </button>
      <button
        data-test-id="start-issues"
        onClick={() => issuesTour.startTour(DemoTourStep.ISSUES_STREAM)}
      >
        Start Issues
      </button>
      <button data-test-id="end-sidebar" onClick={() => sidebarTour.endTour()}>
        End Sidebar
      </button>
      <button data-test-id="end-issues" onClick={() => issuesTour.endTour()}>
        End Issues
      </button>
      <button data-test-id="next-step-sidebar" onClick={() => sidebarTour.nextStep()}>
        Next Sidebar Step
      </button>
      <button data-test-id="next-step-issues" onClick={() => issuesTour.nextStep()}>
        Next Issues Step
      </button>
    </div>
  );
}

interface MockToursState {
  [DemoTour.SIDEBAR]: TourState<DemoTourStep>;
  [DemoTour.ISSUES]: TourState<DemoTourStep>;
  [DemoTour.RELEASES]: TourState<DemoTourStep>;
  [DemoTour.PERFORMANCE]: TourState<DemoTourStep>;
}

const mockUseLocalStorageState = useLocalStorageState as jest.Mock;

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
        orderedStepIds: [DemoTourStep.ISSUES_STREAM, DemoTourStep.ISSUES_TAGS],
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
    cleanup();
  });

  describe('DemoToursProvider', () => {
    it('renders children', () => {
      render(
        <DemoToursProvider>
          <div data-test-id="child-component">Test Child</div>
        </DemoToursProvider>
      );

      expect(screen.getByTestId('child-component')).toBeInTheDocument();
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });

    it('initializes with correct state', () => {
      render(
        <DemoToursProvider>
          <div data-test-id="child" />
        </DemoToursProvider>
      );

      expect(mockUseLocalStorageState).toHaveBeenCalledWith(
        'demo-mode:tours',
        expect.any(Object)
      );
    });

    it('maintains separate state for different tours', async () => {
      render(
        <DemoToursProvider>
          <MultiTourTester />
        </DemoToursProvider>
      );

      expect(screen.getByTestId('sidebar-projects-anchor')).toHaveTextContent('Inactive');
      expect(screen.getByTestId('sidebar-issues-anchor')).toHaveTextContent('Inactive');
      expect(screen.getByTestId('issues-stream-anchor')).toHaveTextContent('Inactive');
      expect(screen.getByTestId('issues-tags-anchor')).toHaveTextContent('Inactive');

      await userEvent.click(screen.getByTestId('start-sidebar'));

      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(
        DemoTourStep.SIDEBAR_PROJECTS
      );
      expect(screen.getByTestId('sidebar-projects-anchor')).toHaveTextContent('Active');
      expect(screen.getByTestId('issues-stream-anchor')).toHaveTextContent('Inactive');

      await userEvent.click(screen.getByTestId('start-issues'));

      expect(mockState[DemoTour.ISSUES].currentStepId).toBe(DemoTourStep.ISSUES_STREAM);
      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(
        DemoTourStep.SIDEBAR_PROJECTS
      );
      expect(screen.getByTestId('sidebar-projects-anchor')).toHaveTextContent('Active');
      expect(screen.getByTestId('issues-stream-anchor')).toHaveTextContent('Active');

      await userEvent.click(screen.getByTestId('next-step-sidebar'));

      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(DemoTourStep.SIDEBAR_ISSUES);
      expect(screen.getByTestId('sidebar-issues-anchor')).toHaveTextContent('Active');

      expect(mockState[DemoTour.ISSUES].currentStepId).toBe(DemoTourStep.ISSUES_STREAM);
      expect(mockState[DemoTour.ISSUES].isCompleted).toBe(false);

      await userEvent.click(screen.getByTestId('end-issues'));

      expect(mockState[DemoTour.ISSUES].isCompleted).toBe(true);
      expect(mockState[DemoTour.ISSUES].currentStepId).toBeNull();

      expect(recordFinish).toHaveBeenCalledWith(
        DemoTour.ISSUES,
        expect.any(String),
        expect.any(String),
        expect.anything()
      );
    });
  });

  describe('useDemoTours', () => {
    it('throws error when used outside provider', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TourHookTester tourKey={DemoTour.SIDEBAR} />);
      }).toThrow('Must be used within a TourContextProvider');

      jest.restoreAllMocks();
    });

    it('provides tour context when used inside provider', () => {
      render(
        <DemoToursProvider>
          <TourHookTester tourKey={DemoTour.SIDEBAR} />
        </DemoToursProvider>
      );

      expect(screen.getByTestId('tour-active')).toHaveTextContent('none');
      expect(screen.getByTestId('tour-completed')).toHaveTextContent('false');
    });

    it('handles tour actions', async () => {
      render(
        <DemoToursProvider>
          <TourHookTester tourKey={DemoTour.SIDEBAR} />
        </DemoToursProvider>
      );

      await userEvent.click(screen.getByTestId('start-tour'));

      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(
        DemoTourStep.SIDEBAR_PROJECTS
      );
      expect(screen.getByTestId('tour-active')).toHaveTextContent(
        DemoTourStep.SIDEBAR_PROJECTS
      );

      await userEvent.click(screen.getByTestId('set-step'));

      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBe(DemoTourStep.SIDEBAR_ISSUES);
      expect(screen.getByTestId('tour-active')).toHaveTextContent(
        DemoTourStep.SIDEBAR_ISSUES
      );

      await userEvent.click(screen.getByTestId('end-tour'));

      expect(mockState[DemoTour.SIDEBAR].isCompleted).toBe(true);
      expect(mockState[DemoTour.SIDEBAR].currentStepId).toBeNull();
      expect(screen.getByTestId('tour-active')).toHaveTextContent('none');
      expect(screen.getByTestId('tour-completed')).toHaveTextContent('true');

      expect(recordFinish).toHaveBeenCalledWith(
        DemoTour.SIDEBAR,
        expect.any(String),
        expect.any(String),
        expect.anything()
      );
    });
  });
});
