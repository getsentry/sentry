import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {
  useHaveSelectedProjectsSentAnyReplayEvents,
  useReplayOnboardingSidebarPanel,
} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import ListPage from 'sentry/views/replays/list';

jest.mock('sentry/utils/replays/hooks/useDeadRageSelectors');
jest.mock('sentry/utils/replays/hooks/useReplayOnboarding');
jest.mock('sentry/utils/replays/hooks/useReplayPageview');
jest.mock('sentry/utils/useProjectSdkNeedsUpdate');
jest.mock('sentry/views/replays/detail/useAllMobileProj');

const mockUseDeadRageSelectors = jest.mocked(useDeadRageSelectors);
mockUseDeadRageSelectors.mockReturnValue({
  isLoading: false,
  isError: false,
  error: null,
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
  const user = UserFixture({id: '1'});

  beforeEach(() => {
    ConfigStore.set('user', user);
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    mockUseHaveSelectedProjectsSentAnyReplayEvents.mockClear();
    mockUseProjectSdkNeedsUpdate.mockClear();
    mockUseDeadRageSelectors.mockClear();
    mockUseAllMobileProj.mockClear();
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

  it('should not render the rage click cards when the sdk version is not up to date', async () => {
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

    await screen.findByTestId('replay-table');
    expect(screen.queryByText('Most Dead Clicks')).not.toBeInTheDocument();
    expect(screen.queryByText('Most Rage Clicks')).not.toBeInTheDocument();
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

  it('should show access denied when user does not have granular replay permissions', async () => {
    const mockOrg = OrganizationFixture({
      features: [...AM2_FEATURES, 'granular-replay-permissions'],
      hasGranularReplayPermissions: true,
      replayAccessMembers: [999], // User ID 1 is not in this list
    });
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

    expect(
      await screen.findByText("You don't have access to this feature")
    ).toBeInTheDocument();
    expect(mockFetchReplayListRequest).not.toHaveBeenCalled();
  });
});
