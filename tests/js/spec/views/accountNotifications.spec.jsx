import {mountWithTheme} from 'sentry-test/enzyme';

import AccountNotifications from 'app/views/settings/account/accountNotifications';

describe('AccountNotifications', function () {
  const url = '/users/me/notifications/';

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url,
      method: 'GET',
      body: {
        workflowNotifications: 1,
        selfAssignOnResolve: false,
        weeklyReports: true,
        deployNotifications: 3,
        personalActivityNotifications: true,
        subscribeByDefault: true,
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders with values from API', function () {
    const wrapper = mountWithTheme(<AccountNotifications />, TestStubs.routerContext());

    // "Send Me Alerts"
    expect(wrapper.find('Switch[name="subscribeByDefault"]').prop('isActive')).toBe(true);

    // "Workflow Notifications"
    expect(
      wrapper.find('Field[id="workflowNotifications"] RadioGroup').prop('value')
    ).toBe(1);

    // "Deploy Notifications"
    expect(wrapper.find('Field[id="deployNotifications"] RadioGroup').prop('value')).toBe(
      3
    );

    // "Notify Me About my Own Activity"
    expect(
      wrapper.find('Switch[name="personalActivityNotifications"]').prop('isActive')
    ).toBe(true);

    // "Claim Unassigned Issues"
    expect(wrapper.find('Switch[name="selfAssignOnResolve"]').prop('isActive')).toBe(
      false
    );
  });

  it('can change "Deploy Notifications"', function () {
    const wrapper = mountWithTheme(<AccountNotifications />, TestStubs.routerContext());
    const mock = MockApiClient.addMockResponse({
      url,
      method: 'PUT',
    });

    wrapper.find('Field[id="deployNotifications"] Radio').at(2).simulate('change');

    expect(mock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {deployNotifications: 4},
      })
    );
  });
});
