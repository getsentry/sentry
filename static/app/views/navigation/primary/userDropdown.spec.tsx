import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {UserDropdown} from 'sentry/views/navigation/primary/userDropdown';

describe('UserDropdown', () => {
  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
  });

  it('displays user info and links', async () => {
    render(<UserDropdown />);

    await userEvent.click(screen.getByRole('button', {name: 'foo@example.com'}));

    expect(screen.getByText('Foo Bar')).toBeInTheDocument();
    expect(screen.getByText('foo@example.com')).toBeInTheDocument();

    expect(screen.getByRole('menuitemradio', {name: 'User Settings'})).toHaveAttribute(
      'href',
      '/settings/account/'
    );
  });

  it('can sign out', async () => {
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

  it('hides admin link if user is not admin', async () => {
    render(<UserDropdown />);

    await userEvent.click(screen.getByRole('button', {name: 'foo@example.com'}));

    expect(screen.queryByRole('menuitemradio', {name: 'Admin'})).not.toBeInTheDocument();
  });

  it('shows admin link if user is admin', async () => {
    ConfigStore.set('user', UserFixture({isSuperuser: true}));

    render(<UserDropdown />);

    await userEvent.click(screen.getByRole('button', {name: 'foo@example.com'}));

    expect(screen.getByRole('menuitemradio', {name: 'Admin'})).toHaveAttribute(
      'href',
      '/manage/'
    );
  });

  it('shows the settings v3 menu and saves preferences', async () => {
    const updateUser = MockApiClient.addMockResponse({
      url: '/users/me/',
      method: 'PUT',
      body: UserFixture(),
    });
    render(<UserDropdown />, {
      organization: OrganizationFixture({features: ['settings-v3']}),
    });

    await userEvent.click(screen.getByRole('button', {name: 'foo@example.com'}));

    expect(screen.getByRole('menuitemradio', {name: 'Settings'})).toHaveAttribute(
      'href',
      '/settings/account/'
    );
    expect(screen.getByText('Foo Bar')).toBeInTheDocument();

    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Preferences'}));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Dark'}));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        '/users/me/',
        expect.objectContaining({data: {options: {theme: 'dark'}}})
      );
    });
  });

  it('saves the time format from the settings v3 menu', async () => {
    const updateUser = MockApiClient.addMockResponse({
      url: '/users/me/',
      method: 'PUT',
      body: UserFixture(),
    });
    render(<UserDropdown />, {
      organization: OrganizationFixture({features: ['settings-v3']}),
    });

    await userEvent.click(screen.getByRole('button', {name: 'foo@example.com'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Preferences'}));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: '24 hour'}));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        '/users/me/',
        expect.objectContaining({data: {options: {clock24Hours: true}}})
      );
    });
  });
});
