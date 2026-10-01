import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PasswordReset from './index';

const routerConfig = {
  location: {pathname: '/account/recover/confirm/1/recovery-token/'},
  route: '/account/recover/confirm/:userId/:token/',
};

jest.unmock('@tanstack/react-pacer');

describe('PasswordReset', () => {
  it('resets the password and shows the success message', async () => {
    const validate = MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      body: {valid: true},
    });
    const reset = MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      method: 'POST',
      statusCode: 204,
    });

    render(<PasswordReset />, {
      initialRouterConfig: routerConfig,
    });

    const password = await screen.findByLabelText('New password');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('progressbar', {name: 'Password strength'})).toHaveValue(0);
    await userEvent.type(password, 'password');
    await waitFor(() =>
      expect(
        screen.getByRole('progressbar', {name: 'Password strength'})
      ).toHaveAttribute('aria-valuetext', 'Very Weak')
    );
    await userEvent.clear(password);
    await userEvent.type(password, ' a-secure-password ');
    await waitFor(() =>
      expect(
        screen.getByRole('progressbar', {name: 'Password strength'})
      ).toHaveAttribute('aria-valuetext', 'Very Strong')
    );
    await userEvent.click(screen.getByRole('button', {name: 'Show password'}));
    expect(password).toHaveAttribute('type', 'text');
    expect(reset).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: 'Reset password'}));

    await waitFor(() =>
      expect(screen.getByText('Your password has been reset.')).toBeVisible()
    );
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(validate).toHaveBeenCalledWith(
      '/auth/recovery/confirm/',
      expect.objectContaining({
        query: {userId: '1', token: 'recovery-token'},
      })
    );
    expect(reset).toHaveBeenCalledWith(
      '/auth/recovery/confirm/',
      expect.objectContaining({
        data: {
          userId: '1',
          token: 'recovery-token',
          password: ' a-secure-password ',
        },
      })
    );
  });

  it('counts down before navigating to sign-in', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      body: {valid: true},
    });
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      method: 'POST',
      statusCode: 204,
    });
    const {router} = render(<PasswordReset />, {
      initialRouterConfig: routerConfig,
    });

    await userEvent.type(
      await screen.findByLabelText('New password'),
      'a-secure-password'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Reset password'}));
    await waitFor(() =>
      expect(screen.getByText('Taking you back to sign in (3)…')).toBeVisible()
    );

    expect(
      await screen.findByText('Taking you back to sign in (2)…', {}, {timeout: 1500})
    ).toBeVisible();
    expect(
      await screen.findByText('Taking you back to sign in (1)…', {}, {timeout: 1500})
    ).toBeVisible();
    expect(router.location.pathname).toBe(routerConfig.location.pathname);
    await waitFor(() => expect(router.location.pathname).toBe('/auth/login/'), {
      timeout: 1500,
    });
    expect(screen.queryByText('Your password has been reset.')).not.toBeInTheDocument();
  });

  it('navigates back to sign-in from the form', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      body: {valid: true},
    });
    const {router} = render(<PasswordReset />, {
      initialRouterConfig: routerConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Back to sign in'}));
    expect(router.location.pathname).toBe('/auth/login/');
  });

  it('shows an expired link before asking for a password', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      body: {valid: false},
    });

    const {router} = render(<PasswordReset />, {
      initialRouterConfig: routerConfig,
    });

    expect(
      await screen.findByText(
        'This password reset link is invalid or expired. Request a new link to continue.'
      )
    ).toBeVisible();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Back to sign in'})).toHaveAttribute(
      'href',
      '/auth/login/'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Back to sign in'}));
    expect(router.location.pathname).toBe('/auth/login/');
  });

  it('retries a failed link check', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      statusCode: 503,
      body: {detail: 'Unable to check this password reset link. Try again.'},
    });

    render(<PasswordReset />, {initialRouterConfig: routerConfig});

    expect(
      await screen.findByText('Unable to check this password reset link. Try again.')
    ).toBeVisible();
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      body: {valid: true},
    });
    await userEvent.click(screen.getByRole('button', {name: 'Try again'}));
    expect(await screen.findByLabelText('New password')).toBeVisible();
  });

  it('preserves the form when password validation fails', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      body: {valid: true},
    });
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      method: 'POST',
      statusCode: 400,
      body: {password: ['This password is too short.']},
    });

    render(<PasswordReset />, {initialRouterConfig: routerConfig});

    await userEvent.type(await screen.findByLabelText('New password'), 'short');
    await userEvent.click(screen.getByRole('button', {name: 'Reset password'}));
    expect(await screen.findByText('This password is too short.')).toBeVisible();
    expect(
      screen.queryByText('Unable to reset your password. Try again.')
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveValue('short');

    const reset = MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      method: 'POST',
      statusCode: 204,
    });
    await userEvent.clear(screen.getByLabelText('New password'));
    await userEvent.type(screen.getByLabelText('New password'), 'a-secure-password');
    await userEvent.click(screen.getByRole('button', {name: 'Reset password'}));
    await waitFor(() =>
      expect(screen.getByText('Your password has been reset.')).toBeVisible()
    );
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it.each([
    [400, 'Unable to reset your password. Try again.'],
    [503, 'The server is temporarily unavailable. Please try again in a few moments.'],
  ])(
    'shows a %s request error and clears it when a retry has field errors',
    async (statusCode, message) => {
      MockApiClient.addMockResponse({
        url: '/auth/recovery/confirm/',
        body: {valid: true},
      });
      MockApiClient.addMockResponse({
        url: '/auth/recovery/confirm/',
        method: 'POST',
        statusCode,
        body: {},
      });
      render(<PasswordReset />, {initialRouterConfig: routerConfig});

      await userEvent.type(await screen.findByLabelText('New password'), 'short');
      await userEvent.click(screen.getByRole('button', {name: 'Reset password'}));
      expect(await screen.findByText(message)).toBeVisible();
      expect(screen.getByLabelText('New password')).toHaveValue('short');

      MockApiClient.addMockResponse({
        url: '/auth/recovery/confirm/',
        method: 'POST',
        statusCode: 400,
        body: {password: ['This password is too short.']},
      });
      await userEvent.click(screen.getByRole('button', {name: 'Reset password'}));
      expect(await screen.findByText('This password is too short.')).toBeVisible();
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(
        screen.queryByText('Unable to reset your password. Try again.')
      ).not.toBeInTheDocument();
    }
  );

  it('uses field errors when the response also includes a general message', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      body: {valid: true},
    });
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      method: 'POST',
      statusCode: 400,
      body: {
        password: ['This password is too short.'],
        detail: 'Password recovery is temporarily unavailable.',
      },
    });
    render(<PasswordReset />, {initialRouterConfig: routerConfig});

    await userEvent.type(await screen.findByLabelText('New password'), 'short');
    await userEvent.click(screen.getByRole('button', {name: 'Reset password'}));
    expect(await screen.findByText('This password is too short.')).toBeVisible();
    expect(
      screen.queryByText('Password recovery is temporarily unavailable.')
    ).not.toBeInTheDocument();
  });

  it('handles a link that expires while the form is open', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      body: {valid: true},
    });
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Invalid or expired recovery token'},
    });

    render(<PasswordReset />, {initialRouterConfig: routerConfig});

    await userEvent.type(
      await screen.findByLabelText('New password'),
      'a-secure-password'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Reset password'}));
    expect(
      await screen.findByText(
        'This password reset link is invalid or expired. Request a new link to continue.'
      )
    ).toBeVisible();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('does not submit an empty password', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      body: {valid: true},
    });
    const reset = MockApiClient.addMockResponse({
      url: '/auth/recovery/confirm/',
      method: 'POST',
    });

    render(<PasswordReset />, {initialRouterConfig: routerConfig});

    await screen.findByLabelText('New password');
    await userEvent.click(screen.getByRole('button', {name: 'Reset password'}));
    expect(await screen.findByText('Enter a new password')).toBeVisible();
    await waitFor(() => expect(reset).not.toHaveBeenCalled());
  });
});
