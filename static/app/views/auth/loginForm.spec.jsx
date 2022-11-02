import {browserHistory} from 'react-router';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import LoginForm from 'sentry/views/auth/loginForm';

function doLogin() {
  userEvent.type(screen.getByRole('textbox', {name: 'Account'}), 'test@test.com');
  userEvent.type(screen.getByRole('textbox', {name: 'Password'}), '12345pass');
  userEvent.click(screen.getByRole('button', {name: 'Continue'}));
}

describe('LoginForm', function () {
  const api = new MockApiClient();

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

    const authConfig = {};
    render(<LoginForm api={api} authConfig={authConfig} />);
    doLogin();

    expect(await screen.findByText('Bad username password')).toBeInTheDocument();
  });

  it('handles success', async function () {
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

    const authConfig = {};
    render(<LoginForm api={api} authConfig={authConfig} />);
    doLogin();

    expect(mockRequest).toHaveBeenCalledWith(
      '/auth/login/',
      expect.objectContaining({
        data: {username: 'test@test.com', password: '12345pass'},
      })
    );

    await waitFor(() => expect(ConfigStore.get('user')).toEqual(userObject));
    expect(browserHistory.push).toHaveBeenCalledWith({pathname: '/next/'});
  });

  it('renders login provider buttons', function () {
    const authConfig = {
      vstsLoginLink: '/vstsLogin',
      githubLoginLink: '/githubLogin',
    };

    render(<LoginForm api={api} authConfig={authConfig} />);

    expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Azure DevOps')).toBeInTheDocument();
  });
});
