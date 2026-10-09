import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PasswordRecovery from './index';

it('prefills an email hint and requests recovery through the API', async () => {
  const request = MockApiClient.addMockResponse({
    url: '/auth/recovery/',
    method: 'POST',
    statusCode: 202,
    body: {detail: 'If an eligible account exists, a recovery email has been sent.'},
  });
  render(<PasswordRecovery />, {
    initialRouterConfig: {
      location: {pathname: '/account/recover/', query: {email: 'user@example.com'}},
    },
  });
  expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue('user@example.com');
  await userEvent.click(screen.getByRole('button', {name: 'Send recovery email'}));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/auth/recovery/',
      expect.objectContaining({method: 'POST', data: {user: 'user@example.com'}})
    )
  );
  expect(
    await screen.findByText(
      'If an eligible account exists, a recovery email has been sent.'
    )
  ).toBeVisible();
  expect(screen.getByRole('button', {name: 'Back to login'})).toHaveAttribute(
    'href',
    '/auth/login/'
  );
});

it('shows a recovery error and allows retry', async () => {
  MockApiClient.addMockResponse({
    url: '/auth/recovery/',
    method: 'POST',
    statusCode: 429,
    body: {detail: 'Too many password recovery attempts'},
  });
  render(<PasswordRecovery />);
  await userEvent.type(screen.getByRole('textbox', {name: 'Email'}), 'user@example.com');
  await userEvent.click(screen.getByRole('button', {name: 'Send recovery email'}));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Too many password recovery attempts'
  );
  expect(screen.getByRole('button', {name: 'Send recovery email'})).toBeEnabled();
});

it('shows confirmation for a recovery email sent after password expiration', () => {
  render(<PasswordRecovery />, {
    initialRouterConfig: {location: {pathname: '/account/recover/', query: {sent: '1'}}},
  });
  expect(
    screen.getByText('If an eligible account exists, a recovery email has been sent.')
  ).toBeVisible();
});
