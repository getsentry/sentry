import {cleanup, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {recordFinish} from 'sentry/actionCreators/guides';
import {
  DemoTour,
  DemoTourProvider,
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

const mockUseLocalStorageState = jest.mocked(useLocalStorageState);

function MultiTourTester() {
  const sidebarTour = useDemoTours(DemoTour.SIDEBAR);
  const issuesTour = useDemoTours(DemoTour.ISSUES);
  const releasesTour = useDemoTours(DemoTour.RELEASES);
  const performanceTour = useDemoTours(DemoTour.PERFORMANCE);

  return (
    <div>
      <div data-testid="sidebar-step">{sidebarTour.currentStepId || 'none'}</div>
      <div data-testid="issues-step">{issuesTour.currentStepId || 'none'}</div>
      <div data-testid="releases-step">{releasesTour.currentStepId || 'none'}</div>
      <div data-testid="performance-step">{performanceTour.currentStepId || 'none'}</div>

      <button
        data-testid="start-sidebar"
        onClick={() => sidebarTour.startTour(DemoTourStep.SIDEBAR_PROJECTS)}
      >
        Start Sidebar
      </button>
      <button
        data-testid="start-issues"
        onClick={() => issuesTour.startTour(DemoTourStep.ISSUES_STREAM)}
      >
        Start Issues
      </button>
      <button data-testid="end-sidebar" onClick={() => sidebarTour.endTour()}>
        End Sidebar
      </button>
      <button data-testid="end-issues" onClick={() => issuesTour.endTour()}>
        End Issues
      </button>
    </div>
  );
}

describe('DemoTourProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
    cleanup();
  });
  it('renders children', () => {
    render(
      <DemoTourProvider>
        <div data-testid="child-component">Test Child</div>
      </DemoTourProvider>
    );

    expect(screen.getByTestId('child-component')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('maintains separate state for different tours', async () => {
    // Mock the setState function to track updates
    const mockSetState = jest.fn();
    mockUseLocalStorageState.mockReturnValue([
      {
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
          orderedStepIds: [DemoTourStep.RELEASES_COMPARE, DemoTourStep.RELEASES_DETAILS],
          isRegistered: true,
          tourKey: DemoTour.RELEASES,
        },
        [DemoTour.PERFORMANCE]: {
          currentStepId: null,
          isCompleted: false,
          orderedStepIds: [
            DemoTourStep.PERFORMANCE_TABLE,
            DemoTourStep.PERFORMANCE_TRANSACTION_SUMMARY,
          ],
          isRegistered: true,
          tourKey: DemoTour.PERFORMANCE,
        },
      },
      mockSetState,
    ]);

    render(
      <DemoTourProvider>
        <MultiTourTester />
      </DemoTourProvider>
    );

    // Initially all tours should be inactive
    expect(screen.queryByTestId('sidebar-step')).toBeUndefined();
    expect(screen.queryByTestId('issues-step')).toBeUndefined();
    expect(screen.queryByTestId('releases-step')).toBeUndefined();
    expect(screen.queryByTestId('performance-step')).toBeUndefined();

    // Start sidebar tour
    await userEvent.click(screen.getByTestId('start-sidebar'));

    // Verify setState was called with the correct update
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        [DemoTour.SIDEBAR]: expect.objectContaining({
          currentStepId: DemoTourStep.SIDEBAR_PROJECTS,
        }),
      })
    );

    // Now start issues tour
    await userEvent.click(screen.getByTestId('start-issues'));

    // Verify both tours have different state
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        [DemoTour.ISSUES]: expect.objectContaining({
          currentStepId: DemoTourStep.ISSUES_STREAM,
        }),
      })
    );

    // End sidebar tour
    await userEvent.click(screen.getByTestId('end-sidebar'));

    // Verify only sidebar tour is marked completed
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        [DemoTour.SIDEBAR]: expect.objectContaining({
          currentStepId: null,
          isCompleted: true,
        }),
        // Issues tour should not be in this update
      })
    );

    // End issues tour
    await userEvent.click(screen.getByTestId('end-issues'));

    // Verify issues tour is now completed
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        [DemoTour.ISSUES]: expect.objectContaining({
          currentStepId: null,
          isCompleted: true,
        }),
      })
    );

    // Verify recordFinish was called for both tours
    expect(recordFinish).toHaveBeenCalledWith(
      DemoTour.SIDEBAR,
      expect.any(String),
      expect.any(String),
      expect.anything()
    );

    expect(recordFinish).toHaveBeenCalledWith(
      DemoTour.ISSUES,
      expect.any(String),
      expect.any(String),
      expect.anything()
    );
  });
});
