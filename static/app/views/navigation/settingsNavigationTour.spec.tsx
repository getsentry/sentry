import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {ConfigStore} from 'sentry/stores/configStore';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import {NavigationTourProvider} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';
import {
  SettingsNavigationTourElement,
  SettingsNavigationTourProvider,
} from 'sentry/views/navigation/settingsNavigationTour';

function Tour() {
  return (
    <PrimaryNavigationContextProvider>
      <NavigationTourProvider>
        <SettingsNavigationTourProvider>
          {(['entry', 'org', 'project', 'account', 'back'] as const).map(id => (
            <SettingsNavigationTourElement key={id} id={id}>
              {props => <Button {...props}>{id}</Button>}
            </SettingsNavigationTourElement>
          ))}
        </SettingsNavigationTourProvider>
      </NavigationTourProvider>
    </PrimaryNavigationContextProvider>
  );
}

const organization = OrganizationFixture({features: ['settings-v3']});

describe('Settings navigation tour', () => {
  beforeEach(() => {
    localStorageWrapper.clear();
    ConfigStore.set('user', UserFixture());
    MockApiClient.addMockResponse({url: '/assistant/', body: []});
  });

  it('does not show for the old navigation', () => {
    render(<Tour />, {organization: OrganizationFixture()});
    expect(screen.queryByText('Find Your Settings')).not.toBeInTheDocument();
  });

  it('guides users from the app through settings and finishes', async () => {
    const {router} = render(<Tour />, {
      organization,
      initialRouterConfig: {location: {pathname: '/organizations/org-slug/issues/'}},
    });
    expect(await screen.findByText('Find Your Settings')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(router.location.pathname).toBe('/settings/org-slug/');
    expect(await screen.findByText('Organization Settings')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(await screen.findByText('Project Settings')).toBeInTheDocument();
    expect(screen.getByText(/Use the project selector/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
    expect(await screen.findByText('Organization Settings')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(await screen.findByText('Account Settings')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(await screen.findByText('Back to Your Work')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Done'}));
    expect(screen.queryByRole('button', {name: 'Done'})).not.toBeInTheDocument();
  });

  it.each(['Skip tour', 'Close'])('remembers dismissal with %s', async name => {
    const {unmount} = render(<Tour />, {organization});
    await userEvent.click(await screen.findByRole('button', {name}));
    expect(screen.queryByText('Find Your Settings')).not.toBeInTheDocument();
    unmount();
    render(<Tour />, {organization});
    expect(screen.queryByText('Find Your Settings')).not.toBeInTheDocument();
  });

  it('can be dismissed with Escape', async () => {
    render(<Tour />, {organization});
    expect(await screen.findByText('Find Your Settings')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Find Your Settings')).not.toBeInTheDocument();
  });

  it('starts at organization settings when entering settings directly', async () => {
    render(<Tour />, {
      organization,
      initialRouterConfig: {location: {pathname: '/settings/org-slug/'}},
    });
    expect(await screen.findByText('Organization Settings')).toBeInTheDocument();
    expect(screen.queryByText('Find Your Settings')).not.toBeInTheDocument();
  });
});
