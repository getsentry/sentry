import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import SsoForm from 'sentry/views/auth/ssoForm';

describe('SsoForm', () => {
  const emptyAuthConfig = {
    canRegister: false,
    githubLoginLink: '',
    googleLoginLink: '',
    hasNewsletter: false,
    serverHostname: '',
    vstsLoginLink: '',
  };

  async function doSso(apiRequest: jest.Mock) {
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Organization ID'}),
      'org123'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(apiRequest).toHaveBeenCalledWith(
      '/auth/sso-locate/',
      expect.objectContaining({data: {organization: 'org123'}})
    );
  }

  it('renders', () => {
    const authConfig = {
      ...emptyAuthConfig,
      serverHostname: 'testserver',
    };

    render(<SsoForm authConfig={authConfig} />);

    expect(screen.getByLabelText('Organization ID')).toBeInTheDocument();
  });

  it('handles errors', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/sso-locate/',
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'Invalid org name',
      },
    });

    render(<SsoForm authConfig={emptyAuthConfig} />);
    await doSso(mockRequest);

    expect(await screen.findByText('Invalid org name')).toBeInTheDocument();
  });

  it('handles success', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/sso-locate/',
      method: 'POST',
      statusCode: 200,
      body: {
        nextUri: '/next/',
      },
    });

    const {router} = render(<SsoForm authConfig={emptyAuthConfig} />);
    await doSso(mockRequest);

    await waitFor(() =>
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: '/next/',
        })
      )
    );
  });
});
