import {browserHistory} from 'react-router';

import {mount} from 'sentry-test/enzyme';

import ConfigStore from 'app/stores/configStore';
import RegisterForm from 'app/views/auth/registerForm';

function doLogin(wrapper, apiRequest) {
  wrapper.find('#id-name').simulate('change', {target: {value: 'joe'}});
  wrapper.find('#id-username').simulate('change', {target: {value: 'test@test.com'}});
  wrapper.find('#id-password').simulate('change', {target: {value: '12345pass'}});

  wrapper.find('form').simulate('submit');

  expect(apiRequest).toHaveBeenCalledWith(
    '/auth/register/',
    expect.objectContaining({
      data: {
        name: 'joe',
        username: 'test@test.com',
        password: '12345pass',
        subscribe: true,
      },
    })
  );
}

describe('Register', function () {
  const routerContext = TestStubs.routerContext();
  const api = new MockApiClient();

  it('handles errors', async function () {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/register/',
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'Registration failed',
      },
    });

    const authConfig = {};

    const wrapper = mount(
      <RegisterForm api={api} authConfig={authConfig} />,
      routerContext
    );
    doLogin(wrapper, mockRequest);

    await tick();
    wrapper.update();

    expect(wrapper.find('.alert').exists()).toBe(true);
  });

  it('handles success', async function () {
    const userObject = {
      id: 1,
      name: 'Joe',
    };

    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/register/',
      method: 'POST',
      statusCode: 200,
      body: {
        user: userObject,
        nextUri: '/next/',
      },
    });

    const authConfig = {};
    const wrapper = mount(
      <RegisterForm api={api} authConfig={authConfig} />,
      routerContext
    );

    doLogin(wrapper, mockRequest);

    await tick();

    expect(ConfigStore.get('user')).toEqual(userObject);
    expect(browserHistory.push).toHaveBeenCalledWith({pathname: '/next/'});
  });
});
