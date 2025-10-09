import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ModalStore from 'sentry/stores/modalStore';

import UserEmails from 'admin/components/users/userEmails';

describe('UserEmails', function () {
  const mockUser = UserFixture({
    id: '1',
    email: 'primary@example.com',
    emails: [
      {id: '1', email: 'primary@example.com', is_verified: true},
      {id: '2', email: 'secondary@example.com', is_verified: false},
    ],
  });

  const mockPanel = ({children}: {children: React.ReactNode}) => <div>{children}</div>;

  beforeEach(() => {
    ModalStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('renders email addresses correctly', function () {
    render(<UserEmails Panel={mockPanel} user={mockUser} />);

    expect(screen.getByText('primary@example.com')).toBeInTheDocument();
    expect(screen.getByText('secondary@example.com')).toBeInTheDocument();
    expect(screen.getByText('— primary')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Unverified')).toBeInTheDocument();
  });

  it('shows remove button for non-primary emails', function () {
    render(<UserEmails Panel={mockPanel} user={mockUser} />);

    // Should show remove button for secondary email
    expect(screen.getByTestId('remove-email-button')).toBeInTheDocument();

    // Should not show remove button for primary email
    const removeButtons = screen.getAllByTestId('remove-email-button');
    expect(removeButtons).toHaveLength(1);
  });

  it('opens confirmation modal when remove button is clicked', async function () {
    render(<UserEmails Panel={mockPanel} user={mockUser} />);
    renderGlobalModal();

    await userEvent.click(screen.getByTestId('remove-email-button'));

    expect(
      screen.getByText('Are you sure you want to remove the email secondary@example.com?')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  it('calls API to remove email when confirmed', async function () {
    const mockDelete = MockApiClient.addMockResponse({
      url: '/users/1/emails/',
      method: 'DELETE',
      statusCode: 204,
    });

    const onEmailRemoved = jest.fn();

    render(
      <UserEmails Panel={mockPanel} user={mockUser} onUserUpdate={onEmailRemoved} />
    );
    renderGlobalModal();

    await userEvent.click(screen.getByTestId('remove-email-button'));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(
        '/users/1/emails/',
        expect.objectContaining({
          method: 'DELETE',
          data: {email: 'secondary@example.com'},
        })
      );
    });

    expect(onEmailRemoved).toHaveBeenCalled();
  });

  it('handles user with no emails array', function () {
    const userWithNoEmails = UserFixture({
      id: '1',
      email: 'primary@example.com',
      emails: undefined,
    });

    render(<UserEmails Panel={mockPanel} user={userWithNoEmails} />);

    expect(screen.getByText('primary@example.com')).toBeInTheDocument();
    expect(screen.getByText('— primary')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Remove'})).not.toBeInTheDocument();
  });
});
