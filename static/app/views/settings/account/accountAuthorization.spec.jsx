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
      context: TestStubs.routerContext(),
    });

    expect(wrapper.container).toSnapshot();
  });
});
