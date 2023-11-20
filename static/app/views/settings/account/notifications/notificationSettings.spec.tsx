import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SELF_NOTIFICATION_SETTINGS_TYPES} from 'sentry/views/settings/account/notifications/constants';
import {NOTIFICATION_SETTING_FIELDS} from 'sentry/views/settings/account/notifications/fields2';
import NotificationSettings from 'sentry/views/settings/account/notifications/notificationSettings';

function renderMockRequests({}: {}) {
  MockApiClient.addMockResponse({
    url: '/users/me/notifications/',
    method: 'GET',
    body: {
      personalActivityNotifications: true,
      selfAssignOnResolve: true,
    },
  });
}

describe('NotificationSettings', function () {
  it('should render', async function () {
    const {routerContext, organization} = initializeOrg();

    renderMockRequests({});

    render(<NotificationSettings organizations={[organization]} />, {
      context: routerContext,
    });

    // There are 8 notification setting Selects/Toggles.
    for (const field of [
      'alerts',
      'workflow',
      'deploy',
      'approval',
      'reports',
      'email',
      ...SELF_NOTIFICATION_SETTINGS_TYPES,
    ]) {
      expect(
        await screen.findByText(String(NOTIFICATION_SETTING_FIELDS[field].label))
      ).toBeInTheDocument();
    }
    expect(screen.getByText('Issue Alerts')).toBeInTheDocument();
  });

  it('renders quota section with feature flag', async function () {
    const {routerContext, organization} = initializeOrg({
      organization: {
        features: ['slack-overage-notifications'],
      },
    });

    renderMockRequests({});

    render(<NotificationSettings organizations={[organization]} />, {
      context: routerContext,
    });

    // There are 9 notification setting Selects/Toggles.

    for (const field of [
      'alerts',
      'workflow',
      'deploy',
      'approval',
      'reports',
      'email',
      'quota',
      ...SELF_NOTIFICATION_SETTINGS_TYPES,
    ]) {
      expect(
        await screen.findByText(String(NOTIFICATION_SETTING_FIELDS[field].label))
      ).toBeInTheDocument();
    }
    expect(screen.getByText('Issue Alerts')).toBeInTheDocument();
  });
});
