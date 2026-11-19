import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {NOTIFICATION_SETTING_FIELDS} from './fields';
import {NotificationSettings} from './notificationSettings';

function renderMockRequests() {
  MockApiClient.addMockResponse({
    url: '/users/me/notifications/',
    method: 'GET',
    body: {
      personalActivityNotifications: true,
      selfAssignOnResolve: true,
    },
  });
}

describe('NotificationSettings', () => {
  it('should render', async () => {
    renderMockRequests();

    render(<NotificationSettings />);

    for (const field of [
      'alerts',
      'workflow',
      'deploy',
      'approval',
      'reports',
      'email',
      'personalActivityNotifications',
      'selfAssignOnResolve',
      'quota',
      'spikeProtection',
    ] as const) {
      expect(
        await screen.findByText(String(NOTIFICATION_SETTING_FIELDS[field].label))
      ).toBeInTheDocument();
    }
    expect(screen.getByText('Issue Alerts')).toBeInTheDocument();
  });

  it('shows inbox notifications when the organization has the inbox', async () => {
    renderMockRequests();

    render(<NotificationSettings />, {
      organization: OrganizationFixture({features: ['universal-inbox']}),
    });

    expect(
      await screen.findByText(String(NOTIFICATION_SETTING_FIELDS.inbox.label))
    ).toBeInTheDocument();
  });

  it('hides inbox notifications without the inbox feature', async () => {
    renderMockRequests();

    render(<NotificationSettings />);

    expect(
      await screen.findByText(String(NOTIFICATION_SETTING_FIELDS.alerts.label))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(String(NOTIFICATION_SETTING_FIELDS.inbox.label))
    ).not.toBeInTheDocument();
  });

  it('hides quota notifications on self-hosted', async () => {
    ConfigStore.set('isSelfHosted', true);
    renderMockRequests();

    render(<NotificationSettings />);

    expect(
      await screen.findByText(String(NOTIFICATION_SETTING_FIELDS.alerts.label))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(String(NOTIFICATION_SETTING_FIELDS.quota.label))
    ).not.toBeInTheDocument();
  });
});
