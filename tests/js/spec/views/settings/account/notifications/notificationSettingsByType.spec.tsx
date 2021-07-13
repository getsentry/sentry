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

    // There is only one field and it is the default and it is set to "off".
    const fields = wrapper.find('Field');
    expect(fields).toHaveLength(1);
    expect(fields.at(0).find('FieldLabel').text()).toEqual('Issue Alerts');
    expect(fields.at(0).find('Select').text()).toEqual('Off');
  });
});
