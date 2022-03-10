import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'sentry/api';
import {ApiTokens} from 'sentry/views/settings/account/apiTokens';

const organization = TestStubs.Organization();

describe('ApiTokens', function () {
  beforeEach(function () {
    Client.clearMockResponses();
  });

  it('renders empty result', function () {
    Client.addMockResponse({
      url: '/api-tokens/',
      body: null,
    });

    const wrapper = mountWithTheme(<ApiTokens organization={organization} />);

    // Should be loading
    expect(wrapper).toSnapshot();
  });

  it('renders with result', function () {
    Client.addMockResponse({
      url: '/api-tokens/',
      body: [TestStubs.ApiToken()],
    });

    const wrapper = mountWithTheme(<ApiTokens organization={organization} />);

    // Should be loading
    expect(wrapper).toSnapshot();
  });

  it('can delete token', function () {
    Client.addMockResponse({
      url: '/api-tokens/',
      body: [TestStubs.ApiToken()],
    });

    const mock = Client.addMockResponse({
      url: '/api-tokens/',
      method: 'DELETE',
    });

    expect(mock).not.toHaveBeenCalled();

    const wrapper = mountWithTheme(<ApiTokens organization={organization} />);

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
