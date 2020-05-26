import React from 'react';

import {shallow, mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import {ApiTokens} from 'app/views/settings/account/apiTokens';

const organization = TestStubs.Organization();

describe('ApiTokens', function() {
  const routerContext = TestStubs.routerContext();

  beforeEach(function() {
    Client.clearMockResponses();
  });

  it('renders empty result', function() {
    Client.addMockResponse({
      url: '/api-tokens/',
    });

    const wrapper = shallow(<ApiTokens organization={organization} />, routerContext);

    // Should be loading
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with result', function() {
    Client.addMockResponse({
      url: '/api-tokens/',
      body: [TestStubs.ApiToken()],
    });

    const wrapper = shallow(<ApiTokens organization={organization} />, routerContext);

    // Should be loading
    expect(wrapper).toMatchSnapshot();
  });

  it('can delete token', function() {
    Client.addMockResponse({
      url: '/api-tokens/',
      body: [TestStubs.ApiToken()],
    });

    const mock = Client.addMockResponse({
      url: '/api-tokens/',
      method: 'DELETE',
    });

    expect(mock).not.toHaveBeenCalled();

    const wrapper = mountWithTheme(
      <ApiTokens organization={organization} />,
      routerContext
    );

    wrapper.find('button[aria-label="Remove"]').simulate('click');

    // Should be loading
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      '/api-tokens/',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
