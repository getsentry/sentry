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

  it('handles Escape only while the guide has focus', async () => {
    render(<Tour />, {organization});
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText('Tour entry')).toBeInTheDocument();

    await userEvent.tab({shift: true});
    expect(screen.getByRole('button', {name: 'Next'})).toHaveFocus();
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

  it('does not blur the page', async () => {
    render(<Tour />, {organization});
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    expect(screen.queryByTestId('tour-blur-window')).not.toBeInTheDocument();
  });

  it('moves focus to the next guide when the tour changes step from the guide', async () => {
    render(<Tour />, {organization});
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    await userEvent.tab({shift: true});
    expect(screen.getByRole('button', {name: 'Next'})).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('Tour projects')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Tour projects').closest('[tabindex="-1"]')).toHaveFocus()
    );
    // Keys keep working, since focus stayed inside the tour.
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Tour projects')).not.toBeInTheDocument();
  });

  it('returns focus to the highlighted element when a focused guide closes', async () => {
    render(<Tour />, {organization});
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    await userEvent.tab({shift: true});
    expect(screen.getByRole('button', {name: 'Next'})).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Tour entry')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'entry'})).toHaveFocus();
  });

  it('does not take focus when the guide opens on its own', async () => {
    render(<Tour />, {organization});
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    expect(screen.getByText('Tour entry').closest('[tabindex="-1"]')).not.toHaveFocus();
  });

  it('marks the guide as viewed once it is shown, and only once', async () => {
    render(<Tour />, {organization});
    await waitFor(() =>
      expect(dismissRequest).toHaveBeenCalledWith(
        '/assistant/',
        expect.objectContaining({
          data: {guide: 'tour.settings_navigation', status: 'viewed'},
        })
      )
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));
    expect(await screen.findByText('Tour projects')).toBeInTheDocument();
    expect(dismissRequest).toHaveBeenCalledTimes(1);
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

  it('stays open when the user clicks elsewhere on the page', async () => {
    render(<Tour />, {organization});
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.getByText('Tour entry')).toBeInTheDocument();
  });

  it('ends without dismissing the guide when the user enters settings', async () => {
    const {router} = render(<Tour />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/'},
      },
    });
    expect(await screen.findByText('Tour entry')).toBeInTheDocument();
    act(() => router.navigate('/settings/org-slug/'));
    await waitFor(() => expect(screen.queryByText('Tour entry')).not.toBeInTheDocument());
    expect(dismissRequest).not.toHaveBeenCalledWith(
      '/assistant/',
      expect.objectContaining({
        data: {guide: 'tour.settings_navigation', status: 'dismissed'},
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
