import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {ConfigStore} from 'sentry/stores/configStore';
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
  let dismissRequest: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ConfigStore.set('user', UserFixture());
    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [{guide: 'tour.settings_navigation', seen: false}],
    });
    dismissRequest = MockApiClient.addMockResponse({
      url: '/assistant/',
      method: 'PUT',
      body: {},
    });
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
    expect(screen.getByRole('button', {name: 'Skip tour'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(await screen.findByText('Tour projects')).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Skip tour'})).not.toBeInTheDocument();
    expect(router.location.pathname).toBe('/organizations/org-slug/issues/');
    await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await userEvent.click(screen.getByRole('button', {name: 'Done'}));
    expect(screen.queryByRole('button', {name: 'Done'})).not.toBeInTheDocument();
  });

  it.each(['Skip tour', 'Close'])('remembers dismissal with %s', async name => {
    render(<Tour />, {organization});
    await userEvent.click(await screen.findByRole('button', {name}));
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
    expect(dismissRequest).toHaveBeenCalledWith(
      '/assistant/',
      expect.objectContaining({
        data: {guide: 'tour.settings_navigation', status: 'dismissed'},
      })
    );
  });

  it('does not show once the user has seen it', async () => {
    const assistantRequest = MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [{guide: 'tour.settings_navigation', seen: true}],
    });
    render(<Tour />, {organization});
    await waitFor(() => expect(assistantRequest).toHaveBeenCalled());
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
  });

  it('does not show to users who joined after the settings navigation GA', () => {
    ConfigStore.set('user', UserFixture({dateJoined: new Date().toISOString()}));
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
