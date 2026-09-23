import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {mockMatchMedia} from 'sentry-test/utils';

import {GlobalModal} from '@sentry/scraps/modal';

import {CommandPaletteHotkeys} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {ModalStore} from 'sentry/stores/modalStore';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';
import {SearchButton} from 'sentry/views/navigation/searchButton';
import {SettingsSecondaryNavigation} from 'sentry/views/navigation/secondary/sections/settings/settingsSecondaryNavigation';

function SettingsNavigationWithSearch() {
  return (
    <PrimaryNavigationContextProvider>
      <SettingsSecondaryNavigation />
      <SearchButton />
      <CommandPaletteHotkeys />
      <GlobalModal />
    </PrimaryNavigationContextProvider>
  );
}

const routes = [
  {pathname: '/settings/account/details/', route: '/settings/account/details/'},
  {pathname: '/settings/org-slug/', route: '/settings/:orgId/'},
  {
    pathname: '/settings/org-slug/projects/project-slug/',
    route: '/settings/:orgId/projects/:projectId/',
  },
];

describe.each(['desktop', 'mobile'])('Settings search on %s', layout => {
  beforeEach(() => {
    localStorage.clear();
    ModalStore.reset();
    mockMatchMedia(layout === 'mobile');
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: ProjectFixture(),
    });
  });

  afterEach(() => {
    mockMatchMedia(false);
    ModalStore.reset();
  });

  it.each(routes)('opens search from $pathname', async ({pathname, route}) => {
    render(<SettingsNavigationWithSearch />, {
      organization: OrganizationFixture(),
      initialRouterConfig: {location: {pathname}, route},
    });

    const searchButton = screen.getByRole('button', {name: 'Search settings and more'});
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Collapse'})).toBeInTheDocument();

    await userEvent.hover(searchButton);
    expect(await screen.findByText('Search settings and more')).toBeInTheDocument();
    await userEvent.click(searchButton);

    const input = await screen.findByRole('textbox', {name: 'Search commands'});
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.type(input, 'notifications');
    expect(input).toHaveValue('notifications');

    await userEvent.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(searchButton).toHaveFocus());

    // The header shortcut shares the same palette state as the global trigger.
    await userEvent.click(screen.getByRole('button', {name: 'Command Palette'}));
    expect(await screen.findByRole('textbox', {name: 'Search commands'})).toHaveValue(
      'notifications'
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('textbox', {name: 'Search commands'})).toHaveValue('');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('supports keyboard activation without changing the collapse control', async () => {
    render(<SettingsNavigationWithSearch />, {
      organization: OrganizationFixture(),
      initialRouterConfig: {location: {pathname: '/settings/org-slug/'}},
    });

    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Search settings and more'})).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(
      await screen.findByRole('textbox', {name: 'Search commands'})
    ).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', {name: 'Collapse'}));
    expect(screen.getByRole('button', {name: 'Expand'})).toBeInTheDocument();
  });
});
