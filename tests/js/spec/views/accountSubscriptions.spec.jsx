import PropTypes from 'prop-types';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import AccountSubscriptions from 'app/views/settings/account/accountSubscriptions';

const ENDPOINT = '/users/me/subscriptions/';

describe('AccountSubscriptions', function () {
  beforeEach(function () {
    Client.clearMockResponses();
  });

  it('renders empty', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [],
    });
    const wrapper = mountWithTheme(<AccountSubscriptions />, {
      context: {
        router: TestStubs.router(),
      },
      childContextTypes: {
        router: PropTypes.object,
      },
    });

    expect(wrapper).toSnapshot();
  });

  it('renders list and can toggle', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.Subscriptions(),
    });
    const mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    const wrapper = mountWithTheme(<AccountSubscriptions />, {
      context: {
        router: TestStubs.router(),
      },
      childContextTypes: {
        router: PropTypes.object,
      },
    });

    expect(wrapper).toSnapshot();

    expect(mock).not.toHaveBeenCalled();

    wrapper.find('Switch').first().simulate('click');

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: {
          listId: 2,
          subscribed: false,
        },
      })
    );
  });
});
