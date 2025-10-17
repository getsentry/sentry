import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import TeamDetails from 'sentry/views/settings/organizationTeams/teamDetails';

describe('TeamDetails', () => {
  let joinMock: any;

  const organization = OrganizationFixture();
  const teamNoAccess = TeamFixture({slug: 'flask', hasAccess: false});
  const teamHasAccess = TeamFixture({id: '1337', slug: 'django', hasAccess: true});

  beforeEach(() => {
    TeamStore.init();
    TeamStore.loadInitialData([teamNoAccess, teamHasAccess]);
    joinMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/me/teams/${teamNoAccess.slug}/`,
      method: 'POST',
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    TeamStore.reset();
  });

  it('can request membership', async () => {
    render(<TeamDetails />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/teams/${teamNoAccess.slug}/`,
        },
        route: '/settings/:orgId/teams/:teamId/',
      },
    });

    // No access - tabs are not shown
    expect(await screen.findByText('#flask')).toBeInTheDocument();
    expect(screen.queryByText('Members')).not.toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Request Access'}));
    expect(joinMock).toHaveBeenCalled();
  });

  it('renders tabs when team has access', async () => {
    render(<TeamDetails />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/teams/${teamHasAccess.slug}/`,
        },
        route: '/settings/:orgId/teams/:teamId/',
      },
    });

    // Has access - team name & tabs are shown
    expect(await screen.findByText('#django')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
