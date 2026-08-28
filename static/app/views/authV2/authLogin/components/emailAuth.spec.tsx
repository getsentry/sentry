import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {EmailAuth} from './emailAuth';

describe('EmailAuth', () => {
  it('submits credentials and reports authenticated users', async () => {
    const user = UserFixture();
    const onAuthResult = jest.fn();
    const request = MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {nextUri: '/organizations/', user},
    });
    render(<EmailAuth onAuthResult={onAuthResult} />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email'}),
      'user@example.com'
    );
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/auth/login/',
        expect.objectContaining({
          method: 'POST',
          data: {username: 'user@example.com', password: 'secret', orgSlug: null},
        })
      )
    );
    await waitFor(() =>
      expect(onAuthResult).toHaveBeenCalledWith({
        status: 'authenticated',
        nextUri: '/organizations/',
        user,
      })
    );
  });

  it('submits credentials populated without change events', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      body: {nextUri: '/organizations/', user: UserFixture()},
    });
    render(<EmailAuth onAuthResult={jest.fn()} />);

    const email = screen.getByRole('textbox', {name: 'Email'});
    const password = screen.getByLabelText('Password');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      email,
      'user@example.com'
    );
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      password,
      'secret'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/auth/login/',
        expect.objectContaining({
          data: {username: 'user@example.com', password: 'secret', orgSlug: null},
        })
      )
    );
  });

  it('preserves credentials populated without change events after an error', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'Login attempt failed',
        errors: {__all__: ['Invalid email or password']},
      },
    });
    render(<EmailAuth onAuthResult={jest.fn()} />);

    const email = screen.getByRole('textbox', {name: 'Email'});
    const password = screen.getByLabelText('Password');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      email,
      'user@example.com'
    );
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      password,
      'wrong'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password'
    );
    expect(email).toHaveValue('user@example.com');
    expect(password).toHaveValue('wrong');
  });

  it('reports required MFA methods', async () => {
    const onAuthResult = jest.fn();
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      statusCode: 202,
      body: {
        mfaRequired: true,
        mfaMethods: [{id: 'totp'}, {id: 'recovery'}],
      },
    });
    render(<EmailAuth onAuthResult={onAuthResult} />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email'}),
      'user@example.com'
    );
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));

    await waitFor(() =>
      expect(onAuthResult).toHaveBeenCalledWith({
        status: 'mfa-required',
        methods: [{id: 'totp'}, {id: 'recovery'}],
      })
    );
  });

  it('shows login errors and clears them when credentials change', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/login/',
      method: 'POST',
      statusCode: 400,
      body: {
        detail: 'Login attempt failed',
        errors: {__all__: ['Invalid email or password']},
      },
    });
    render(<EmailAuth onAuthResult={jest.fn()} />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email'}),
      'user@example.com'
    );
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', {name: 'Log in to Sentry'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password'
    );

    await userEvent.type(screen.getByLabelText('Password'), '!');

    expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    render(<EmailAuth onAuthResult={jest.fn()} />);

    const password = screen.getByLabelText('Password');
    expect(screen.queryByRole('button', {name: 'Show password'})).not.toBeInTheDocument();

    await userEvent.type(password, 'secret');
    const visibilityButton = screen.getByRole('button', {name: 'Show password'});
    expect(password).toHaveAttribute('type', 'password');

    await userEvent.click(visibilityButton);
    expect(password).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', {name: 'Hide password'}));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('enters and exits password recovery', async () => {
    render(<EmailAuth onAuthResult={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', {name: 'Forgot password?'}));

    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Back to Login'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Back to Login'}));

    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Forgot password?'})).toBeInTheDocument();
  });

  it('shows password recovery errors', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/',
      method: 'POST',
      statusCode: 429,
      body: {detail: 'Too many password recovery attempts'},
    });
    render(<EmailAuth onAuthResult={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', {name: 'Forgot password?'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email'}),
      'user@example.com'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Reset Password'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many password recovery attempts'
    );
    expect(screen.getByRole('textbox', {name: 'Email'})).toBeInTheDocument();
  });

  it('shows confirmation after requesting a recovery email', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/',
      method: 'POST',
      statusCode: 202,
      body: {
        detail: 'If an eligible account exists, a recovery email has been sent.',
      },
    });
    render(<EmailAuth onAuthResult={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', {name: 'Forgot password?'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email'}),
      'user@example.com'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Reset Password'}));

    const notification = await screen.findByRole('status');
    expect(notification).toHaveTextContent(
      'A recovery link has been sent to user@example.com (only if there is a Sentry account for that email!).'
    );
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Reset Password'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Use a different email'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Back to Login'}));

    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByText(/A recovery link has been sent/)).not.toBeInTheDocument();
  });
});
