import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Organization} from 'sentry/types';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {
  useHaveSelectedProjectsSentAnyReplayEvents,
  useReplayOnboardingSidebarPanel,
} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import ListPage from 'sentry/views/replays/list/listContent';

jest.mock('sentry/utils/replays/hooks/useReplayOnboarding');
jest.mock('sentry/utils/replays/hooks/useReplayPageview');
jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/utils/useProjectSdkNeedsUpdate');
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

const mockUseReplayList = jest.mocked(useReplayList);

const mockUseHaveSelectedProjectsSentAnyReplayEvents = jest.mocked(
  useHaveSelectedProjectsSentAnyReplayEvents
);
const mockUseProjectSdkNeedsUpdate = jest.mocked(useProjectSdkNeedsUpdate);
const mockUseReplayOnboardingSidebarPanel = jest.mocked(useReplayOnboardingSidebarPanel);

mockUseReplayOnboardingSidebarPanel.mockReturnValue({activateSidebar: jest.fn()});

const AM1_FEATURES = [];
const AM2_FEATURES = ['session-replay'];

function getMockOrganization({features}: {features: string[]}) {
  const mockOrg = TestStubs.Organization({
    features,
    access: [],
  });

  jest.mocked(useOrganization).mockReturnValue(mockOrg);

  return mockOrg;
}

function getMockContext(mockOrg: Organization) {
  return TestStubs.routerContext([{organization: mockOrg}]);
}

describe('ReplayList', () => {
  beforeEach(() => {
    mockUseReplayList.mockClear();
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockClear();
    mockUseProjectSdkNeedsUpdate.mockClear();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
  });

  it('should render the onboarding panel when the org is on AM1', async () => {
    const mockOrg = getMockOrganization({features: AM1_FEATURES});
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockReturnValue({
      fetching: false,
      hasSentOneReplay: false,
    });
    mockUseProjectSdkNeedsUpdate.mockReturnValue({
      isError: false,
      isFetching: false,
      needsUpdate: false,
    });

    render(<ListPage />, {
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
    mockUseProjectSdkNeedsUpdate.mockReturnValue({
      isError: false,
      isFetching: false,
      needsUpdate: false,
    });

    render(<ListPage />, {
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
    mockUseProjectSdkNeedsUpdate.mockReturnValue({
      isError: false,
      isFetching: false,
      needsUpdate: false,
    });

    render(<ListPage />, {
      context: getMockContext(mockOrg),
    });

    await waitFor(() =>
      expect(screen.getByText('Get to the root cause faster')).toBeInTheDocument()
    );
    expect(mockUseReplayList).not.toHaveBeenCalled();
  });

  it('should render the rage-click sdk update banner when the org is AM2, has sent replays, but the sdk version is low', async () => {
    const mockOrg = getMockOrganization({features: AM2_FEATURES});
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockReturnValue({
      fetching: false,
      hasSentOneReplay: true,
    });
    mockUseProjectSdkNeedsUpdate.mockReturnValue({
      isError: false,
      isFetching: false,
      needsUpdate: true,
    });
    mockUseReplayList.mockReturnValue({
      replays: [],
      isFetching: false,
      fetchError: undefined,
      pageLinks: null,
    });

    render(<ListPage />, {
      context: getMockContext(mockOrg),
    });

    await waitFor(() => {
      expect(screen.queryByText('Introducing Rage and Dead Clicks')).toBeInTheDocument();
      expect(screen.queryByTestId('replay-table')).toBeInTheDocument();
    });
    expect(mockUseReplayList).toHaveBeenCalled();
  });

  it('should fetch the replay table and show dead/rage tables when the org is on AM2, has sent some replays, and has a newer SDK version', async () => {
    const mockOrg = getMockOrganization({features: AM2_FEATURES});
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockReturnValue({
      fetching: false,
      hasSentOneReplay: true,
    });
    mockUseProjectSdkNeedsUpdate.mockReturnValue({
      isError: false,
      isFetching: false,
      needsUpdate: false,
    });
    mockUseReplayList.mockReturnValue({
      replays: [],
      isFetching: false,
      fetchError: undefined,
      pageLinks: null,
    });

    render(<ListPage />, {
      context: getMockContext(mockOrg),
    });

    await waitFor(() => expect(screen.queryAllByTestId('replay-table')).toHaveLength(3));
    expect(mockUseReplayList).toHaveBeenCalled();
  });
});
