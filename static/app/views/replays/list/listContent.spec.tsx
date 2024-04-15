import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization as TOrganization} from 'sentry/types';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {
  useHaveSelectedProjectsSentAnyReplayEvents,
  useReplayOnboardingSidebarPanel,
} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import ListPage from 'sentry/views/replays/list/listContent';

jest.mock('sentry/utils/replays/hooks/useDeadRageSelectors');
jest.mock('sentry/utils/replays/hooks/useReplayOnboarding');
jest.mock('sentry/utils/replays/hooks/useReplayPageview');
jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/utils/useProjectSdkNeedsUpdate');

const mockUseDeadRageSelectors = jest.mocked(useDeadRageSelectors);

const mockUseHaveSelectedProjectsSentAnyReplayEvents = jest.mocked(
  useHaveSelectedProjectsSentAnyReplayEvents
);
const mockUseProjectSdkNeedsUpdate = jest.mocked(useProjectSdkNeedsUpdate);
const mockUseReplayOnboardingSidebarPanel = jest.mocked(useReplayOnboardingSidebarPanel);

mockUseReplayOnboardingSidebarPanel.mockReturnValue({activateSidebar: jest.fn()});

const AM1_FEATURES = [];
const AM2_FEATURES = ['session-replay'];

function getMockOrganizationFixture({features}: {features: string[]}) {
  const mockOrg = OrganizationFixture({
    features,
    access: [],
  });

  jest.mocked(useOrganization).mockReturnValue(mockOrg);

  return mockOrg;
}

function getMockContext(mockOrg: TOrganization) {
  return RouterContextFixture([{organization: mockOrg}]);
}

describe('ReplayList', () => {
  let mockFetchReplayListRequest;
  beforeEach(() => {
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockClear();
    mockUseProjectSdkNeedsUpdate.mockClear();
    mockUseDeadRageSelectors.mockClear();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    mockFetchReplayListRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/replays/`,
      body: {},
    });
  });

  it('should render the onboarding panel when the org is on AM1', async () => {
    const mockOrg = getMockOrganizationFixture({features: AM1_FEATURES});
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
    expect(mockFetchReplayListRequest).not.toHaveBeenCalled();
  });

  it('should render the onboarding panel when the org is on AM1 and has sent some replays', async () => {
    const mockOrg = getMockOrganizationFixture({features: AM1_FEATURES});
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
    expect(mockFetchReplayListRequest).not.toHaveBeenCalled();
  });

  it('should render the onboarding panel when the org is on AM2 and has never sent a replay', async () => {
    const mockOrg = getMockOrganizationFixture({features: AM2_FEATURES});
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
    expect(mockFetchReplayListRequest).not.toHaveBeenCalled();
  });

  it('should render the rage-click sdk update banner when the org is AM2, has sent replays, but the sdk version is low', async () => {
    const mockOrg = getMockOrganizationFixture({features: AM2_FEATURES});
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockReturnValue({
      fetching: false,
      hasSentOneReplay: true,
    });
    mockUseProjectSdkNeedsUpdate.mockReturnValue({
      isError: false,
      isFetching: false,
      needsUpdate: true,
    });

    render(<ListPage />, {
      context: getMockContext(mockOrg),
    });

    await waitFor(() => {
      expect(screen.queryByText('Introducing Rage and Dead Clicks')).toBeInTheDocument();
      expect(screen.queryByTestId('replay-table')).toBeInTheDocument();
    });
    expect(mockFetchReplayListRequest).toHaveBeenCalled();
  });

  it('should fetch the replay table and show selector tables when the org is on AM2, has sent some replays, and has a newer SDK version', async () => {
    const mockOrg = getMockOrganizationFixture({features: AM2_FEATURES});
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockReturnValue({
      fetching: false,
      hasSentOneReplay: true,
    });
    mockUseProjectSdkNeedsUpdate.mockReturnValue({
      isError: false,
      isFetching: false,
      needsUpdate: false,
    });
    mockUseDeadRageSelectors.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
      pageLinks: undefined,
    });

    render(<ListPage />, {
      context: getMockContext(mockOrg),
    });

    await waitFor(() => expect(screen.queryAllByTestId('replay-table')).toHaveLength(1));
    await waitFor(() =>
      expect(screen.queryAllByTestId('selector-widget')).toHaveLength(2)
    );
    expect(mockFetchReplayListRequest).toHaveBeenCalled();
  });
});
