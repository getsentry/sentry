import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {UserDropdown} from 'sentry/views/nav/userDropdown';

describe('UserDropdown', function () {
  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
  });

  it('displays user info and links', async function () {
    render(<UserDropdown />);

    await userEvent.click(screen.getByRole('button', {name: 'foo@example.com'}));

    expect(screen.getByText('Foo Bar')).toBeInTheDocument();
    expect(screen.getByText('foo@example.com')).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'User Settings'})).toHaveAttribute(
      'href',
      '/settings/account/'
    );
  });

  it('can sign out', async function () {
    const mockLogout = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
    });

    render(<UserDropdown />);

    await userEvent.click(screen.getByRole('button', {name: 'foo@example.com'}));

    await userEvent.click(screen.getByText('Sign Out'));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('hides admin link if user is not admin', async function () {
    render(<UserDropdown />);

    await userEvent.click(screen.getByRole('button', {name: 'foo@example.com'}));

    expect(screen.queryByRole('link', {name: 'Admin'})).not.toBeInTheDocument();
  });

  it('shows admin link if user is admin', async function () {
    ConfigStore.set('user', UserFixture({isSuperuser: true}));

    render(<UserDropdown />);

    await userEvent.click(screen.getByRole('button', {name: 'foo@example.com'}));

    expect(screen.getByRole('link', {name: 'Admin'})).toHaveAttribute('href', `/manage/`);
  });
});
