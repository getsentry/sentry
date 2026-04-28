jest.unmock('lodash/debounce');

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({count}: {count: number}) => {
    const virtualItems = Array.from({length: count}, (_, index) => ({
      key: index,
      index,
      start: index * 48,
      size: 48,
      lane: 0,
    }));
    return {
      getVirtualItems: () => virtualItems,
      getTotalSize: () => count * 48,
      measureElement: jest.fn(),
      measure: jest.fn(),
      scrollToIndex: jest.fn(),
    };
  },
}));

import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CommandPaletteProvider} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {
  makeCloseButton,
  makeClosableHeader,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {ProjectsStore} from 'sentry/stores/projectsStore';

function makeRenderProps(closeModal: jest.Mock) {
  return {
    closeModal,
    Body: ModalBody,
    Footer: ModalFooter,
    Header: makeClosableHeader(closeModal),
    CloseButton: makeCloseButton(closeModal),
  };
}

import {GlobalCommandPaletteActions} from './commandPaletteGlobalActions';

function SlotOutlets() {
  return (
    <div style={{display: 'none'}}>
      <CommandPaletteSlot.Outlet name="task">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="page">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="global">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
    </div>
  );
}

describe('GlobalCommandPaletteActions - project settings ordering', () => {
  const organization = OrganizationFixture();
  const projectA = ProjectFixture({id: '1', slug: 'project-a', organization});
  const projectB = ProjectFixture({id: '2', slug: 'project-b', organization});
  const projectC = ProjectFixture({id: '3', slug: 'project-c', organization});

  beforeEach(() => {
    ProjectsStore.loadInitialData([projectA, projectB, projectC]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/group-search-views/starred/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/starred/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/dashboards/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      body: [],
    });
  });

  async function drillIntoGeneralSettings() {
    // Search for "General Settings" so it appears as a clickable action item.
    // Use "Project Settings" in the pattern to disambiguate from the org-level
    // "General Settings" entry that also appears in search results.
    const input = await screen.findByRole('textbox', {name: 'Search commands'});
    await userEvent.type(input, 'General Settings');
    await userEvent.click(
      await screen.findByRole('option', {name: /Project Settings.*General Settings/})
    );
    // The search query is cleared when drilling in; wait for project options to appear.
    await screen.findByRole('textbox', {name: 'Search commands'});
  }

  it('shows a "Current Project" tag on the active project entry', async () => {
    render(
      <CommandPaletteProvider>
        <GlobalCommandPaletteActions />
        <SlotOutlets />
        <CommandPalette {...makeRenderProps(jest.fn())} />
      </CommandPaletteProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {pathname: `/settings/${organization.slug}/projects/project-b/`},
          route: '/settings/:orgId/projects/:projectId/',
        },
      }
    );

    await drillIntoGeneralSettings();

    expect(await screen.findByText('Current')).toBeInTheDocument();
  });

  it('places the current route project first when on a :projectId route', async () => {
    render(
      <CommandPaletteProvider>
        <GlobalCommandPaletteActions />
        <SlotOutlets />
        <CommandPalette {...makeRenderProps(jest.fn())} />
      </CommandPaletteProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {pathname: `/settings/${organization.slug}/projects/project-b/`},
          route: '/settings/:orgId/projects/:projectId/',
        },
      }
    );

    await drillIntoGeneralSettings();

    const option = (await screen.findAllByRole('option')).find(
      el => !el.hasAttribute('aria-disabled')
    );
    expect(option).toHaveAccessibleName('project-b');
  });

  it('does not duplicate the current project in the list', async () => {
    render(
      <CommandPaletteProvider>
        <GlobalCommandPaletteActions />
        <SlotOutlets />
        <CommandPalette {...makeRenderProps(jest.fn())} />
      </CommandPaletteProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {pathname: `/settings/${organization.slug}/projects/project-b/`},
          route: '/settings/:orgId/projects/:projectId/',
        },
      }
    );

    await drillIntoGeneralSettings();

    await screen.findByRole('option', {name: 'project-b'});
    expect(screen.getAllByRole('option', {name: 'project-b'})).toHaveLength(1);
  });

  it('places the project first when identified by a single ?project= query param', async () => {
    render(
      <CommandPaletteProvider>
        <GlobalCommandPaletteActions />
        <SlotOutlets />
        <CommandPalette {...makeRenderProps(jest.fn())} />
      </CommandPaletteProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {project: projectB.id},
          },
        },
      }
    );

    await drillIntoGeneralSettings();

    const option = (await screen.findAllByRole('option')).find(
      el => !el.hasAttribute('aria-disabled')
    );
    expect(option).toHaveAccessibleName('project-b');
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('highlights all projects when multiple ?project= params are set', async () => {
    render(
      <CommandPaletteProvider>
        <GlobalCommandPaletteActions />
        <SlotOutlets />
        <CommandPalette {...makeRenderProps(jest.fn())} />
      </CommandPaletteProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query: {project: [projectA.id, projectB.id]},
          },
        },
      }
    );

    await drillIntoGeneralSettings();

    // Both selected projects should appear with the Current tag
    expect(await screen.findByRole('option', {name: 'project-a'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'project-b'})).toBeInTheDocument();
    expect(screen.getAllByText('Current')).toHaveLength(2);
    // Unselected project should still be present but without a tag
    expect(screen.getByRole('option', {name: 'project-c'})).toBeInTheDocument();
  });

  it('shows all projects without priority when not on a :projectId route', async () => {
    render(
      <CommandPaletteProvider>
        <GlobalCommandPaletteActions />
        <SlotOutlets />
        <CommandPalette {...makeRenderProps(jest.fn())} />
      </CommandPaletteProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {pathname: `/organizations/${organization.slug}/issues/`},
        },
      }
    );

    await drillIntoGeneralSettings();

    expect(await screen.findByRole('option', {name: 'project-a'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'project-b'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'project-c'})).toBeInTheDocument();
  });
});
