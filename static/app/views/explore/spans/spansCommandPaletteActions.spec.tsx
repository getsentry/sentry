jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({count}: {count: number}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, index) => ({
        key: index,
        index,
        start: index * 48,
        size: 48,
        lane: 0,
      })),
    getTotalSize: () => count * 48,
    measureElement: jest.fn(),
    measure: jest.fn(),
    scrollToIndex: jest.fn(),
  }),
}));

import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {
  makeCloseButton,
  makeClosableHeader,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {closeModal} from 'sentry/actionCreators/modal';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {TermOperator, WildcardOperators} from 'sentry/components/searchSyntax/parser';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {
  addSearchFilterToQuery,
  getSearchFilterAttribute,
  getFilterRows,
  removeSearchFilterFromQuery,
  replaceSearchFilterInQuery,
} from 'sentry/views/explore/components/traceItemFilterActions';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {
  addGroupByToDraftState,
  canCompareQueries,
  canDeleteChart,
  canReorderCharts,
  clearFilterRow,
  deleteChart,
  EquationFooter,
  getEnvironmentScopeLabel,
  getProjectScopeLabel,
  getProjectsForSelection,
  getToggledProjectSelection,
  isProjectSelectionLimitExceeded,
  removeFilterRow,
  reorderCharts,
  SpansCommandPaletteActions,
} from 'sentry/views/explore/spans/spansCommandPaletteActions';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

function SlotOutlets() {
  return (
    <div style={{display: 'none'}}>
      <CommandPaletteSlot.Outlet name="task">
        {props => <div {...props} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="page">
        {props => <div {...props} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="global">
        {props => <div {...props} />}
      </CommandPaletteSlot.Outlet>
    </div>
  );
}

function ProjectSelectionPalette() {
  return (
    <CommandPaletteProvider>
      <SpansQueryParamsProvider>
        <SpansCommandPaletteActions />
      </SpansQueryParamsProvider>
      <SlotOutlets />
      <CommandPalette
        Body={ModalBody}
        CloseButton={makeCloseButton(closeModal)}
        Footer={ModalFooter}
        Header={makeClosableHeader(closeModal)}
        closeModal={closeModal}
      />
    </CommandPaletteProvider>
  );
}

describe('equation draft selection', () => {
  it('saves an equation and restores root keyboard navigation', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    render(<ProjectSelectionPalette />);

    await userEvent.click(await screen.findByRole('option', {name: 'Add Equation'}));
    await userEvent.click(
      await screen.findByRole('button', {name: 'Return to previous action'})
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Search commands'}), 'Chart');
    await userEvent.click(await screen.findByRole('option', {name: 'Chart B'}));

    await userEvent.type(screen.getByRole('textbox', {name: 'Edit Equation'}), '#1');
    await userEvent.keyboard('{Enter}');

    const searchInput = screen.getByRole('textbox', {
      name: 'Search commands',
    });
    await waitFor(() => expect(searchInput).toHaveFocus());
    await userEvent.keyboard('{ArrowDown}');
    expect(searchInput).toHaveFocus();
  });

  it('shows the applicable reset and conditional delete actions', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    render(<ProjectSelectionPalette />);

    const searchInput = await screen.findByRole('textbox', {name: 'Search commands'});
    await userEvent.type(searchInput, 'Chart A');
    await userEvent.keyboard('{ArrowDown}{Control>}{Shift>}{Enter}{/Shift}{/Control}');

    let actions = screen.getByRole('dialog', {name: 'More Actions'});
    expect(
      within(actions).getByRole('option', {name: 'Reset Chart'})
    ).toBeInTheDocument();
    expect(
      within(actions).queryByRole('option', {name: 'Delete Chart'})
    ).not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await userEvent.clear(searchInput);
    await userEvent.click(await screen.findByRole('option', {name: 'Add Equation'}));
    await userEvent.click(
      await screen.findByRole('button', {name: 'Return to previous action'})
    );
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'Chart B');
    await userEvent.keyboard('{ArrowDown}{Control>}{Shift>}{Enter}{/Shift}{/Control}');

    actions = screen.getByRole('dialog', {name: 'More Actions'});
    expect(
      within(actions).getByRole('option', {name: 'Reset Equation'})
    ).toBeInTheDocument();
    expect(
      within(actions).getByRole('option', {name: 'Delete Chart'})
    ).toBeInTheDocument();
  });

  it.each(['Source', 'Aggregate function'])(
    'resets a chart from its %s row without exiting the chart view',
    async rowName => {
      // React Aria's virtual focus schedules a passive update after the action.
      jest.spyOn(console, 'error').mockImplementation();
      ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);
      PageFiltersStore.onInitializeUrlState({
        projects: [1],
        environments: [],
        datetime: {period: '24h', start: null, end: null, utc: null},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace-items/attributes/',
        body: [],
      });

      render(<ProjectSelectionPalette />);

      const searchInput = screen.getByRole('textbox', {name: 'Search commands'});
      await userEvent.type(searchInput, 'Chart A');
      await userEvent.click(await screen.findByRole('option', {name: 'Chart A'}));
      await userEvent.keyboard(
        `${rowName === 'Source' ? '{ArrowDown}' : '{ArrowDown}{ArrowDown}'}{Control>}{Shift>}{Enter}{/Shift}{/Control}`
      );
      await userEvent.click(
        within(screen.getByRole('dialog', {name: 'More Actions'})).getByRole('option', {
          name: 'Reset Chart',
        })
      );

      expect(await screen.findByRole('option', {name: 'Source'})).toBeInTheDocument();
      expect(
        screen.getByRole('option', {name: 'Aggregate function'})
      ).toBeInTheDocument();
    }
  );
});

describe('project scope selection', () => {
  const projects = [
    ProjectFixture({id: '1', isMember: true, hasAccess: true}),
    ProjectFixture({id: '2', isMember: false, hasAccess: true}),
    ProjectFixture({id: '3', isMember: false, hasAccess: false}),
  ];

  it('expands compact project selections before editing them', () => {
    expect(getProjectsForSelection(projects, []).map(project => project.id)).toEqual([
      '1',
    ]);
    expect(
      getProjectsForSelection(projects, [ALL_ACCESS_PROJECTS]).map(project => project.id)
    ).toEqual(['1', '2']);
    expect(getProjectsForSelection(projects, [2]).map(project => project.id)).toEqual([
      '2',
    ]);
    expect(
      getProjectsForSelection(projects, [], true).map(project => project.id)
    ).toEqual(['1', '2', '3']);
  });

  it('prevents adding more than 50 explicit projects while allowing removal', () => {
    const fiftyProjects = Array.from({length: 50}, (_, index) => index + 1);
    const fiftyTwoProjects = Array.from({length: 52}, (_, index) => index + 1);

    expect(getToggledProjectSelection(fiftyProjects, 51)).toBeUndefined();
    expect(getToggledProjectSelection(fiftyTwoProjects, 52)).toEqual(
      fiftyTwoProjects.slice(0, -1)
    );
  });

  it('adds a project without replacing the existing explicit selection', () => {
    expect(getToggledProjectSelection([1], 2)).toEqual([1, 2]);
  });

  it('summarizes explicit projects like the PageFilterBar', () => {
    expect(getProjectScopeLabel(projects, [1])).toBe('My Projects');
    expect(getProjectScopeLabel(projects, [2])).toBe(projects[1]!.slug);
    expect(getProjectScopeLabel(projects, [1, 2])).toBe('My Projects +1');
    expect(getProjectScopeLabel(projects, [1, 2, 3])).toBe('My Projects +2');
    expect(
      getProjectScopeLabel(
        [
          ProjectFixture({id: '1', slug: 'frontend', isMember: false}),
          ProjectFixture({id: '2', slug: 'backend', isMember: false}),
          ProjectFixture({id: '3', slug: 'android', isMember: false}),
        ],
        [1, 2, 3]
      )
    ).toBe('frontend, backend, +1');
  });

  it('applies the project limit only to explicit selections', () => {
    expect(isProjectSelectionLimitExceeded([ALL_ACCESS_PROJECTS])).toBe(false);
    expect(
      isProjectSelectionLimitExceeded(Array.from({length: 51}, (_, index) => index + 1))
    ).toBe(true);
  });

  it('uses the My Projects icon for the compact My Projects scope', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', isMember: true}),
      ProjectFixture({id: '2', isMember: true}),
    ]);
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    render(<ProjectSelectionPalette />);

    const projectsOption = await screen.findByRole('option', {
      name: 'Projects',
    });
    expect(within(projectsOption).getByTestId('icon-my-projects')).toBeInTheDocument();
    expect(
      within(projectsOption).queryByTestId(/^platform-icon-/)
    ).not.toBeInTheDocument();
  });

  it('uses the generic project icon for multiple explicit projects', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', platform: 'javascript'}),
      ProjectFixture({id: '2', platform: 'python'}),
    ]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1, 2],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    render(<ProjectSelectionPalette />);

    const projectsOption = await screen.findByRole('option', {
      name: 'Projects',
    });
    expect(within(projectsOption).getByTestId('icon-projects')).toBeInTheDocument();
    expect(
      within(projectsOption).queryByTestId(/^platform-icon-/)
    ).not.toBeInTheDocument();
  });

  it('marks only All Projects as Current for the all-projects scope', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'frontend'}),
      ProjectFixture({id: '2', slug: 'backend'}),
    ]);
    PageFiltersStore.onInitializeUrlState({
      projects: [ALL_ACCESS_PROJECTS],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    render(<ProjectSelectionPalette />);
    await userEvent.click(await screen.findByRole('option', {name: 'Projects'}));

    expect(
      await screen.findByRole('option', {name: 'All Projects Current'})
    ).toBeInTheDocument();
    const frontend = screen.getByRole('option', {name: 'frontend'});
    expect(within(frontend).queryByText('Current')).not.toBeInTheDocument();
    expect(within(frontend).getByRole('checkbox', {hidden: true})).toBeChecked();
  });

  it('keeps a project added with Enter in the draft until changes are applied', async () => {
    // React Aria's virtual focus schedules a passive update after the keyboard action.
    jest.spyOn(console, 'error').mockImplementation();
    const selectedProjects = [
      ProjectFixture({
        id: '1',
        slug: 'frontend',
        environments: ['production'],
        isMember: true,
      }),
      ProjectFixture({
        id: '2',
        slug: 'backend',
        environments: ['production'],
        isMember: true,
      }),
      ProjectFixture({
        id: '3',
        slug: 'android',
        environments: ['production'],
        isMember: false,
      }),
    ];
    ProjectsStore.loadInitialData(selectedProjects);
    PageFiltersStore.onInitializeUrlState({
      projects: [1, 2],
      environments: ['production'],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    const {router} = render(<ProjectSelectionPalette />, {
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            environment: 'production',
            project: ['1', '2'],
            statsPeriod: '24h',
          },
        },
      },
    });

    await userEvent.click(await screen.findByRole('option', {name: 'Projects'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search commands'}),
      'android'
    );
    await userEvent.keyboard('{ArrowDown}{Shift>}{Enter}{/Shift}');

    const selectedAndroid = await screen.findByRole('option', {
      name: /android/,
    });
    expect(within(selectedAndroid).getByRole('checkbox', {hidden: true})).toBeChecked();
    expect(within(selectedAndroid).queryByText('Current')).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByText('My Projects +1')).toBeInTheDocument();
    expect(PageFiltersStore.getState().selection.projects).toEqual([1, 2]);
    expect(router.location.query.project).toEqual(['1', '2']);

    await userEvent.keyboard('{Enter}');
    const android = await screen.findByRole('option', {name: /android/});
    expect(within(android).getByText('Current')).toBeInTheDocument();
    expect(within(android).getByRole('checkbox', {hidden: true})).toBeChecked();

    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}');
    await userEvent.click(
      within(screen.getByRole('dialog', {name: 'More Actions'})).getByRole('option', {
        name: 'Reset Project Selection',
      })
    );
    expect(await screen.findByText('My Projects')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search for projects')).toBeInTheDocument();
    expect(PageFiltersStore.getState().selection.projects).toEqual([1, 2]);
    expect(router.location.query.project).toEqual(['1', '2']);

    await userEvent.keyboard('{Enter}');
    expect(
      await screen.findByRole('option', {name: 'Apply Changes'})
    ).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('option', {name: 'Apply Changes'}));
    expect(PageFiltersStore.getState().selection.projects).toEqual([]);
    expect(PageFiltersStore.getState().selection.environments).toEqual([]);
    await waitFor(() => expect(router.location.query.project).toBeUndefined());
    expect(router.location.query.environment).toBeUndefined();
    expect(router.location.query.statsPeriod).toBe('24h');
  });
});

describe('scope summary reset actions', () => {
  it.each([
    ['Projects', 'Reset Project Selection', 'My Projects'],
    ['Environments', 'Reset Environment Selection', 'All Environments'],
    ['Time range', 'Reset Time Range', 'Last 14 days'],
  ])('resets %s directly on the root summary', async (summary, reset, resetValue) => {
    jest.spyOn(console, 'error').mockImplementation();
    ProjectsStore.loadInitialData([
      ProjectFixture({
        id: '1',
        slug: 'frontend',
        environments: ['production'],
      }),
    ]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: ['production'],
      datetime: {period: '7d', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    render(<ProjectSelectionPalette />);

    const searchInput = await screen.findByRole('textbox', {name: 'Search commands'});
    await userEvent.type(searchInput, summary);
    await userEvent.keyboard('{ArrowDown}{Control>}{Shift>}{Enter}{/Shift}{/Control}');

    await userEvent.click(
      within(screen.getByRole('dialog', {name: 'More Actions'})).getByRole('option', {
        name: reset,
      })
    );

    expect(screen.queryByRole('dialog', {name: 'More Actions'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Return to previous action'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('option', {name: new RegExp(summary)})).toHaveTextContent(
      resetValue
    );
    expect(screen.getByRole('textbox', {name: 'Search commands'})).toHaveValue(summary);
  });
});

describe('environment scope selection', () => {
  it('summarizes selected environments like the PageFilterBar', () => {
    expect(getEnvironmentScopeLabel([])).toBe('All Environments');
    expect(getEnvironmentScopeLabel(['prod', 'production'])).toBe('prod, production');
    expect(getEnvironmentScopeLabel(['prod', 'production', 'staging'])).toBe(
      'prod, production, +1'
    );
  });

  it('keeps environments added with Enter in the draft until changes are applied', async () => {
    // React Aria's virtual focus schedules a passive update after the keyboard action.
    jest.spyOn(console, 'error').mockImplementation();
    ProjectsStore.loadInitialData([
      ProjectFixture({
        id: '1',
        slug: 'frontend',
        environments: ['prod', 'production'],
      }),
    ]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: ['production'],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    const {router} = render(<ProjectSelectionPalette />, {
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            environment: 'production',
            project: '1',
            statsPeriod: '24h',
          },
        },
      },
    });

    await userEvent.click(await screen.findByRole('option', {name: 'Environments'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Search commands'}), 'prod');
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(await screen.findByText('production, prod')).toBeInTheDocument();
    expect(PageFiltersStore.getState().selection.environments).toEqual(['production']);
    expect(router.location.query.environment).toBe('production');

    await userEvent.keyboard('{Enter}');
    const prod = await screen.findByRole('option', {name: 'prod Current'});
    expect(
      within(prod).getByRole('checkbox', {
        hidden: true,
      })
    ).toBeChecked();
    expect(
      within(await screen.findByRole('option', {name: /^production/})).getByRole(
        'checkbox',
        {hidden: true}
      )
    ).toBeChecked();

    await userEvent.type(screen.getByRole('textbox', {name: 'Search commands'}), 'prod');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(await screen.findByText('production')).toBeInTheDocument();
    expect(PageFiltersStore.getState().selection.environments).toEqual(['production']);
    expect(router.location.query.environment).toBe('production');

    await userEvent.click(await screen.findByRole('option', {name: 'Environments'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Search commands'}), 'prod');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(await screen.findByText('production, prod')).toBeInTheDocument();

    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}');
    await userEvent.click(
      within(screen.getByRole('dialog', {name: 'More Actions'})).getByRole('option', {
        name: 'Reset Environment Selection',
      })
    );
    expect(await screen.findByText('All Environments')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search for environments')).toBeInTheDocument();
    expect(PageFiltersStore.getState().selection.environments).toEqual(['production']);
    expect(router.location.query.environment).toBe('production');

    await userEvent.keyboard('{Enter}');
    expect(
      await screen.findByRole('option', {name: 'Apply Changes'})
    ).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('option', {name: 'Apply Changes'}));
    expect(PageFiltersStore.getState().selection.environments).toEqual([]);
    await waitFor(() => expect(router.location.query.environment).toBeUndefined());
  });
});

describe('time range selection', () => {
  it('keeps changes in the draft, resets in place, and applies from the root', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    const {router} = render(<ProjectSelectionPalette />, {
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {project: '1', statsPeriod: '24h'},
        },
      },
    });

    await userEvent.click(await screen.findByRole('option', {name: 'Time range'}));
    expect(
      await screen.findByRole('option', {name: 'Last 24 hours Current'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', {name: 'Last 7 days'}));

    expect(await screen.findByText('Last 7 days')).toBeInTheDocument();
    expect(PageFiltersStore.getState().selection.datetime.period).toBe('24h');
    expect(router.location.query.statsPeriod).toBe('24h');

    await userEvent.click(await screen.findByRole('option', {name: 'Time range'}));
    expect(
      await screen.findByRole('option', {name: 'Last 7 days Current'})
    ).toBeInTheDocument();

    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}');
    await userEvent.click(
      within(screen.getByRole('dialog', {name: 'More Actions'})).getByRole('option', {
        name: 'Reset Time Range',
      })
    );
    expect(await screen.findByText('Last 14 days')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Select a time range')).toBeInTheDocument();
    expect(PageFiltersStore.getState().selection.datetime.period).toBe('24h');
    expect(router.location.query.statsPeriod).toBe('24h');

    await userEvent.keyboard('{Enter}');
    expect(
      await screen.findByRole('option', {name: 'Apply Changes'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', {name: 'Apply Changes'}));

    expect(PageFiltersStore.getState().selection.datetime.period).toBe('14d');
    await waitFor(() => expect(router.location.query.statsPeriod).toBe('14d'));
  });
});

describe('draft command actions', () => {
  it('uses temporary scope values in Save as navigation', async () => {
    jest.spyOn(console, 'error').mockImplementation();
    ProjectsStore.loadInitialData([
      ProjectFixture({
        id: '1',
        environments: ['production', 'staging'],
      }),
    ]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: ['production'],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    const {router} = render(<ProjectSelectionPalette />, {
      organization: OrganizationFixture({features: ['incidents']}),
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            environment: 'production',
            project: '1',
            statsPeriod: '24h',
          },
        },
      },
    });

    await userEvent.click(await screen.findByRole('option', {name: 'Environments'}));
    await userEvent.click(
      await screen.findByRole('option', {name: 'production Current'})
    );
    await userEvent.click(await screen.findByRole('option', {name: 'Environments'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search commands'}),
      'staging'
    );
    await userEvent.click(await screen.findByRole('option', {name: 'staging'}));
    expect(await screen.findByText('staging')).toBeInTheDocument();
    expect(router.location.query.environment).toBe('production');

    await userEvent.click(await screen.findByRole('option', {name: 'Save as'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Monitor for'}));

    const monitorOption = await screen.findByRole('option', {
      name: 'count(spans)',
    });
    await userEvent.click(monitorOption);
    expect(router.location.pathname).toBe(
      '/organizations/org-slug/monitors/new/settings'
    );
    expect(router.location.query.environment).toBe('staging');
  });

  it('shows Compare Charts after adding a second chart', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    render(<ProjectSelectionPalette />);

    expect(
      screen.queryByRole('option', {name: 'Compare Charts'})
    ).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('option', {name: 'Add Chart'}));
    expect(
      await screen.findByRole('option', {name: 'Compare Charts'})
    ).toBeInTheDocument();
  });
});

describe('group by draft selection', () => {
  it('adds blank group by and filter rows without opening attribute pickers', async () => {
    // React Aria's virtual focus schedules a passive update after the keyboard action.
    jest.spyOn(console, 'error').mockImplementation();
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    render(<ProjectSelectionPalette />);

    const searchInput = await screen.findByRole('textbox', {
      name: 'Search commands',
    });
    await userEvent.type(searchInput, 'Group By');
    await userEvent.keyboard('{ArrowDown}{Control>}{Shift>}{Enter}{/Shift}{/Control}');
    await userEvent.click(
      within(screen.getByRole('dialog', {name: 'More Actions'})).getByRole('option', {
        name: 'Add Group By',
      })
    );

    expect(await screen.findAllByRole('option', {name: 'Group By'})).toHaveLength(2);
    expect(screen.queryByPlaceholderText('Search for attribute')).not.toBeInTheDocument();

    await userEvent.type(searchInput, 'Filter By');
    await userEvent.keyboard('{ArrowDown}{Control>}{Shift>}{Enter}{/Shift}{/Control}');
    await userEvent.click(
      within(screen.getByRole('dialog', {name: 'More Actions'})).getByRole('option', {
        name: 'Add Filter By',
      })
    );

    expect(await screen.findAllByRole('option', {name: 'Filter By'})).toHaveLength(2);
    expect(screen.queryByPlaceholderText('Search for attribute')).not.toBeInTheDocument();
  });

  it('adds only the selected group by when returning to the query', async () => {
    // React Aria's virtual focus schedules a passive update after the keyboard action.
    jest.spyOn(console, 'error').mockImplementation();
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    render(<ProjectSelectionPalette />);

    await userEvent.click(await screen.findByRole('option', {name: 'Group By'}));
    const attributeInput = screen.getByPlaceholderText('Search for attribute');
    await userEvent.type(attributeInput, 'span.op');
    await userEvent.keyboard('{ArrowDown}{Enter}');

    const groupByRows = await screen.findAllByRole('option', {
      name: 'Group By',
    });
    expect(groupByRows).toHaveLength(1);
    expect(within(groupByRows[0]!).getByText('span.op')).toBeInTheDocument();
  });

  it('replaces the pending row without adding a duplicate group by', () => {
    const selected = addGroupByToDraftState(
      {groupBys: [], pendingRows: 1},
      'environment'
    );

    expect(selected).toEqual({groupBys: ['environment'], pendingRows: 0});
    expect(addGroupByToDraftState(selected, 'environment')).toBe(selected);
  });
});

describe('filter draft selection', () => {
  function renderPaletteWithQuery(query: string) {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    return render(<ProjectSelectionPalette />, {
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {project: '1', query, statsPeriod: '24h'},
        },
      },
    });
  }

  async function openFilterActions(search: string) {
    const searchInput = await screen.findByRole('textbox', {
      name: 'Search commands',
    });
    await userEvent.type(searchInput, search);
    await userEvent.keyboard('{ArrowDown}{Control>}{Shift>}{Enter}{/Shift}{/Control}');
    return screen.getByRole('dialog', {name: 'More Actions'});
  }

  it('offers row-specific filter actions without renaming them', async () => {
    renderPaletteWithQuery('span.op:http.server');

    const actions = await openFilterActions('http.server');

    expect(
      within(actions).getByRole('option', {name: 'Add Filter By'})
    ).toBeInTheDocument();
    expect(
      within(actions).getByRole('option', {name: 'Clear Filter'})
    ).toBeInTheDocument();
    expect(
      within(actions).getByRole('option', {name: 'Change Filter Attribute'})
    ).toBeInTheDocument();
    expect(
      within(actions).getByRole('option', {name: 'Change Filter Operator'})
    ).toBeInTheDocument();
    expect(
      within(actions).getByRole('option', {name: 'Change Filter Value'})
    ).toBeInTheDocument();
    expect(
      within(actions).queryByRole('option', {name: 'Delete Filter'})
    ).not.toBeInTheDocument();
  });

  it('adds a separate pending filter from an existing filter row', async () => {
    renderPaletteWithQuery('span.op:http.server');

    await userEvent.click(
      within(await openFilterActions('http.server')).getByRole('option', {
        name: 'Add Filter By',
      })
    );

    expect(await screen.findAllByRole('option', {name: 'Filter By'})).toHaveLength(2);
    expect(screen.queryByPlaceholderText('Search for attribute')).not.toBeInTheDocument();
  });

  it('only offers deletion when multiple filter rows exist', async () => {
    renderPaletteWithQuery('span.op:http.server environment:production');

    const actions = await openFilterActions('http.server');

    expect(
      within(actions).getByRole('option', {name: 'Delete Filter'})
    ).toBeInTheDocument();
  });

  it('reopens an existing filter at the attribute step with current values', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/span.op/values/',
      body: [{value: 'http.server'}],
    });

    render(<ProjectSelectionPalette />, {
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            project: '1',
            query: 'span.op:http.server',
            statsPeriod: '24h',
          },
        },
      },
    });

    await userEvent.click(await screen.findByRole('option', {name: 'Filter By'}));
    expect(screen.getByPlaceholderText('Search for attribute')).toBeInTheDocument();

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search commands'}),
      'span.op'
    );
    await userEvent.click(await screen.findByRole('option', {name: 'span.op Current'}));
    expect(screen.getByPlaceholderText('Search for operator')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('option', {name: 'is Current'}));
    expect(screen.getByPlaceholderText('Search for value')).toBeInTheDocument();
    expect(
      await screen.findByRole('option', {name: 'http.server Current'})
    ).toBeInTheDocument();
  });

  it('keeps a selected filter in the palette and out of the URL until apply', async () => {
    // React Aria's virtual focus schedules a passive update after the keyboard action.
    jest.spyOn(console, 'error').mockImplementation();
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/span.op/values/',
      body: [{value: 'http.server'}],
    });

    const {router} = render(<ProjectSelectionPalette />, {
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {project: '1', statsPeriod: '24h'},
        },
      },
    });

    await userEvent.click(await screen.findByRole('option', {name: 'Filter By'}));
    await userEvent.type(screen.getByPlaceholderText('Search for attribute'), 'span.op');
    await userEvent.click(await screen.findByRole('option', {name: 'span.op'}));
    await userEvent.click(await screen.findByRole('option', {name: 'is'}));
    expect(await screen.findByRole('option', {name: 'http.server'})).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(screen.getByRole('textbox', {name: 'Search commands'})).toBeInTheDocument();
    expect(await screen.findByText('span.op:http.server')).toBeInTheDocument();
    expect(router.location.query.query).toBeUndefined();

    await userEvent.click(await screen.findByRole('option', {name: 'Apply Changes'}));
    await waitFor(() => expect(router.location.query.query).toBe('span.op:http.server'));
  });

  it('adds a has filter for a string attribute', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'})]);
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '24h', start: null, end: null, utc: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [
        {
          attributeType: 'string',
          key: 'gen_ai.output_messages',
          name: 'gen_ai.output_messages',
          attributeSource: {source_type: 'user'},
        },
      ],
    });

    const {router} = render(<ProjectSelectionPalette />, {
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {project: '1', statsPeriod: '24h'},
        },
      },
    });

    await userEvent.click(await screen.findByRole('option', {name: 'Filter By'}));
    await userEvent.type(
      screen.getByPlaceholderText('Search for attribute'),
      'gen_ai.output_messages'
    );
    await userEvent.click(
      await screen.findByRole('option', {name: 'gen_ai.output_messages'})
    );
    await userEvent.click(await screen.findByRole('option', {name: 'has'}));

    expect(await screen.findByText('has:gen_ai.output_messages')).toBeInTheDocument();
    expect(router.location.query.query).toBeUndefined();
  });
});

describe('canCompareQueries', () => {
  it('requires at least two chart queries', () => {
    const chart = () => new VisualizeFunction(DEFAULT_VISUALIZATION);

    expect(canCompareQueries([chart()])).toBe(false);
    expect(canCompareQueries([chart(), new VisualizeEquation('#1 + #2')])).toBe(false);
    expect(canCompareQueries([chart(), chart()])).toBe(true);
  });
});

describe('chart reordering', () => {
  const charts = [
    new VisualizeFunction('count(span.duration)'),
    new VisualizeFunction('p95(span.duration)'),
    new VisualizeEquation('#1 + #2'),
  ];

  it('is available only with multiple distinguishable charts', () => {
    expect(canReorderCharts(charts.slice(0, 1))).toBe(false);
    expect(canReorderCharts(charts.slice(0, 2))).toBe(true);
    expect(
      canReorderCharts([
        new VisualizeFunction('count(span.duration)'),
        new VisualizeFunction('count(span.duration)'),
      ])
    ).toBe(false);
  });

  it('moves a chart in either direction without mutating the input', () => {
    expect(reorderCharts(charts, 0, 'down')).toEqual([charts[1], charts[0], charts[2]]);
    expect(reorderCharts(charts, 2, 'up')).toEqual([charts[0], charts[2], charts[1]]);
    expect(charts.map(chart => chart.yAxis)).toEqual([
      'count(span.duration)',
      'p95(span.duration)',
      '#1 + #2',
    ]);
  });

  it('moves the chart label together with its value', () => {
    const chartRows = charts.map((visualize, index) => ({
      label: `Chart ${String.fromCharCode(65 + index)}`,
      visualize,
    }));

    expect(
      reorderCharts(chartRows, 0, 'down').map(({label, visualize}) => [
        label,
        visualize.yAxis,
      ])
    ).toEqual([
      ['Chart B', 'p95(span.duration)'],
      ['Chart A', 'count(span.duration)'],
      ['Chart C', '#1 + #2'],
    ]);
  });

  it('does not move a chart beyond the list boundaries', () => {
    expect(reorderCharts(charts, 0, 'up')).toEqual(charts);
    expect(reorderCharts(charts, charts.length - 1, 'down')).toEqual(charts);
  });
});

describe('EquationFooter', () => {
  it('shows charts added after the equation using their actual labels', () => {
    render(
      <EquationFooter
        index={1}
        visualizes={[
          new VisualizeFunction('count(span.duration)'),
          new VisualizeEquation('equation|count(span.duration) / p95(span.duration)'),
          new VisualizeFunction('p95(span.duration)'),
        ]}
      />
    );

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('count(span.duration)')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('p95(span.duration)')).toBeInTheDocument();
    expect(
      screen.queryByText('count(span.duration) / p95(span.duration)')
    ).not.toBeInTheDocument();
  });
});

describe('chart deletion', () => {
  const charts = [{id: 0}, {id: 1}, {id: 2}];

  it('is available only with at least two charts', () => {
    expect(canDeleteChart(charts.slice(0, 1))).toBe(false);
    expect(canDeleteChart(charts.slice(0, 2))).toBe(true);
  });

  it('deletes only the selected chart without mutating the input', () => {
    expect(deleteChart(charts, 1)).toEqual([{id: 0}, {id: 2}]);
    expect(charts).toHaveLength(3);
  });

  it('leaves charts unchanged when the selected id does not exist', () => {
    expect(deleteChart(charts, 4)).toEqual(charts);
  });
});

describe('addSearchFilterToQuery', () => {
  it('does not add the same filter twice', () => {
    expect(
      addSearchFilterToQuery('project:frontend-react', {
        key: 'project',
        op: TermOperator.DEFAULT,
        value: 'frontend-react',
      })
    ).toBe('project:frontend-react');
  });

  it('preserves distinct values for the same attribute', () => {
    expect(
      addSearchFilterToQuery('project:frontend-react', {
        key: 'project',
        op: TermOperator.DEFAULT,
        value: 'backend-python',
      })
    ).toBe('project:frontend-react project:backend-python');
  });

  it('does not add the same negated filter twice', () => {
    expect(
      addSearchFilterToQuery('!project:frontend-react', {
        key: 'project',
        op: TermOperator.NOT_EQUAL,
        value: 'frontend-react',
      })
    ).toBe('!project:frontend-react');
  });

  it.each([
    [TermOperator.CONTAINS, '', WildcardOperators.CONTAINS],
    [TermOperator.DOES_NOT_CONTAIN, '!', WildcardOperators.CONTAINS],
    [TermOperator.STARTS_WITH, '', WildcardOperators.STARTS_WITH],
    [TermOperator.DOES_NOT_START_WITH, '!', WildcardOperators.STARTS_WITH],
    [TermOperator.ENDS_WITH, '', WildcardOperators.ENDS_WITH],
    [TermOperator.DOES_NOT_END_WITH, '!', WildcardOperators.ENDS_WITH],
  ])('serializes the %s wildcard operator', (op, negation, wildcard) => {
    expect(
      addSearchFilterToQuery('', {
        key: 'span.description',
        op,
        value: 'checkout request',
      })
    ).toBe(`${negation}span.description:${wildcard}"checkout request"`);
  });

  it('preserves multiple wildcard values for the same attribute', () => {
    expect(
      addSearchFilterToQuery(`span.description:${WildcardOperators.CONTAINS}checkout`, {
        key: 'span.description',
        op: TermOperator.CONTAINS,
        value: 'payment',
      })
    ).toBe(
      `span.description:${WildcardOperators.CONTAINS}checkout ` +
        `span.description:${WildcardOperators.CONTAINS}payment`
    );
  });

  it('does not conflate exact and wildcard values when deduplicating', () => {
    expect(
      addSearchFilterToQuery('span.description:checkout', {
        key: 'span.description',
        op: TermOperator.CONTAINS,
        value: 'checkout',
      })
    ).toBe(
      `span.description:checkout span.description:${WildcardOperators.CONTAINS}checkout`
    );
  });
});

describe('getFilterRows', () => {
  it('returns one row for each flat filter', () => {
    expect(
      getFilterRows(
        'project:frontend-react tags[browser.name,string]:Chrome !span.op:http'
      )
    ).toEqual([
      'project:frontend-react',
      'tags[browser.name,string]:Chrome',
      '!span.op:http',
    ]);
  });

  it('keeps quoted and wildcard values intact', () => {
    expect(
      getFilterRows('span.description:"checkout request" transaction:*checkout*')
    ).toEqual(['span.description:"checkout request"', 'transaction:*checkout*']);
  });

  it('keeps a JSON filter visible and separates a subsequent filter', () => {
    const inputMessages =
      '[{"content": [{"text": "I want to buy plants for full sunlight"}], "role": "user"}]';
    const inputFilter = addSearchFilterToQuery('', {
      key: 'gen_ai.input.messages',
      op: TermOperator.CONTAINS,
      value: inputMessages,
    });

    expect(getFilterRows(inputFilter)).toEqual([inputFilter]);

    const query = addSearchFilterToQuery(inputFilter, {
      key: 'gen_ai.response.model',
      op: TermOperator.DEFAULT,
      value: 'gpt-4o',
    });

    expect(getFilterRows(query)).toEqual([inputFilter, 'gen_ai.response.model:gpt-4o']);
  });

  it('returns no rows for an empty query', () => {
    expect(getFilterRows('   ')).toEqual([]);
  });

  it('keeps complex search syntax together', () => {
    const query = '(project:frontend-react OR project:backend-python) error';

    expect(getFilterRows(query)).toEqual([query]);
  });
});

describe('removeSearchFilterFromQuery', () => {
  it('removes only the selected filter', () => {
    const query =
      'environment:production gen_ai.response.model:gpt-4o span.op:gen_ai.request';

    expect(removeSearchFilterFromQuery(query, 1)).toBe(
      'environment:production span.op:gen_ai.request'
    );
  });

  it('deletes a newly added empty row', () => {
    expect(removeFilterRow({query: 'environment:production', pendingRows: 1}, 1)).toEqual(
      {query: 'environment:production', pendingRows: 0}
    );
  });

  it('keeps one empty row after removing the final filter', () => {
    expect(removeFilterRow({query: 'environment:production', pendingRows: 0}, 0)).toEqual(
      {query: '', pendingRows: 1}
    );
  });

  it('clears a filter while preserving its row', () => {
    expect(
      clearFilterRow(
        {
          query: 'environment:production gen_ai.response.model:gpt-4o',
          pendingRows: 0,
        },
        0
      )
    ).toEqual({query: 'gen_ai.response.model:gpt-4o', pendingRows: 1});
  });

  it('replaces only the selected filter', () => {
    expect(
      replaceSearchFilterInQuery(
        'environment:production gen_ai.response.model:gpt-4o',
        1,
        {
          key: 'gen_ai.response.model',
          op: TermOperator.NOT_EQUAL,
          value: 'gpt-5',
        }
      )
    ).toBe('environment:production !gen_ai.response.model:gpt-5');
  });

  it('gets the attribute used by a filter', () => {
    expect(getSearchFilterAttribute('gen_ai.response.model:gpt-4o')).toBe(
      'gen_ai.response.model'
    );
  });
});
