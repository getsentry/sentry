import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import MobileApp, {
  MOBILE_APP_SCOPES,
} from 'app/views/settings/account/mobileApp/mobileApp';

describe('MobileApp', function () {
  const {routerContext} = initializeOrg();
  const tokenValue = 'abc';

  it('renders empty if there is no right token', function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [TestStubs.ApiToken()],
    });

    const wrapper = mountWithTheme(<MobileApp />, routerContext);

    expect(
      wrapper.find('button[aria-label="Generate Auth Token"]').exists()
    ).toBeTruthy();
  });

  it('renders qr code and input if there is the right token', function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [TestStubs.ApiToken({token: tokenValue, scopes: MOBILE_APP_SCOPES})],
    });

    const wrapper = mountWithTheme(<MobileApp />, routerContext);

    expect(wrapper.find('button[aria-label="Generate Auth Token"]').exists()).toBeFalsy();

    expect(wrapper.find('input').prop('value')).toBe(tokenValue);

    expect(wrapper.find('QRCode').prop('value')).toBe(
      btoa(JSON.stringify({authToken: tokenValue}))
    );
  });

  it('generates the token', async function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [],
    });

    const mockTokenCreate = MockApiClient.addMockResponse({
      url: '/api-tokens/',
      method: 'POST',
      body: [],
    });

    const wrapper = mountWithTheme(<MobileApp />, routerContext);

    wrapper.find('button[aria-label="Generate Auth Token"]').simulate('click');

    expect(mockTokenCreate).toHaveBeenLastCalledWith(
      '/api-tokens/',
      expect.objectContaining({data: {scopes: MOBILE_APP_SCOPES}})
    );
  });
});
