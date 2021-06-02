import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {NotificationSettingsObject} from 'app/views/settings/account/notifications/constants';
import NotificationSettingsByType from 'app/views/settings/account/notifications/notificationSettingsByType';

const createWrapper = (notificationSettings: NotificationSettingsObject) => {
  const {routerContext} = initializeOrg();
  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/users/me/notification-settings/',
    method: 'GET',
    body: notificationSettings,
  });

  return mountWithTheme(
    <NotificationSettingsByType notificationType="alerts" />,
    routerContext
  );
};

describe('NotificationSettingsByType', function () {
  it('should render when everything is disabled', function () {
    const wrapper = createWrapper({
      alerts: {user: {me: {email: 'never', slack: 'never'}}},
    });

    expect(wrapper.find('FieldLabel')).toHaveLength(1);
  });
});
