import {fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

import {ApiTokens} from 'sentry/views/settings/account/apiTokens';

const organization = TestStubs.Organization();

describe('ApiTokens', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders empty result', function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: null,
    });

    render(<ApiTokens organization={organization} />);
  });

  it('renders with result', function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [TestStubs.ApiToken()],
    });

    render(<ApiTokens organization={organization} />);
  });

  it('can delete token', function () {
    MockApiClient.addMockResponse({
      url: '/api-tokens/',
      body: [TestStubs.ApiToken()],
    });

    const mock = MockApiClient.addMockResponse({
      url: '/api-tokens/',
      method: 'DELETE',
    });
    expect(mock).not.toHaveBeenCalled();

    render(<ApiTokens organization={organization} />);

    fireEvent.click(screen.getByLabelText('Remove'));

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
