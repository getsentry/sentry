import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectPageFilter from 'sentry/components/projectPageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';

const {organization, router, routerContext} = initializeOrg({
  organization: {features: ['global-views']},
  project: undefined,
  projects: [
    {
      id: '2',
      slug: 'project-2',
    },
  ],
  router: {
    location: {
      pathname: '/organizations/org-slug/issues/',
      query: {},
    },
    params: {},
  },
});

describe('ProjectPageFilter', function () {
  beforeEach(() => {
    OrganizationStore.init();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      },
      new Set()
    );

    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData(organization.projects);
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('can pick project', async function () {
    render(<ProjectPageFilter />, {
      context: routerContext,
      organization,
    });

    // Open the project dropdown
    expect(screen.getByText('My Projects')).toBeInTheDocument();
    await userEvent.click(screen.getByText('My Projects'));

    // Select project-2
    await userEvent.click(screen.getByRole('checkbox', {name: 'project-2'}));

    // Confirm the selection changed the visible text
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();

    // Close the dropdown
    await userEvent.click(screen.getAllByText('project-2')[0]);

    // Verify we were redirected
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: [], project: ['2']}})
    );
  });

  it('can pin selection', async function () {
    render(<ProjectPageFilter />, {
      context: routerContext,
      organization,
    });

    // Open the project dropdown
    expect(screen.getByText('My Projects')).toBeInTheDocument();
    await userEvent.click(screen.getByText('My Projects'));

    // Click the pin button
    const pinButton = screen.getByRole('button', {name: 'Lock filter'});
    await userEvent.click(pinButton, {skipHover: true});

    await screen.findByRole('button', {name: 'Lock filter', pressed: true});

    // Check if the pin indicator has been added
    expect(screen.getByLabelText('Filter applied across pages')).toBeInTheDocument();

    expect(PageFiltersStore.getState()).toEqual(
      expect.objectContaining({
        pinnedFilters: new Set(['projects']),
      })
    );
  });

  it('can quick select', async function () {
    render(<ProjectPageFilter />, {
      context: routerContext,
      organization,
    });

    // Open the project dropdown
    expect(screen.getByText('My Projects')).toBeInTheDocument();
    await userEvent.click(screen.getByText('My Projects'));

    // Click the first project's checkbox
    await userEvent.click(screen.getByText('project-2'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: [], project: ['2']}})
    );

    await screen.findByText('project-2');

    await waitFor(() =>
      expect(PageFiltersStore.getState()).toEqual(
        expect.objectContaining({
          isReady: true,
          selection: {
            datetime: {
              end: null,
              period: '14d',
              start: null,
              utc: null,
            },
            environments: [],
            projects: [2],
          },
        })
      )
    );
  });

  it('will change projects when page filter selection changes, async e.g. from back button nav', async function () {
    render(<ProjectPageFilter />, {
      context: routerContext,
      organization,
    });

    // Confirm initial selection
    expect(screen.getByText('My Projects')).toBeInTheDocument();

    // Edit page filter project selection
    act(() => {
      PageFiltersStore.updateProjects([2], []);
    });

    // Page filter selection change should affect project page filter
    expect(await screen.findByText('project-2')).toBeInTheDocument();
  });
});
