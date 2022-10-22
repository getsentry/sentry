import {ApiToken} from 'fixtures/js-stubs/apiToken';
import {Organization} from 'fixtures/js-stubs/organization';

import {fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import {ApiTokens} from 'sentry/views/settings/account/apiTokens';

const organization = Organization();

describe('ApiTokens', function () {
  beforeEach(function () {
    Client.clearMockResponses();
  });

  it('renders empty result', function () {
    Client.addMockResponse({
      url: '/api-tokens/',
      body: null,
    });

    const {container} = render(<ApiTokens organization={organization} />);

    // Should be loading
    expect(container).toSnapshot();
  });

  it('renders with result', function () {
    Client.addMockResponse({
      url: '/api-tokens/',
      body: [ApiToken()],
    });

    const {container} = render(<ApiTokens organization={organization} />);

    // Should be loading
    expect(container).toSnapshot();
  });

  it('can delete token', function () {
    Client.addMockResponse({
      url: '/api-tokens/',
      body: [ApiToken()],
    });

    const mock = Client.addMockResponse({
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
