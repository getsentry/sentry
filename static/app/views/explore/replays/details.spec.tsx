import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

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

  function renderDetails() {
    return render(<ReplayDetails />, {
      organization: OrganizationFixture({features: ['session-replay']}),
      initialRouterConfig,
      additionalWrapper: TopBarWrapper,
    });
  }

  let writeText: jest.SpiedFunction<typeof navigator.clipboard.writeText>;

  async function openReplayActions() {
    await userEvent.click(screen.getByRole('button', {name: 'Replay Actions'}));
    return await screen.findByRole('menu');
  }

  function setEmployeeUser() {
    ConfigStore.set(
      'user',
      UserFixture({
        id: '1',
        emails: [{id: '1', email: 'someone@sentry.io', is_verified: true}],
      })
    );
  }

  beforeEach(() => {
    ConfigStore.set('user', user);
    userEvent.setup();
    writeText = jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    mockUseLoadReplayReader.mockClear();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replays/test-replay-id/',
      body: {
        data: {
          id: 'test-replay-id',
          started_at: '2022-09-22T16:58:39Z',
          finished_at: '2022-09-22T17:00:03Z',
          count_segments: 14,
        },
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
    // Should render the replay identifier in the standard page-title crumb.
    expect(screen.getByText('test-rep')).toBeInTheDocument();
    // Should fetch replay data
    expect(mockUseLoadReplayReader).toHaveBeenCalled();
  });

  it('renders pagination chevrons in the replay crumb', () => {
    renderDetails();

    expect(
      screen.getByRole('button', {name: 'Previous replay based on search query'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Next replay based on search query'})
    ).toBeInTheDocument();
  });

  it('offers the replay actions from the title menu', async () => {
    renderDetails();
    const menu = await openReplayActions();

    for (const name of [
      'Copy replay ID to clipboard',
      'Share',
      'Download JSON',
      'Delete',
      'Configure Replay',
    ]) {
      expect(within(menu).getByRole('menuitemradio', {name})).toBeVisible();
    }

    expect(
      screen.queryByRole('button', {name: 'Copy link to replay at current timestamp'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', {name: 'Sentry Employee Features'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Download Replay Record'})
    ).not.toBeInTheDocument();
  });

  it('lists the actions in the order the design calls for', async () => {
    setEmployeeUser();
    renderDetails();
    await openReplayActions();

    expect(
      screen.getAllByRole('menuitemradio').map(el => el.textContent?.trim())
    ).toEqual([
      'Copy replay ID to clipboard',
      'Share',
      'Download JSON',
      'Delete',
      'Configure Replay',
      expect.stringContaining('Download Replay Record'),
      expect.stringContaining('Sentry Replay Debugger'),
    ]);
  });

  it('copies the full replay ID, not the shortened form in the title', async () => {
    renderDetails();

    expect(screen.getByText('test-rep')).toBeVisible();

    await openReplayActions();
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: 'Copy replay ID to clipboard'})
    );

    expect(writeText).toHaveBeenCalledWith('test-replay-id');
  });

  it('shows employee actions in a separate section', async () => {
    setEmployeeUser();
    renderDetails();
    await openReplayActions();

    const section = screen.getByRole('group', {name: 'Sentry Employee Features'});

    expect(
      within(section).getByRole('menuitemradio', {name: 'Download Replay Record'})
    ).toBeVisible();
    expect(
      within(section).getByRole('menuitemradio', {name: /Sentry Replay Debugger/})
    ).toBeVisible();
    expect(
      within(section).queryByRole('menuitemradio', {name: 'Download JSON'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Sentry Employee Features'})
    ).not.toBeInTheDocument();
  });

  it('nests the configure docs behind a submenu', async () => {
    renderDetails();

    await userEvent.click(screen.getByRole('button', {name: 'Replay Actions'}));
    await userEvent.hover(
      await screen.findByRole('menuitemradio', {name: 'Configure Replay'})
    );

    expect(
      await screen.findByRole('menuitemradio', {name: /General/})
    ).toBeInTheDocument();
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
