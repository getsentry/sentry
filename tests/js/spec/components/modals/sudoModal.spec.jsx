import {mountWithTheme} from 'sentry-test/enzyme';
import {act} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import ConfigStore from 'sentry/stores/configStore';
import App from 'sentry/views/app';

describe('Sudo Modal', function () {
  const setHasPasswordAuth = hasPasswordAuth =>
    act(() => ConfigStore.set('user', {...ConfigStore.get('user'), hasPasswordAuth}));

  beforeEach(function () {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });
    Client.addMockResponse({
      url: '/assistant/?v2',
      body: [],
    });
    Client.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization()],
    });
    Client.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'DELETE',
      statusCode: 401,
      body: {
        detail: {
          code: 'sudo-required',
          username: 'test@test.com',
        },
      },
    });
    Client.addMockResponse({
      url: '/authenticators/',
      body: [],
    });
  });

  it('can delete an org with sudo flow', async function () {
    setHasPasswordAuth(true);

    const wrapper = mountWithTheme(<App>{<div>placeholder content</div>}</App>);

    const api = new Client();
    const successCb = jest.fn();
    const errorCb = jest.fn();

    // No Modal
    expect(wrapper.find('GlobalModal[visible=true]').exists()).toBe(false);

    // Should return w/ `sudoRequired`
    api.request('/organizations/org-slug/', {
      method: 'DELETE',
      success: successCb,
      error: errorCb,
    });

    await tick();
    await tick();
    wrapper.update();

    // Should have Modal + input
    expect(wrapper.find('Modal input')).toHaveLength(1);

    // Original callbacks should not have been called
    expect(successCb).not.toHaveBeenCalled();
    expect(errorCb).not.toHaveBeenCalled();

    // Clear mocks and allow DELETE
    Client.clearMockResponses();
    const orgDeleteMock = Client.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'DELETE',
      statusCode: 200,
    });
    const sudoMock = Client.addMockResponse({
      url: '/auth/',
      method: 'PUT',
      statusCode: 200,
    });

    expect(sudoMock).not.toHaveBeenCalled();

    // "Sudo" auth
    wrapper
      .find('Modal input[name="password"]')
      .simulate('change', {target: {value: 'password'}});

    wrapper.find('Modal form').simulate('submit');
    wrapper.find('Modal Button[type="submit"]').simulate('click');

    await tick();
    wrapper.update();

    expect(sudoMock).toHaveBeenCalledWith(
      '/auth/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          password: 'password',
        },
      })
    );

    // Retry API request
    expect(successCb).toHaveBeenCalled();
    expect(orgDeleteMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    await tick();
    wrapper.update();

    // Sudo Modal should be closed
    expect(wrapper.find('GlobalModal[visible=true]').exists()).toBe(false);
  });

  it('shows button to redirect if user does not have password auth', async function () {
    setHasPasswordAuth(false);

    const wrapper = mountWithTheme(<App>{<div>placeholder content</div>}</App>);

    const api = new Client();
    const successCb = jest.fn();
    const errorCb = jest.fn();

    // No Modal
    expect(wrapper.find('GlobalModal[visible=true]').exists()).toBe(false);

    // Should return w/ `sudoRequired`
    api.request('/organizations/org-slug/', {
      method: 'DELETE',
      success: successCb,
      error: errorCb,
    });

    await tick();
    await tick();
    wrapper.update();

    // Should have Modal + input
    expect(wrapper.find('Modal input')).toHaveLength(0);
    expect(wrapper.find('Button[href]').prop('href')).toMatch('/auth/login/?next=%2F');
  });
});
