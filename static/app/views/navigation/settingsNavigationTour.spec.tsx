import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {ConfigStore} from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
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

jest.mock('sentry/utils/analytics');

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
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/'},
      },
    });
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
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

  it('remembers dismissal with the close button', async () => {
    render(<Tour />, {organization});
    await userEvent.click(await screen.findByRole('button', {name: 'Close'}));
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
    const dismissals = dismissRequest.mock.calls.filter(
      ([, options]) => options.data.status === 'dismissed'
    );
    expect(dismissals).toHaveLength(1);
  });

  it('does not show once the user has seen it', async () => {
    const assistantRequest = MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [{guide: 'tour.settings_navigation', seen: true}],
    });
    render(<Tour />, {organization});
    await waitFor(() => expect(assistantRequest).toHaveBeenCalled());
    await act(() => new Promise(resolve => setTimeout(resolve)));
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
  });

  it('does not show to users who joined after the settings navigation GA', async () => {
    const assistantRequest = MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [{guide: 'tour.settings_navigation', seen: false}],
    });
    ConfigStore.set('user', UserFixture({dateJoined: '2099-01-01T00:00:00.000Z'}));
    render(<Tour />, {organization});
    await waitFor(() => expect(assistantRequest).toHaveBeenCalled());
    await act(() => new Promise(resolve => setTimeout(resolve)));
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
  });

  it('can be dismissed with Escape', async () => {
    render(<Tour />, {organization});
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
    expect(trackAnalytics).toHaveBeenCalledWith(
      'tour-guide.dismiss',
      expect.objectContaining({
        id: 'entry',
        step_count: 1,
        tour_key: 'tour.settings_navigation',
      })
    );
  });

  it('blurs the page and navigates steps with the arrow keys', async () => {
    render(<Tour />, {organization});
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    expect(screen.getByTestId('tour-blur-window')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(await screen.findByText('Tour projects')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowLeft}');
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
  });

  it('marks the guide as viewed once it shows', async () => {
    render(<Tour />, {organization});
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    await waitFor(() =>
      expect(dismissRequest).toHaveBeenCalledWith(
        '/assistant/',
        expect.objectContaining({
          data: {guide: 'tour.settings_navigation', status: 'viewed'},
        })
      )
    );
  });

  it('tracks dismissing the guide', async () => {
    render(<Tour />, {organization});
    await userEvent.click(await screen.findByRole('button', {name: 'Close'}));
    expect(trackAnalytics).toHaveBeenCalledWith(
      'tour-guide.dismiss',
      expect.objectContaining({
        id: 'entry',
        step_count: 1,
        tour_key: 'tour.settings_navigation',
      })
    );
  });

  it('tracks finishing the guide', async () => {
    render(<Tour />, {organization});
    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Done'}));
    expect(dismissRequest).not.toHaveBeenCalledWith(
      '/assistant/',
      expect.objectContaining({
        data: {guide: 'tour.settings_navigation', status: 'dismissed'},
      })
    );
    expect(trackAnalytics).toHaveBeenCalledWith(
      'tour-guide.finish',
      expect.objectContaining({
        id: 'projects',
        step_count: 2,
        tour_key: 'tour.settings_navigation',
      })
    );
  });

  it('does not start inside settings where the organization menu is unavailable', () => {
    render(<Tour />, {
      organization,
      initialRouterConfig: {location: {pathname: '/settings/org-slug/'}},
    });
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
  });
});
