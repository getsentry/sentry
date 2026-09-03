import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

  beforeEach(() => {
    ConfigStore.set('user', user);
    mockUseLoadReplayReader.mockClear();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replays/test-replay-id/',
      body: {
        data: {
          id: 'test-replay-id',
          // The live-refresh poll maps this response into a replay record, so
          // it needs timestamps it can parse. Mirrors ReplayRecordFixture, and
          // matching `count_segments` keeps the refresh chip hidden.
          started_at: '2022-09-22T16:58:39Z',
          finished_at: '2022-09-22T17:00:03Z',
          count_segments: 14,
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

    await userEvent.click(screen.getByRole('button', {name: 'Replay Actions'}));

    expect(
      await screen.findByRole('menuitemradio', {name: 'Download JSON'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Share'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Configure Replay'})
    ).toBeInTheDocument();
    // Copying a link to the current timestamp is no longer offered.
    expect(
      screen.queryByRole('button', {name: 'Copy link to replay at current timestamp'})
    ).not.toBeInTheDocument();
    // The default viewer is not an employee, so that section is absent.
    expect(
      screen.queryByRole('group', {name: 'Sentry Employee Features'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Download Replay Record'})
    ).not.toBeInTheDocument();
  });

  it('groups the employee-only actions into their own section', async () => {
    // useIsSentryEmployee reads the user off ConfigStore, keyed on a verified
    // sentry.io address.
    ConfigStore.set(
      'user',
      UserFixture({
        id: '1',
        emails: [{id: '1', email: 'someone@sentry.io', is_verified: true}],
      })
    );

    renderDetails();

    await userEvent.click(screen.getByRole('button', {name: 'Replay Actions'}));

    const section = await screen.findByRole('group', {
      name: 'Sentry Employee Features',
    });
    // A section is a labelled group, not a selectable row of its own.
    expect(
      screen.queryByRole('menuitemradio', {name: 'Sentry Employee Features'})
    ).not.toBeInTheDocument();

    expect(
      await screen.findByRole('menuitemradio', {name: 'Download Replay Record'})
    ).toBeInTheDocument();
    expect(section).toContainElement(
      screen.getByRole('menuitemradio', {name: 'Download Replay Record'})
    );
    expect(section).toContainElement(
      screen.getByRole('menuitemradio', {name: /Sentry Replay Debugger/})
    );

    // The actions everyone sees stay outside the section.
    expect(section).not.toContainElement(
      screen.getByRole('menuitemradio', {name: 'Download JSON'})
    );

    // The section sits last, after the shared actions and the configure submenu.
    expect(
      screen.getAllByRole('menuitemradio').map(el => el.textContent?.trim())
    ).toEqual([
      'Download JSON',
      'Share',
      'Delete',
      'Configure Replay',
      expect.stringContaining('Download Replay Record'),
      expect.stringContaining('Sentry Replay Debugger'),
    ]);
  });

  it('nests the configure docs behind a submenu', async () => {
    renderDetails();

    await userEvent.click(screen.getByRole('button', {name: 'Replay Actions'}));
    // Submenus open on hover, not on click.
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
