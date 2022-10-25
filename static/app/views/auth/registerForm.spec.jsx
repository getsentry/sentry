import {browserHistory} from 'react-router';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import RegisterForm from 'sentry/views/auth/registerForm';

describe('Register', function () {
  const api = new MockApiClient();

  function doLogin(apiRequest) {
    userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'joe');
    userEvent.type(screen.getByRole('textbox', {name: 'Email'}), 'test@test.com');
    userEvent.type(screen.getByRole('textbox', {name: 'Password'}), '12345pass');

    userEvent.click(screen.getByRole('button', {name: 'Continue'}));

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

    const authConfig = {};

    render(<RegisterForm api={api} authConfig={authConfig} />);
    doLogin(mockRequest);

    expect(await screen.findByText('Registration failed')).toBeInTheDocument();
  });

  it('handles success', async function () {
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

    const authConfig = {};

    render(<RegisterForm api={api} authConfig={authConfig} />);
    doLogin(mockRequest);

    await waitFor(() => expect(ConfigStore.get('user')).toEqual(userObject));
    expect(browserHistory.push).toHaveBeenCalledWith({pathname: '/next/'});
  });
});
