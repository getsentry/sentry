import {enzymeRender} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {NotificationSettingsObject} from 'sentry/views/settings/account/notifications/constants';
import NotificationSettingsByOrganization from 'sentry/views/settings/account/notifications/notificationSettingsByOrganization';

const createWrapper = (notificationSettings: NotificationSettingsObject) => {
  const {organization, routerContext} = initializeOrg();
  return enzymeRender(
    <NotificationSettingsByOrganization
      notificationType="alerts"
      notificationSettings={notificationSettings}
      organizations={[organization]}
      onChange={jest.fn()}
      onSubmitSuccess={jest.fn()}
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
