import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserDetailsFixture} from 'sentry-fixture/userDetails';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {SettingsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/settings/settingsSecondaryNavigation';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

import AccountAppearance from './accountAppearance';
import AccountDetails from './accountDetails';

function renderAccountNavigation(features: string[]) {
  render(
    <SecondaryNavigationContextProvider>
      <SettingsSecondaryNavigation />
    </SecondaryNavigationContextProvider>,
    {
      organization: OrganizationFixture({features: ['settings-v3', ...features]}),
      initialRouterConfig: {location: {pathname: '/settings/account/details/'}},
    }
  );
}

describe('AccountAppearance', () => {
  const user = UserDetailsFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ConfigStore.set('user', user);
    MockApiClient.addMockResponse({
      url: '/users/me/',
      method: 'GET',
      body: user,
    });
  });

  describe('without theme-variants', () => {
    const organization = OrganizationFixture();

    it('does not show Appearance in the account navigation', async () => {
      renderAccountNavigation([]);

      expect(await screen.findByRole('link', {name: 'Security'})).toBeInTheDocument();
      expect(screen.queryByRole('link', {name: 'Appearance'})).not.toBeInTheDocument();
    });

    it('renders a not found page', () => {
      render(<AccountAppearance />, {organization});

      expect(screen.getByText('Page Not Found')).toBeInTheDocument();
      expect(screen.queryByLabelText('Theme')).not.toBeInTheDocument();
    });

    it('keeps the theme field in Account Details', async () => {
      render(<AccountDetails />, {organization});

      expect(await screen.findByLabelText('Theme')).toBeInTheDocument();
    });
  });

  describe('with theme-variants', () => {
    const organization = OrganizationFixture({features: ['theme-variants']});

    it('shows Appearance in the account navigation', async () => {
      renderAccountNavigation(['theme-variants']);

      expect(await screen.findByRole('link', {name: 'Appearance'})).toHaveAttribute(
        'href',
        '/settings/account/appearance/'
      );
    });

    it('saves the theme option', async () => {
      const mockUserUpdate = MockApiClient.addMockResponse({
        url: '/users/me/',
        method: 'PUT',
        body: UserDetailsFixture({options: {...user.options, theme: 'dark'}}),
      });
      render(<AccountAppearance />, {organization});

      expect(screen.getByRole('heading', {name: 'Appearance'})).toBeInTheDocument();
      await userEvent.click(screen.getByText('Light'));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Dark'}));

      await waitFor(() => {
        expect(mockUserUpdate).toHaveBeenCalledWith(
          '/users/me/',
          expect.objectContaining({data: {options: {theme: 'dark'}}})
        );
      });
      expect(ConfigStore.get('user').options.theme).toBe('dark');
    });

    it('removes the theme field from Account Details', async () => {
      render(<AccountDetails />, {organization});

      expect(await screen.findByLabelText('Language')).toBeInTheDocument();
      expect(screen.queryByLabelText('Theme')).not.toBeInTheDocument();
    });
  });
});
