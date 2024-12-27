import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import LoginForm from 'sentry/views/auth/loginForm';

async function doLogin() {
  await userEvent.type(screen.getByRole('textbox', {name: 'Account'}), 'test@test.com');
  await userEvent.type(screen.getByRole('textbox', {name: 'Password'}), '12345pass');
  await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
}

describe('LoginForm', function () {
  const emptyAuthConfig = {
    canRegister: false,
    githubLoginLink: '',
    googleLoginLink: '',
    hasNewsletter: false,
    serverHostname: '',
    vstsLoginLink: '',
  };

  it('handles errors', async function () {
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'Login attempt failed',
        errors: {__all__: 'Bad username password'},
      },
    });

    render(<LoginForm authConfig={emptyAuthConfig} />);
    await doLogin();

    expect(await screen.findByText('Bad username password')).toBeInTheDocument();
  });

  it('handles success', async function () {
    const router = RouterFixture();
    const userObject = {
      id: 1,
      name: 'Joe',
    };

    const mockRequest = MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      statusCode: 200,
      body: {
        user: userObject,
        nextUri: '/next/',
      },
    });

    render(<LoginForm authConfig={emptyAuthConfig} />, {router});
    await doLogin();

    expect(mockRequest).toHaveBeenCalledWith(
      '/auth/login/',
      expect.objectContaining({
        data: {username: 'test@test.com', password: '12345pass'},
      })
    );

    await waitFor(() => expect(ConfigStore.get('user')).toEqual(userObject));
    expect(router.push).toHaveBeenCalledWith({pathname: '/next/'});
  });

  it('renders login provider buttons', function () {
    const authConfig = {
      ...emptyAuthConfig,
      vstsLoginLink: '/vstsLogin',
      githubLoginLink: '/githubLogin',
    };

    render(<LoginForm authConfig={authConfig} />);

    expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Azure DevOps')).toBeInTheDocument();
  });
});
