import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PasswordForm from 'sentry/views/settings/account/passwordForm';

const ENDPOINT = '/users/me/password/';

describe('PasswordForm', function () {
  let putMock;
  // The "help" message is currently inside the label element
  const currentPasswordLabel = 'Current PasswordYour current password';
  const newPasswordLabel = 'New Password';
  const verifyNewPasswordLabel = 'Verify New PasswordVerify your new password';

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    putMock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });
  });

  it('has 3 text inputs', function () {
    render(<PasswordForm />);
    expect(screen.getByLabelText(currentPasswordLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(newPasswordLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(verifyNewPasswordLabel)).toBeInTheDocument();
  });

  it('does not submit when any password field is empty', function () {
    render(<PasswordForm />);
    userEvent.type(screen.getByLabelText(currentPasswordLabel), 'test');
    userEvent.click(screen.getByRole('button', {name: 'Change password'}));
    expect(putMock).not.toHaveBeenCalled();

    userEvent.clear(screen.getByLabelText(currentPasswordLabel));
    userEvent.type(screen.getByLabelText(newPasswordLabel), 'test');
    userEvent.type(screen.getByLabelText(verifyNewPasswordLabel), 'test');
    userEvent.click(screen.getByRole('button', {name: 'Change password'}));
    expect(putMock).not.toHaveBeenCalled();
  });

  it('does not submit when new passwords do not match', function () {
    render(<PasswordForm />);
    userEvent.type(screen.getByLabelText(currentPasswordLabel), 'test');
    userEvent.type(screen.getByLabelText(newPasswordLabel), 'test');
    userEvent.type(screen.getByLabelText(verifyNewPasswordLabel), 'nottest');
    userEvent.click(screen.getByRole('button', {name: 'Change password'}));
    expect(putMock).not.toHaveBeenCalled();
  });

  it('calls API when all fields are validated and clears form on success', async function () {
    render(<PasswordForm />);
    userEvent.type(screen.getByLabelText(currentPasswordLabel), 'test');
    userEvent.type(screen.getByLabelText(newPasswordLabel), 'nottest');
    userEvent.type(screen.getByLabelText(verifyNewPasswordLabel), 'nottest');
    userEvent.click(screen.getByRole('button', {name: 'Change password'}));
    expect(putMock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: {
          password: 'test',
          passwordNew: 'nottest',
          passwordVerify: 'nottest',
        },
      })
    );

    await waitFor(() =>
      expect(screen.getByLabelText(currentPasswordLabel)).toHaveValue('')
    );
  });

  it('validates mismatched passwords and remvoes validation on match', function () {
    render(<PasswordForm />);
    userEvent.type(screen.getByLabelText(currentPasswordLabel), 'test');
    userEvent.type(screen.getByLabelText(newPasswordLabel), 'nottest');
    userEvent.type(screen.getByLabelText(verifyNewPasswordLabel), 'nottest-mismatch');
    userEvent.click(screen.getByRole('button', {name: 'Change password'}));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();

    userEvent.clear(screen.getByLabelText(verifyNewPasswordLabel));
    userEvent.type(screen.getByLabelText(verifyNewPasswordLabel), 'nottest');

    expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
  });
});
