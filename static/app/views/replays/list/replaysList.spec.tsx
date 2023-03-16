import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Organization} from 'sentry/types';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {
  useHaveSelectedProjectsSentAnyReplayEvents,
  useReplayOnboardingSidebarPanel,
} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useOrganization from 'sentry/utils/useOrganization';

import ReplayList from './replaysList';

jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/utils/replays/hooks/useReplayOnboarding');
jest.mock('sentry/utils/replays/hooks/useReplayList', () => {
  return {
    __esModule: true,
    default: jest.fn(() => {
      return {
        fetchError: undefined,
        isFetching: false,
        pageLinks: null,
        replays: [],
      };
    }),
  };
});

const mockUseReplayList = useReplayList as jest.MockedFunction<typeof useReplayList>;
const mockUseOrganization = useOrganization as jest.MockedFunction<
  typeof useOrganization
>;

const mockUseHaveSelectedProjectsSentAnyReplayEvents =
  useHaveSelectedProjectsSentAnyReplayEvents as jest.MockedFunction<
    typeof useHaveSelectedProjectsSentAnyReplayEvents
  >;
const mockUseReplayOnboardingSidebarPanel =
  useReplayOnboardingSidebarPanel as jest.MockedFunction<
    typeof useReplayOnboardingSidebarPanel
  >;
mockUseReplayOnboardingSidebarPanel.mockReturnValue({activateSidebar: jest.fn()});

const AM1_FEATURES = [];
const AM2_FEATURES = ['session-replay'];

function getMockOrganization({features}: {features: string[]}) {
  const mockOrg = TestStubs.Organization({
    features,
    access: [],
  });

  mockUseOrganization.mockReturnValue(mockOrg);

  return mockOrg;
}

function getMockContext(mockOrg: Organization) {
  return TestStubs.routerContext([{organization: mockOrg}]);
}

describe('ReplayList', () => {
  beforeEach(() => {
    mockUseReplayList.mockClear();
  });

  it('should render the onboarding panel when the org is on AM1', async () => {
    const mockOrg = getMockOrganization({features: AM1_FEATURES});
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockReturnValue({
      fetching: false,
      hasSentOneReplay: false,
    });

    render(<ReplayList />, {
      context: getMockContext(mockOrg),
    });

    await waitFor(() =>
      expect(screen.getByText('Get to the root cause faster')).toBeInTheDocument()
    );
    expect(mockUseReplayList).not.toHaveBeenCalled();
  });

  it('should render the onboarding panel when the org is on AM1 and has sent some replays', async () => {
    const mockOrg = getMockOrganization({features: AM1_FEATURES});
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockReturnValue({
      fetching: false,
      hasSentOneReplay: true,
    });

    render(<ReplayList />, {
      context: getMockContext(mockOrg),
    });

    await waitFor(() =>
      expect(screen.getByText('Get to the root cause faster')).toBeInTheDocument()
    );
    expect(mockUseReplayList).not.toHaveBeenCalled();
  });

  it('should render the onboarding panel when the org is on AM2 and has never sent a replay', async () => {
    const mockOrg = getMockOrganization({features: AM2_FEATURES});
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockReturnValue({
      fetching: false,
      hasSentOneReplay: false,
    });

    render(<ReplayList />, {
      context: getMockContext(mockOrg),
    });

    await waitFor(() =>
      expect(screen.getByText('Get to the root cause faster')).toBeInTheDocument()
    );
    expect(mockUseReplayList).not.toHaveBeenCalled();
  });

  it('should fetch the replay table when the org is on AM2 and sent some replays', async () => {
    const mockOrg = getMockOrganization({features: AM2_FEATURES});
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockReturnValue({
      fetching: false,
      hasSentOneReplay: true,
    });

    render(<ReplayList />, {
      context: getMockContext(mockOrg),
    });

    await waitFor(() => expect(screen.getByTestId('replay-table')).toBeInTheDocument());
    expect(mockUseReplayList).toHaveBeenCalledTimes(1);
  });
});
