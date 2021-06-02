import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {NotificationSettingsObject} from 'app/views/settings/account/notifications/constants';
import NotificationSettingsByOrganization from 'app/views/settings/account/notifications/notificationSettingsByOrganization';

const createWrapper = (notificationSettings: NotificationSettingsObject) => {
  const {organization, routerContext} = initializeOrg();
  const aSpy = jest.fn();

  return mountWithTheme(
    <NotificationSettingsByOrganization
      notificationType="alerts"
      notificationSettings={notificationSettings}
      organizations={[organization]}
      onChange={aSpy}
    />,
    routerContext
  );
};

describe('NotificationSettingsByOrganization', function () {
  it('should render', function () {
    const wrapper = createWrapper({
      alerts: {
        user: {me: {email: 'always', slack: 'always'}},
        organization: {1: {email: 'always', slack: 'always'}},
      },
    });
    expect(wrapper.find('Select')).toHaveLength(1);
  });
});
