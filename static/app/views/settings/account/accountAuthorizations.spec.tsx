import {render} from 'sentry-test/reactTestingLibrary';

import AccountAuthorizations from 'sentry/views/settings/account/accountAuthorizations';

describe('AccountAuthorizations', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: '/api-authorizations/',
      method: 'GET',
      body: [],
    });

    render(<AccountAuthorizations />);
  });
});
