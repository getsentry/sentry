import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import TeamDetails from 'sentry/views/settings/organizationTeams/teamDetails';

describe('TeamMembers', () => {
  let joinMock: any;

  const organization = OrganizationFixture();
  const team = TeamFixture({hasAccess: false});
  const teamHasAccess = TeamFixture({id: '1337', slug: 'django', hasAccess: true});

  beforeEach(() => {
    TeamStore.init();
    TeamStore.loadInitialData([team, teamHasAccess]);
    joinMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/me/teams/${team.slug}/`,
      method: 'POST',
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    TeamStore.reset();
  });

  it('can request membership', async () => {
    render(
      <TeamDetails>
        <div data-test-id="test" />
      </TeamDetails>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/settings/${organization.slug}/teams/${team.slug}/`,
          },
          route: '/settings/:orgId/teams/:teamId/',
        },
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Request Access'}));
    expect(joinMock).toHaveBeenCalled();

    expect(screen.queryByTestId('test')).not.toBeInTheDocument();
  });

  it('displays children', async () => {
    render(
      <TeamDetails>
        <div data-test-id="test" />
      </TeamDetails>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/settings/${organization.slug}/teams/${teamHasAccess.slug}/`,
          },
          route: '/settings/:orgId/teams/:teamId/',
        },
      }
    );

    expect(await screen.findByTestId('test')).toBeInTheDocument();
  });
});
