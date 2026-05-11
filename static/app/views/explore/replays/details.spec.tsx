import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {TopBar} from 'sentry/views/navigation/topBar';

import ReplayDetails from './details';

jest.mock('sentry/utils/replays/hooks/useLoadReplayReader');
jest.mock('sentry/utils/replays/hooks/useReplayPageview');

const mockUseLoadReplayReader = jest.mocked(useLoadReplayReader);
mockUseLoadReplayReader.mockReturnValue({
  attachments: [],
  errors: [],
  fetchError: undefined,
  attachmentError: undefined,
  isError: false,
  isPending: false,
  onRetry: jest.fn(),
  projectSlug: ProjectFixture().slug,
  replay: null,
  replayId: 'test-replay-id',
  replayRecord: ReplayRecordFixture({
    id: 'test-replay-id',
  }),
  status: 'success' as const,
});

function TopBarWrapper({children}: {children: ReactNode}) {
  return (
    <TopBar.Slot.Provider>
      <TopBar.Slot.Outlet name="title">
        {props => <div {...props} data-test-id="topbar-title-slot" />}
      </TopBar.Slot.Outlet>
      {children}
    </TopBar.Slot.Provider>
  );
}

describe('ReplayDetails', () => {
  const user = UserFixture({id: '1'});

  const initialRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/replays/test-replay-id/',
      query: {},
    },
    route: '/organizations/:orgId/replays/:replaySlug/',
  };

  beforeEach(() => {
    ConfigStore.set('user', user);
    mockUseLoadReplayReader.mockClear();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replays/test-replay-id/',
      body: {
        data: {
          id: 'test-replay-id',
        },
      },
    });
  });

  it('should render replay details when user has access', () => {
    const organization = OrganizationFixture({
      features: ['session-replay'],
    });

    render(<ReplayDetails />, {
      organization,
      initialRouterConfig,
      additionalWrapper: TopBarWrapper,
    });

    // Should not show access denied message
    expect(
      screen.queryByText("You don't have access to this feature")
    ).not.toBeInTheDocument();
    // Should render the replay details page content
    expect(screen.getByText('Session Replay')).toBeInTheDocument();
    // Should fetch replay data
    expect(mockUseLoadReplayReader).toHaveBeenCalled();
  });

  it('should show access denied and not fetch data when user does not have granular replay permissions', () => {
    const organization = OrganizationFixture({
      features: ['session-replay'],
      hasGranularReplayPermissions: true,
      replayAccessMembers: [999], // User ID 1 is not in this list
    });

    render(<ReplayDetails />, {
      organization,
      initialRouterConfig,
    });

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
    // Should not fetch replay data when user doesn't have access
    expect(mockUseLoadReplayReader).not.toHaveBeenCalled();
  });
});
