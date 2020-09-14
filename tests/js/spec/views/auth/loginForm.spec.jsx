import {browserHistory} from 'react-router';
import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ConfigStore from 'app/stores/configStore';
import LoginForm from 'app/views/auth/loginForm';

function doLogin(wrapper, apiRequest) {
  wrapper.find('#id-username').simulate('change', {target: {value: 'test@test.com'}});
  wrapper.find('#id-password').simulate('change', {target: {value: '12345pass'}});

  wrapper.find('form').simulate('submit');

  expect(apiRequest).toHaveBeenCalledWith(
    '/auth/login/',
    expect.objectContaining({
      data: {username: 'test@test.com', password: '12345pass'},
    })
  );
}

describe('LoginForm', function() {
  const routerContext = TestStubs.routerContext();
  const api = new MockApiClient();

  it('handles errors', async function() {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'Bad username password',
      },
    });

    const authConfig = {};

    const wrapper = mountWithTheme(
      <LoginForm api={api} authConfig={authConfig} />,
      routerContext
    );
    doLogin(wrapper, mockRequest);

    await tick();
    wrapper.update();

    expect(wrapper.find('.alert').exists()).toBe(true);
  });

  it('handles success', async function() {
    const userObject = {
      id: 1,
      name: 'Joe',
    };

    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      statusCode: 200,
      body: {
        user: userObject,
        nextUri: '/next/',
      },
    });

    const authConfig = {};
    const wrapper = mountWithTheme(
      <LoginForm api={api} authConfig={authConfig} />,
      routerContext
    );

    doLogin(wrapper, mockRequest);

    await tick();

    expect(ConfigStore.get('user')).toEqual(userObject);
    expect(browserHistory.push).toHaveBeenCalledWith({pathname: '/next/'});
  });

  it('renders login provider buttons', function() {
    const authConfig = {
      vstsLoginLink: '/vstsLogin',
      githubLoginLink: '/githubLogin',
    };

    const wrapper = mountWithTheme(
      <LoginForm api={api} authConfig={authConfig} />,
      routerContext
    );

    expect(wrapper.find('ProviderWrapper Button').map(b => b.props().href)).toEqual(
      expect.arrayContaining(['/vstsLogin', '/githubLogin'])
    );
  });
});
