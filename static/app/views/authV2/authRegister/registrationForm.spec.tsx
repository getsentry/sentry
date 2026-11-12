import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import {RegistrationForm} from './registrationForm';

jest.unmock('@tanstack/react-pacer');

describe('RegistrationForm', () => {
  it('uses the initial email and reports successful registration', async () => {
    const user = UserFixture({email: 'jane@example.com'});
    const result = {nextUri: '/organizations/new/', user};
    const onSuccess = jest.fn();
    const register = MockApiClient.addMockResponse({
      url: '/auth/register/',
      method: 'POST',
      body: result,
    });

    render(<RegistrationForm hasNewsletter={false} onSuccess={onSuccess} />);

    expect(screen.getByRole('textbox', {name: 'Email'})).not.toHaveAttribute('readonly');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email'}),
      'jane@example.com'
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'Jane Doe');
    await userEvent.type(screen.getByLabelText('Password'), 'a-secure-password');
    await userEvent.click(screen.getByRole('button', {name: 'Create account'}));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(result));
    expect(register).toHaveBeenCalledWith(
      '/auth/register/',
      expect.objectContaining({
        data: {
          email: 'jane@example.com',
          name: 'Jane Doe',
          password: 'a-secure-password',
        },
      })
    );
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('keeps a locked email read-only and submits it unchanged', async () => {
    const register = MockApiClient.addMockResponse({
      url: '/auth/register/',
      method: 'POST',
      body: {nextUri: '/organizations/', user: UserFixture({email: 'kate@example.com'})},
    });

    render(
      <RegistrationForm
        hasNewsletter={false}
        lockedEmail="kate@example.com"
        onSuccess={jest.fn()}
      />
    );

    const email = screen.getByRole('textbox', {name: 'Email'});
    expect(email).toHaveValue('kate@example.com');
    expect(email).toHaveAttribute('readonly');
    expect(screen.getByText('This invitation was sent to this address.')).toBeVisible();

    await userEvent.type(email, 'x');
    expect(email).toHaveValue('kate@example.com');

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'Kate');
    await userEvent.type(screen.getByLabelText('Password'), 'a-secure-password');
    await userEvent.click(screen.getByRole('button', {name: 'Create account'}));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        '/auth/register/',
        expect.objectContaining({
          data: expect.objectContaining({email: 'kate@example.com'}),
        })
      )
    );
  });

  it('shows an email error returned by registration', async () => {
    const message =
      'Use the email address this invitation was sent to, or sign in to an existing account.';
    MockApiClient.addMockResponse({
      url: '/auth/register/',
      method: 'POST',
      statusCode: 400,
      body: {email: [message]},
    });

    render(
      <RegistrationForm
        hasNewsletter={false}
        lockedEmail="someone@example.com"
        onSuccess={jest.fn()}
      />
    );

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'Someone');
    await userEvent.type(screen.getByLabelText('Password'), 'a-secure-password');
    await userEvent.click(screen.getByRole('button', {name: 'Create account'}));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
