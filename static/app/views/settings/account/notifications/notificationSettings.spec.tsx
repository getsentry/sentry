import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  NotificationSettingsObject,
  SELF_NOTIFICATION_SETTINGS_TYPES,
} from 'sentry/views/settings/account/notifications/constants';
import {NOTIFICATION_SETTING_FIELDS} from 'sentry/views/settings/account/notifications/fields2';
import NotificationSettings from 'sentry/views/settings/account/notifications/notificationSettings';

function renderMockRequests({
  notificationSettings,
}: {
  notificationSettings: NotificationSettingsObject;
}) {
  MockApiClient.addMockResponse({
    url: '/users/me/notification-settings/',
    method: 'GET',
    body: notificationSettings,
  });

  MockApiClient.addMockResponse({
    url: '/users/me/notifications/',
    method: 'GET',
    body: {
      personalActivityNotifications: true,
      selfAssignOnResolve: true,
      weeklyReports: true,
    },
  });
}

describe('NotificationSettings', function () {
  it('should render', function () {
    const {routerContext, organization} = initializeOrg();

    renderMockRequests({
      notificationSettings: {
        alerts: {user: {me: {email: 'never', slack: 'never'}}},
        deploy: {user: {me: {email: 'never', slack: 'never'}}},
        workflow: {user: {me: {email: 'never', slack: 'never'}}},
      },
    });

    render(<NotificationSettings organizations={[organization]} />, {
      context: routerContext,
    });

    // There are 8 notification setting Selects/Toggles.
    [
      'alerts',
      'workflow',
      'deploy',
      'approval',
      'reports',
      'email',
      ...SELF_NOTIFICATION_SETTINGS_TYPES,
    ].forEach(field => {
      expect(
        screen.getByText(String(NOTIFICATION_SETTING_FIELDS[field].label))
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Issue Alerts')).toBeInTheDocument();
  });

  it('renders quota section with feature flag', function () {
    const {routerContext, organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        features: ['slack-overage-notifications'],
      },
    });

    renderMockRequests({
      notificationSettings: {
        alerts: {user: {me: {email: 'never', slack: 'never'}}},
        deploy: {user: {me: {email: 'never', slack: 'never'}}},
        workflow: {user: {me: {email: 'never', slack: 'never'}}},
      },
    });

    render(<NotificationSettings organizations={[organization]} />, {
      context: routerContext,
    });

    // There are 9 notification setting Selects/Toggles.
    [
      'alerts',
      'workflow',
      'deploy',
      'approval',
      'quota',
      'reports',
      'email',
      ...SELF_NOTIFICATION_SETTINGS_TYPES,
    ].forEach(field => {
      expect(
        screen.getByText(String(NOTIFICATION_SETTING_FIELDS[field].label))
      ).toBeInTheDocument();
    });
  });

  it('renders active release monitor', function () {
    const {routerContext, organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        features: ['active-release-monitor-alpha'],
      },
    });

    renderMockRequests({
      notificationSettings: {
        alerts: {user: {me: {email: 'never', slack: 'never'}}},
        deploy: {user: {me: {email: 'never', slack: 'never'}}},
        workflow: {user: {me: {email: 'never', slack: 'never'}}},
      },
    });

    render(<NotificationSettings organizations={[organization]} />, {
      context: routerContext,
    });

    // There are 9 notification setting Selects/Toggles.
    [
      'alerts',
      'activeRelease',
      'workflow',
      'deploy',
      'approval',
      'reports',
      'email',
      ...SELF_NOTIFICATION_SETTINGS_TYPES,
    ].forEach(field => {
      if (field === 'activeRelease') {
        expect(screen.getByText('Release Issues')).toBeInTheDocument();
        return;
      }
      expect(
        screen.getByText(String(NOTIFICATION_SETTING_FIELDS[field].label))
      ).toBeInTheDocument();
    });
  });
});
