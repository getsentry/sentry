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

    render(
      <RegistrationForm
        hasNewsletter={false}
        initialEmail="jane@example.com"
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue('jane@example.com');
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
});
