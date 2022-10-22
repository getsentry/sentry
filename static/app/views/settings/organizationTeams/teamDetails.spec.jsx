import {Organization} from 'fixtures/js-stubs/organization';
import {routerContext} from 'fixtures/js-stubs/routerContext';
import {Team} from 'fixtures/js-stubs/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import TeamStore from 'sentry/stores/teamStore';
import TeamDetails from 'sentry/views/settings/organizationTeams/teamDetails';

describe('TeamMembers', () => {
  let joinMock;

  const organization = Organization();
  const team = Team({hasAccess: false});
  const teamHasAccess = Team({id: '1337', slug: 'django', hasAccess: true});
  const context = routerContext();

  beforeEach(() => {
    TeamStore.init();
    TeamStore.loadInitialData([team, teamHasAccess]);
    joinMock = Client.addMockResponse({
      url: `/organizations/${organization.slug}/members/me/teams/${team.slug}/`,
      method: 'POST',
    });
  });

  afterEach(() => {
    Client.clearMockResponses();
    TeamStore.reset();
  });

  it('can request membership', () => {
    render(
      <TeamDetails params={{orgId: organization.slug, teamId: team.slug}}>
        <div data-test-id="test" />
      </TeamDetails>,
      {
        organization,
        context,
      }
    );

    userEvent.click(screen.getByRole('button', {name: 'Request Access'}));
    expect(joinMock).toHaveBeenCalled();

    expect(screen.queryByTestId('test')).not.toBeInTheDocument();
  });

  it('displays children', () => {
    render(
      <TeamDetails params={{orgId: organization.slug, teamId: teamHasAccess.slug}}>
        <div data-test-id="test" />
      </TeamDetails>,
      {
        organization,
        context,
      }
    );

    expect(screen.getByTestId('test')).toBeInTheDocument();
  });
});
