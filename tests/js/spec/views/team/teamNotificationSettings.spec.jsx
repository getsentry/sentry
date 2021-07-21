import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import TeamNotificationSettings from 'app/views/settings/organizationTeams/teamNotifications';

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
  });
});
