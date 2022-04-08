import * as PropTypes from 'prop-types';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'sentry/api';
import AccountAuthorizations from 'sentry/views/settings/account/accountAuthorizations';

describe('AccountAuthorizations', function () {
  beforeEach(function () {
    Client.clearMockResponses();
  });

  it('renders empty', function () {
    Client.addMockResponse({
      url: '/api-authorizations/',
      method: 'GET',
      body: [],
    });

    const wrapper = mountWithTheme(<AccountAuthorizations />, {
      context: {
        location: TestStubs.location(),
        router: TestStubs.router(),
      },
      childContextTypes: {
        location: PropTypes.object,
        router: PropTypes.object,
      },
    });

    expect(wrapper).toSnapshot();
  });
});
