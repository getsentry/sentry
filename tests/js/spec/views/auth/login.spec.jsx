import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Login from 'app/views/auth/login';

describe('Login', function() {
  afterAll(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders a loading indicator', function() {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
    });

    const wrapper = mountWithTheme(<Login />);

    expect(wrapper.find('LoadingIndicator').exists()).toBe(true);
  });

  it('renders an error if auth config cannot be loaded', async function() {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      statusCode: 500,
    });

    const wrapper = mountWithTheme(<Login />);

    await tick();
    wrapper.update();

    expect(wrapper.find('LoadingError').exists()).toBe(true);
    expect(wrapper.find('LoginForm').exists()).toBe(false);
  });

  it('does not show register when disabled', function() {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {canRegister: false},
    });

    const wrapper = mountWithTheme(<Login />);

    expect(
      wrapper
        .find('AuthNavTabs a')
        .filter({children: 'Register'})
        .exists()
    ).toBe(false);
  });

  it('shows register when canRegister is enabled', async function() {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {canRegister: true},
    });

    const wrapper = mountWithTheme(<Login />);

    await tick();
    wrapper.update();

    expect(
      wrapper
        .find('AuthNavTabs a')
        .filter({children: 'Register'})
        .exists()
    ).toBe(true);
  });

  it('toggles between tabs', async function() {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {canRegister: true},
    });

    const wrapper = mountWithTheme(<Login />);

    await tick();
    wrapper.update();

    const tabs = wrapper.find('AuthNavTabs a');

    // Default tab is login
    expect(wrapper.find('LoginForm').exists()).toBe(true);

    tabs.filter({children: 'Single Sign-On'}).simulate('click');
    expect(wrapper.find('SsoForm').exists()).toBe(true);

    tabs.filter({children: 'Register'}).simulate('click');
    expect(wrapper.find('RegisterForm').exists()).toBe(true);
  });
});
