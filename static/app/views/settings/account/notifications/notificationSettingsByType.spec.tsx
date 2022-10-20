import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

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
    url: '/projects/',
    method: 'GET',
    body: [],
  });
}

function renderComponent(
  notificationSettings: NotificationSettingsObject,
  identities: Identity[] = [],
  organizationIntegrations: OrganizationIntegration[] = []
) {
  const {routerContext} = initializeOrg();
  const org = TestStubs.Organization();
  renderMockRequests(notificationSettings, identities, organizationIntegrations);

  render(<NotificationSettingsByType notificationType="alerts" organizations={[org]} />, {
    context: routerContext,
  });
}

describe('NotificationSettingsByType', function () {
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
    const org = TestStubs.Organization();

    renderComponent(
      {
        alerts: {user: {me: {email: 'always', slack: 'always'}}},
      },
      [],
      [TestStubs.OrganizationIntegrations()]
    );

    expect(
      screen.getByText(
        /You've selected Slack as your delivery method, but do not have a linked account for the following organizations/
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('listitem')).toHaveTextContent(org.slug);
  });

  it('should not render warning modal when identity is linked', function () {
    const org = TestStubs.Organization();

    renderComponent(
      {
        alerts: {user: {me: {email: 'always', slack: 'always'}}},
      },
      [TestStubs.UserIdentity()],
      [TestStubs.OrganizationIntegrations({organizationId: org.id})]
    );

    expect(
      screen.queryByText(
        /You've selected Slack as your delivery method, but do not have a linked account for the following organizations/
      )
    ).not.toBeInTheDocument();
  });
});
