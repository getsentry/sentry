import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {NOTIFICATION_SETTING_FIELDS} from 'sentry/views/settings/account/notifications/fields';
import {NotificationSettings} from 'sentry/views/settings/account/notifications/notificationSettings';

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
