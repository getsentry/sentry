import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import TeamNotificationSettings from 'sentry/views/settings/organizationTeams/teamNotifications';

const EXTERNAL_NAME = 'marcos';
const EXAMPLE_EXTERNAL_TEAM = {
  externalName: EXTERNAL_NAME,
  id: '1',
  integrationId: '1',
  provider: 'slack',
};
const EXAMPLE_INTEGRATION = {
  id: '1',
  provider: {
    key: 'slack',
  },
};

describe('TeamNotificationSettings', () => {
  const {organization, routerContext, routerProps} = initializeOrg();
  const team = TeamFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should render empty message when there are no integrations', () => {
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/`,
      body: {
        externalTeams: [EXAMPLE_EXTERNAL_TEAM],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [],
    });

    render(
      <TeamNotificationSettings
        {...routerProps}
        team={team}
        params={{teamId: team.id}}
        organization={organization}
      />,
      {context: routerContext}
    );

    expect(
      screen.getByText('No Notification Integrations have been installed yet.')
    ).toBeInTheDocument();
  });

  it('should render empty message when there are no externalTeams', () => {
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/`,
      body: {
        externalTeams: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [EXAMPLE_INTEGRATION],
    });

    render(
      <TeamNotificationSettings
        {...routerProps}
        team={team}
        params={{teamId: team.id}}
        organization={organization}
      />,
      {
        context: routerContext,
      }
    );

    expect(screen.getByText('No teams have been linked yet.')).toBeInTheDocument();
  });

  it('should render each externalTeam', () => {
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/`,
      body: {
        externalTeams: [EXAMPLE_EXTERNAL_TEAM],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [EXAMPLE_INTEGRATION],
    });

    render(
      <TeamNotificationSettings
        {...routerProps}
        team={team}
        params={{teamId: team.id}}
        organization={organization}
      />,
      {
        context: routerContext,
      }
    );

    const input = screen.getByRole('textbox', {
      name: 'Unlink this channel in slack with `/slack unlink team`',
    });

    expect(input).toBeDisabled();
    expect(input).toHaveValue(EXTERNAL_NAME);
    expect(screen.getByRole('button', {name: 'delete'})).toBeInTheDocument();
  });

  it('should delete be able to delete the externalTeam', async () => {
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/`,
      body: {
        externalTeams: [EXAMPLE_EXTERNAL_TEAM],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [EXAMPLE_INTEGRATION],
    });

    const deleteMock = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/external-teams/${EXAMPLE_EXTERNAL_TEAM.id}/`,
      status: 204,
      method: 'DELETE',
    });

    render(
      <TeamNotificationSettings
        {...routerProps}
        team={team}
        params={{teamId: team.id}}
        organization={organization}
      />,
      {
        context: routerContext,
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'delete'}));

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
  });
});
