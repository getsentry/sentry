import {browserHistory} from 'react-router';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import SsoForm from 'sentry/views/auth/ssoForm';

describe('SsoForm', function () {
  const api = new MockApiClient();

  function doSso(apiRequest) {
    userEvent.type(screen.getByRole('textbox', {name: 'Organization ID'}), 'org123');
    userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(apiRequest).toHaveBeenCalledWith(
      '/auth/sso-locate/',
      expect.objectContaining({data: {organization: 'org123'}})
    );
  }

  it('renders', function () {
    const authConfig = {
      serverHostname: 'testserver',
    };

    render(<SsoForm api={api} authConfig={authConfig} />);

    expect(screen.getByLabelText('Organization ID')).toBeInTheDocument();
  });

  it('handles errors', async function () {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/sso-locate/',
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'Invalid org name',
      },
    });

    const authConfig = {};

    render(<SsoForm api={api} authConfig={authConfig} />);
    doSso(mockRequest);

    expect(await screen.findByText('Invalid org name')).toBeInTheDocument();
  });

  it('handles success', async function () {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/sso-locate/',
      method: 'POST',
      statusCode: 200,
      body: {
        nextUri: '/next/',
      },
    });

    const authConfig = {};
    render(<SsoForm api={api} authConfig={authConfig} />);
    doSso(mockRequest);

    await waitFor(() =>
      expect(browserHistory.push).toHaveBeenCalledWith({pathname: '/next/'})
    );
  });
});
