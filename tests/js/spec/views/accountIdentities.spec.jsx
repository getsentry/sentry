import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import {Client} from 'sentry/api';
import AccountIdentities from 'sentry/views/settings/account/accountIdentities';

const ENDPOINT = '/users/me/user-identities/';

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

    const wrapper = mountWithTheme(<AccountIdentities />);

    expect(wrapper).toSnapshot();
  });

  it('renders list', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: [
        {
          category: 'social-identity',
          id: '1',
          provider: {
            key: 'github',
            name: 'GitHub',
          },
          status: 'can_disconnect',
          organization: null,
        },
      ],
    });

    const wrapper = mountWithTheme(<AccountIdentities />);
    expect(wrapper).toSnapshot();
  });

  it('disconnects identity', async function () {
    Client.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      body: [
        {
          category: 'social-identity',
          id: '1',
          provider: {
            key: 'github',
            name: 'GitHub',
          },
          status: 'can_disconnect',
          organization: null,
        },
      ],
    });

    const wrapper = mountWithTheme(<AccountIdentities />);

    const disconnectRequest = {
      url: `${ENDPOINT}social-identity/1/`,
      method: 'DELETE',
    };

    const mock = Client.addMockResponse(disconnectRequest);

    expect(mock).not.toHaveBeenCalled();

    wrapper.find('Button').first().simulate('click');
    const modal = await mountGlobalModal();
    modal.find('Button[priority="danger"]').simulate('click');

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      `${ENDPOINT}social-identity/1/`,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
