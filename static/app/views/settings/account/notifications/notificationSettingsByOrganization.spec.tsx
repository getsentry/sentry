import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import NotificationSettingsByOrganization from 'sentry/views/settings/account/notifications/notificationSettingsByOrganization';

describe('NotificationSettingsByOrganization', function () {
  it('should render', function () {
    const settings = {
      alerts: {
        user: {me: {email: 'always', slack: 'always'}},
        organization: {1: {email: 'always', slack: 'always'}},
      },
    };

    const {organization, routerContext} = initializeOrg();

    render(
      <NotificationSettingsByOrganization
        notificationType="alerts"
        notificationSettings={settings}
        organizations={[organization]}
        onChange={jest.fn()}
        onSubmitSuccess={jest.fn()}
      />,
      {context: routerContext}
    );

    expect(screen.getByRole('textbox', {name: 'org-slug'})).toBeInTheDocument();
  });
});
