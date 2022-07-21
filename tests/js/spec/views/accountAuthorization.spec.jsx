import * as PropTypes from 'prop-types';

import {render} from 'sentry-test/reactTestingLibrary';

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

    const wrapper = render(<AccountAuthorizations />, {
      context: {
        context: {
          location: TestStubs.location(),
          router: TestStubs.router(),
        },
        childContextTypes: {
          location: PropTypes.object,
          router: PropTypes.object,
        },
      },
    });

    expect(wrapper.container).toSnapshot();
  });
});
