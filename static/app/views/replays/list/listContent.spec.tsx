import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {
  useHaveSelectedProjectsSentAnyReplayEvents,
  useReplayOnboardingSidebarPanel,
} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import ListPage from 'sentry/views/replays/list/listContent';

jest.mock('sentry/utils/replays/hooks/useDeadRageSelectors');
jest.mock('sentry/utils/replays/hooks/useReplayOnboarding');
jest.mock('sentry/utils/replays/hooks/useReplayPageview');
jest.mock('sentry/utils/useProjectSdkNeedsUpdate');
jest.mock('sentry/views/replays/detail/useAllMobileProj');

const mockUseDeadRageSelectors = jest.mocked(useDeadRageSelectors);
mockUseDeadRageSelectors.mockReturnValue({
  isLoading: false,
  isError: false,
  data: [],
  pageLinks: undefined,
});

const mockUseHaveSelectedProjectsSentAnyReplayEvents = jest.mocked(
  useHaveSelectedProjectsSentAnyReplayEvents
);
const mockUseProjectSdkNeedsUpdate = jest.mocked(useProjectSdkNeedsUpdate);

const mockUseReplayOnboardingSidebarPanel = jest.mocked(useReplayOnboardingSidebarPanel);
mockUseReplayOnboardingSidebarPanel.mockReturnValue({activateSidebar: jest.fn()});

const mockUseAllMobileProj = jest.mocked(useAllMobileProj);
mockUseAllMobileProj.mockReturnValue({allMobileProj: false});

const AM1_FEATURES: string[] = [];
const AM2_FEATURES: string[] = ['session-replay'];

function getMockOrganizationFixture({features}: {features: string[]}) {
  const mockOrg = OrganizationFixture({
    features,
    access: [],
  });

  return mockOrg;
}

describe('ReplayList', () => {
  let mockFetchReplayListRequest: jest.Mock;
  beforeEach(() => {
    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockClear();
    mockUseProjectSdkNeedsUpdate.mockClear();
    mockUseDeadRageSelectors.mockClear();
    // mockUseAllMobileProj.mockClear();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    mockFetchReplayListRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/replays/`,
      body: {},
    });
    // Request made by SearchQueryBuilder:
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
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
      organization: mockOrg,
    });

    await screen.findByText('Get to the root cause faster');
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
      organization: mockOrg,
    });

    await screen.findByText('Get to the root cause faster');
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
      organization: mockOrg,
    });

    await screen.findByText('Get to the root cause faster');
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
      organization: mockOrg,
    });

    await waitFor(() => {
      expect(screen.getByText('Introducing Rage and Dead Clicks')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('replay-table')).toBeInTheDocument();
    expect(mockFetchReplayListRequest).toHaveBeenCalled();
  });

  it('should fetch the replay table when the org is on AM2, has sent some replays, and has a newer SDK version', async () => {
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

    render(<ListPage />, {
      organization: mockOrg,
    });

    await waitFor(() => expect(screen.queryAllByTestId('replay-table')).toHaveLength(1));

    expect(mockFetchReplayListRequest).toHaveBeenCalled();
  });
});
