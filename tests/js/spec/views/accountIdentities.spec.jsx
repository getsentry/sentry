import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import AccountIdentities from 'app/views/settings/account/accountIdentities';

const ENDPOINT = '/users/me/social-identities/';

describe('AccountIdentities', function () {
  beforeEach(function () {
    Client.clearMockResponses();
  });

  it('renders empty', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: [],
    });

    const wrapper = mountWithTheme(<AccountIdentities />, TestStubs.routerContext());

    expect(wrapper).toSnapshot();
  });

  it('renders list', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: [
        {
          id: '1',
          provider: 'github',
          providerLabel: 'GitHub',
        },
      ],
    });

    const wrapper = mountWithTheme(<AccountIdentities />, TestStubs.routerContext());
    expect(wrapper).toSnapshot();
  });

  it('disconnects identity', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: [
        {
          id: '1',
          provider: 'github',
          providerLabel: 'GitHub',
        },
      ],
    });

    const wrapper = mountWithTheme(<AccountIdentities />, TestStubs.routerContext());

    const disconnectRequest = {
      url: `${ENDPOINT}1/`,
      method: 'DELETE',
    };

    const mock = Client.addMockResponse(disconnectRequest);

    expect(mock).not.toHaveBeenCalled();

    wrapper.find('Button').first().simulate('click');

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      `${ENDPOINT}1/`,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
