import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PasswordForm from 'sentry/views/settings/account/passwordForm';

const ENDPOINT = '/users/me/password/';

describe('PasswordForm', function () {
  let putMock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    putMock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });
  });

  it('has 3 text inputs', function () {
    render(<PasswordForm />);
    expect(screen.getByRole('textbox', {name: 'Current Password'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'New Password'})).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: 'Verify New Password'})
    ).toBeInTheDocument();
  });

  it('does not submit when any password field is empty', function () {
    render(<PasswordForm />);
    userEvent.type(screen.getByRole('textbox', {name: 'Current Password'}), 'test');
    userEvent.click(screen.getByRole('button', {name: 'Change password'}));
    expect(putMock).not.toHaveBeenCalled();

    userEvent.clear(screen.getByRole('textbox', {name: 'Current Password'}));
    userEvent.type(screen.getByRole('textbox', {name: 'New Password'}), 'test');
    userEvent.type(screen.getByRole('textbox', {name: 'Verify New Password'}), 'test');
    userEvent.click(screen.getByRole('button', {name: 'Change password'}));
    expect(putMock).not.toHaveBeenCalled();
  });

  it('does not submit when new passwords do not match', function () {
    render(<PasswordForm />);
    userEvent.type(screen.getByRole('textbox', {name: 'Current Password'}), 'test');
    userEvent.type(screen.getByRole('textbox', {name: 'New Password'}), 'test');
    userEvent.type(screen.getByRole('textbox', {name: 'Verify New Password'}), 'nottest');
    userEvent.click(screen.getByRole('button', {name: 'Change password'}));
    expect(putMock).not.toHaveBeenCalled();
  });

  it('calls API when all fields are validated and clears form on success', async function () {
    render(<PasswordForm />);
    userEvent.type(screen.getByRole('textbox', {name: 'Current Password'}), 'test');
    userEvent.type(screen.getByRole('textbox', {name: 'New Password'}), 'nottest');
    userEvent.type(screen.getByRole('textbox', {name: 'Verify New Password'}), 'nottest');
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
      expect(screen.getByRole('textbox', {name: 'Current Password'})).toHaveValue('')
    );
  });

  it('validates mismatched passwords and remvoes validation on match', function () {
    render(<PasswordForm />);
    userEvent.type(screen.getByRole('textbox', {name: 'Current Password'}), 'test');
    userEvent.type(screen.getByRole('textbox', {name: 'New Password'}), 'nottest');
    userEvent.type(
      screen.getByRole('textbox', {name: 'Verify New Password'}),
      'nottest-mismatch'
    );
    userEvent.click(screen.getByRole('button', {name: 'Change password'}));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();

    userEvent.clear(screen.getByRole('textbox', {name: 'Verify New Password'}));
    userEvent.type(screen.getByRole('textbox', {name: 'Verify New Password'}), 'nottest');

    expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
  });
});
