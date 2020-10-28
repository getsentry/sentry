import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import AccountDetails from 'app/views/settings/account/accountDetails';

jest.mock('jquery');
jest.mock('scroll-to-element', () => 'scroll-to-element');

const mockUserDetails = params => {
  MockApiClient.clearMockResponses();

  MockApiClient.addMockResponse({
    url: '/users/me/',
    method: 'GET',
    body: TestStubs.UserDetails(params),
  });
};

describe('AccountDetails', function () {
  beforeEach(function () {
    mockUserDetails();
  });

  it('renders', function () {
    const wrapper = mountWithTheme(
      <AccountDetails location={{}} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('input[name="name"]')).toHaveLength(1);

    // Stacktrace order, language, timezone
    expect(wrapper.find('SelectControl')).toHaveLength(3);

    expect(wrapper.find('BooleanField')).toHaveLength(1);
    expect(wrapper.find('RadioGroup')).toHaveLength(1);
  });

  it('has username field if it is different than email', function () {
    mockUserDetails({username: 'different@example.com'});
    const wrapper = mountWithTheme(
      <AccountDetails location={{}} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('input[name="username"]')).toHaveLength(1);
    expect(wrapper.find('input[name="username"]').prop('disabled')).toBe(false);
  });

  describe('Managed User', function () {
    it('does not have password fields', function () {
      mockUserDetails({isManaged: true});
      const wrapper = mountWithTheme(
        <AccountDetails location={{}} />,
        TestStubs.routerContext()
      );

      expect(wrapper.find('input[name="name"]')).toHaveLength(1);
      expect(wrapper.find('input[name="password"]')).toHaveLength(0);
      expect(wrapper.find('input[name="passwordVerify"]')).toHaveLength(0);
    });

    it('has disabled username field if it is different than email', function () {
      mockUserDetails({isManaged: true, username: 'different@example.com'});
      const wrapper = mountWithTheme(
        <AccountDetails location={{}} />,
        TestStubs.routerContext()
      );

      expect(wrapper.find('input[name="username"]')).toHaveLength(1);
      expect(wrapper.find('input[name="username"]').prop('disabled')).toBe(true);
    });
  });
});
