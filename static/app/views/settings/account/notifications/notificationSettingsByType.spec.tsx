import {Organization} from 'sentry-fixture/organization';
import {OrganizationIntegrations} from 'sentry-fixture/organizationIntegrations';
import {UserIdentity} from 'sentry-fixture/userIdentity';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {OrganizationIntegration} from 'sentry/types/integrations';
import {NotificationSettingsObject} from 'sentry/views/settings/account/notifications/constants';
import NotificationSettingsByType from 'sentry/views/settings/account/notifications/notificationSettingsByType';
import {Identity} from 'sentry/views/settings/account/notifications/types';

function renderMockRequests(
  notificationSettings: NotificationSettingsObject,
  identities: Identity[] = [],
  organizationIntegrations: OrganizationIntegration[] = []
) {
  MockApiClient.addMockResponse({
    url: '/users/me/notification-settings/',
    method: 'GET',
    body: notificationSettings,
  });

  MockApiClient.addMockResponse({
    url: '/users/me/identities/',
    method: 'GET',
    body: identities,
  });

  MockApiClient.addMockResponse({
    url: '/users/me/organization-integrations/',
    method: 'GET',
    body: organizationIntegrations,
  });

  MockApiClient.addMockResponse({
    url: `/projects/`,
    method: 'GET',
    body: [],
  });
}

function renderComponent(
  notificationSettings: NotificationSettingsObject,
  identities: Identity[] = [],
  organizationIntegrations: OrganizationIntegration[] = []
) {
  const org = Organization();
  renderMockRequests(notificationSettings, identities, organizationIntegrations);

  render(<NotificationSettingsByType notificationType="alerts" organizations={[org]} />);
}

describe('NotificationSettingsByType', function () {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('should render when everything is disabled', function () {
    renderComponent({
      alerts: {user: {me: {email: 'never', slack: 'never'}}},
    });

    // There is only one field and it is the default and it is set to "off".
    expect(screen.getByRole('textbox', {name: 'Issue Alerts'})).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('should render when notification settings are enabled', function () {
    renderComponent({
      alerts: {user: {me: {email: 'always', slack: 'always'}}},
    });

    expect(screen.getByRole('textbox', {name: 'Issue Alerts'})).toBeInTheDocument();
    expect(screen.getByText('On')).toBeInTheDocument(); // Select Value

    expect(screen.getByRole('textbox', {name: 'Delivery Method'})).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument(); // Select Value
    expect(screen.getByText('Slack')).toBeInTheDocument(); // Select Value
  });

  it('should render warning modal when identity not linked', function () {
    const org = Organization();

    renderComponent(
      {
        alerts: {user: {me: {email: 'always', slack: 'always'}}},
      },
      [],
      [OrganizationIntegrations()]
    );

    expect(
      screen.getByText(
        /You've selected Slack as your delivery method, but do not have a linked account for the following organizations/
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('listitem')).toHaveTextContent(org.slug);
  });

  it('should not render warning modal when identity is linked', function () {
    const org = Organization();

    renderComponent(
      {
        alerts: {user: {me: {email: 'always', slack: 'always'}}},
      },
      [UserIdentity()],
      [OrganizationIntegrations({organizationId: org.id})]
    );

    expect(
      screen.queryByText(
        /You've selected Slack as your delivery method, but do not have a linked account for the following organizations/
      )
    ).not.toBeInTheDocument();
  });

  it('should default to the subdomain org', async function () {
    const organization = Organization();
    const otherOrganization = Organization({
      id: '2',
      slug: 'other-org',
      name: 'other org',
    });
    ConfigStore.set('customerDomain', {
      ...ConfigStore.get('customerDomain')!,
      subdomain: otherOrganization.slug,
    });
    renderMockRequests({
      alerts: {user: {me: {email: 'always', slack: 'always'}}},
    });
    const projectsMock = MockApiClient.addMockResponse({
      url: '/projects/',
      query: {
        organizationId: otherOrganization.id,
      },
      method: 'GET',
      body: [],
    });

    render(
      <NotificationSettingsByType
        notificationType="alerts"
        organizations={[organization, otherOrganization]}
      />
    );
    expect(await screen.findByText(otherOrganization.name)).toBeInTheDocument();
    expect(projectsMock).toHaveBeenCalledTimes(1);
  });
});
