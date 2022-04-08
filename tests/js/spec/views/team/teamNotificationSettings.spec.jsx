import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';

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
  let team;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    team = TestStubs.Team();
  });

  it('should render empty message when there are no integrations', () => {
    const {organization, routerContext} = initializeOrg();

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

    const wrapper = mountWithTheme(
      <TeamNotificationSettings team={team} organization={organization} />,
      routerContext
    );

    const emptyMessage = wrapper.find('Panel div[data-test-id="empty-message"]');
    expect(emptyMessage).toHaveLength(1);
    expect(emptyMessage.text()).toBe(
      'No Notification Integrations have been installed yet.'
    );
  });

  it('should render empty message when there are no externalTeams', () => {
    const {organization, routerContext} = initializeOrg();

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

    const wrapper = mountWithTheme(
      <TeamNotificationSettings team={team} organization={organization} />,
      routerContext
    );

    const emptyMessage = wrapper.find('Panel div[data-test-id="empty-message"]');
    expect(emptyMessage).toHaveLength(1);
    expect(emptyMessage.find('div div div').first().text()).toBe(
      'No teams have been linked yet.'
    );
  });

  it('should render each externalTeam', () => {
    const {organization, routerContext} = initializeOrg();

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

    const wrapper = mountWithTheme(
      <TeamNotificationSettings team={team} organization={organization} />,
      routerContext
    );
    const input = wrapper.find('Panel').last().find('input');

    expect(input.prop('disabled')).toBe(true);
    expect(input.prop('value')).toBe(EXTERNAL_NAME);
    expect(wrapper.find('button[aria-label="delete"]').exists()).toBe(true);
  });

  it('should delete be able to delete the externalTeam', async () => {
    const {organization, routerContext} = initializeOrg();

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

    const wrapper = mountWithTheme(
      <TeamNotificationSettings team={team} organization={organization} />,
      routerContext
    );

    const deleteButton = wrapper.find('button[aria-label="delete"]');
    expect(deleteButton.prop('disabled')).toBe(false);

    deleteButton.simulate('click');

    await tick();

    const modal = await mountGlobalModal();
    const confirmBtn = modal.find('Button').last().simulate('click');
    expect(confirmBtn.exists()).toBe(true);

    confirmBtn.simulate('click');

    expect(deleteMock).toHaveBeenCalled();
  });
});
