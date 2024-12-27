import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import RegisterForm from 'sentry/views/auth/registerForm';

describe('Register', function () {
  const emptyAuthConfig = {
    canRegister: false,
    githubLoginLink: '',
    googleLoginLink: '',
    hasNewsletter: false,
    serverHostname: '',
    vstsLoginLink: '',
  };

  async function doLogin(apiRequest: jest.Mock) {
    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'joe');
    await userEvent.type(screen.getByRole('textbox', {name: 'Email'}), 'test@test.com');
    await userEvent.type(screen.getByRole('textbox', {name: 'Password'}), '12345pass');

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(apiRequest).toHaveBeenCalledWith(
      '/auth/register/',
      expect.objectContaining({
        data: {
          name: 'joe',
          username: 'test@test.com',
          password: '12345pass',
          subscribe: true,
        },
      })
    );
  }

  it('handles errors', async function () {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/register/',
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'Registration failed',
        errors: {},
      },
    });

    render(<RegisterForm authConfig={emptyAuthConfig} />);
    await doLogin(mockRequest);

    expect(await screen.findByText('Registration failed')).toBeInTheDocument();
  });

  it('handles success', async function () {
    const router = RouterFixture();
    const userObject = {
      id: 1,
      name: 'Joe',
    };

    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/register/',
      method: 'POST',
      statusCode: 200,
      body: {
        user: userObject,
        nextUri: '/next/',
      },
    });

    render(<RegisterForm authConfig={emptyAuthConfig} />, {router});
    await doLogin(mockRequest);

    await waitFor(() => expect(ConfigStore.get('user')).toEqual(userObject));
    expect(router.push).toHaveBeenCalledWith({pathname: '/next/'});
  });
});
