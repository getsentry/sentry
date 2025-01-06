import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import type {ExternalTeam} from 'sentry/types/integrations';
import TeamNotificationSettings from 'sentry/views/settings/organizationTeams/teamNotifications';

const EXTERNAL_NAME = 'marcos';
const EXAMPLE_EXTERNAL_TEAM: ExternalTeam = {
  externalName: EXTERNAL_NAME,
  id: '1',
  integrationId: '1',
  provider: 'slack',
  teamId: '1',
};
const EXAMPLE_INTEGRATION = {
  id: '1',
  provider: {
    key: 'slack',
  },
};

describe('TeamNotificationSettings', () => {
  const teamWithExternalTeam = TeamFixture({
    externalTeams: [EXAMPLE_EXTERNAL_TEAM],
  });
  const teamWithoutExternalTeam = TeamFixture();
  const {organization, router} = initializeOrg({
    router: {params: {teamId: teamWithExternalTeam.slug}},
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should render empty message when there are no integrations', async () => {
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithExternalTeam.slug}/`,
      body: teamWithExternalTeam,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [],
    });

    render(<TeamNotificationSettings />, {router, organization});

    expect(
      await screen.findByText('No Notification Integrations have been installed yet.')
    ).toBeInTheDocument();
  });

  it('should render empty message when there are no externalTeams', async () => {
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithExternalTeam.slug}/`,
      body: teamWithoutExternalTeam,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [EXAMPLE_INTEGRATION],
    });

    render(<TeamNotificationSettings />, {router, organization});

    expect(await screen.findByText('No teams have been linked yet.')).toBeInTheDocument();
  });

  it('should render each externalTeam', async () => {
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithExternalTeam.slug}/`,
      body: teamWithExternalTeam,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [EXAMPLE_INTEGRATION],
    });

    render(<TeamNotificationSettings />, {router, organization});

    const input = await screen.findByRole('textbox', {
      name: 'Unlink this channel in slack with `/slack unlink team`',
    });

    expect(input).toBeDisabled();
    expect(input).toHaveValue(EXTERNAL_NAME);
    expect(screen.getByRole('button', {name: 'Unlink'})).toBeInTheDocument();
  });

  it('should delete be able to delete the externalTeam', async () => {
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithExternalTeam.slug}/`,
      body: teamWithExternalTeam,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [EXAMPLE_INTEGRATION],
    });

    const deleteMock = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithExternalTeam.slug}/external-teams/${EXAMPLE_EXTERNAL_TEAM.id}/`,
      status: 204,
      method: 'DELETE',
    });

    render(<TeamNotificationSettings />, {router, organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Unlink'}));

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
  });
});
