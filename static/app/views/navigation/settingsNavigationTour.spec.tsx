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
          {(['entry', 'projects'] as const).map(id => (
            <SettingsNavigationTourElement
              key={id}
              id={id}
              title={`Tour ${id}`}
              description={`Description ${id}`}
            >
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
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
  });

  it('guides users through two steps without leaving the app', async () => {
    const {router} = render(<Tour />, {
      organization,
      initialRouterConfig: {location: {pathname: '/organizations/org-slug/issues/'}},
    });
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(await screen.findByText('Tour projects')).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(router.location.pathname).toBe('/organizations/org-slug/issues/');
    await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'Done'}));
    expect(screen.queryByRole('button', {name: 'Done'})).not.toBeInTheDocument();
  });

  it.each(['Skip tour', 'Close'])('remembers dismissal with %s', async name => {
    const {unmount} = render(<Tour />, {organization});
    await userEvent.click(await screen.findByRole('button', {name}));
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
    unmount();
    render(<Tour />, {organization});
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
  });

  it('can be dismissed with Escape', async () => {
    render(<Tour />, {organization});
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
  });

  it('does not start inside settings where the organization menu is unavailable', () => {
    render(<Tour />, {
      organization,
      initialRouterConfig: {location: {pathname: '/settings/org-slug/'}},
    });
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
  });
});
