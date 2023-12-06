import {Organization} from 'sentry-fixture/organization';
import {Team} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import TeamDetails from 'sentry/views/settings/organizationTeams/teamDetails';

describe('TeamMembers', () => {
  let joinMock;

  const organization = Organization();
  const team = Team({hasAccess: false});
  const teamHasAccess = Team({id: '1337', slug: 'django', hasAccess: true});

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
    const {routerProps, routerContext} = initializeOrg({
      organization,
      router: {
        params: {orgId: organization.slug, teamId: team.slug},
      },
    });

    render(
      <TeamDetails {...routerProps}>
        <div data-test-id="test" />
      </TeamDetails>,
      {organization, context: routerContext}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Request Access'}));
    expect(joinMock).toHaveBeenCalled();

    expect(screen.queryByTestId('test')).not.toBeInTheDocument();
  });

  it('displays children', () => {
    const {routerContext, routerProps} = initializeOrg({
      organization,
      router: {
        params: {orgId: organization.slug, teamId: teamHasAccess.slug},
      },
    });
    render(
      <TeamDetails {...routerProps}>
        <div data-test-id="test" />
      </TeamDetails>,
      {organization, context: routerContext}
    );

    expect(screen.getByTestId('test')).toBeInTheDocument();
  });
});
