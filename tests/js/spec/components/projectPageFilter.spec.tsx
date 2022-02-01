import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectPageFilter from 'sentry/components/projectPageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('ProjectPageFilter', function () {
  const {organization, router, routerContext} = initializeOrg({
    organization: {features: ['global-views', 'selection-filters-v2']},
    project: undefined,
    projects: [
      {
        id: 2,
        slug: 'project-2',
      },
    ],
    router: {
      location: {query: {}},
      params: {orgId: 'org-slug'},
    },
  });
  OrganizationStore.onUpdate(organization, {replace: true});
  ProjectsStore.loadInitialData(organization.projects);

  beforeEach(() => {
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.onInitializeUrlState({
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      });
    });
  });

  it('can pick project', function () {
    mountWithTheme(
      <OrganizationContext.Provider value={organization}>
        <ProjectPageFilter />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );

    // Open the project dropdown
    expect(screen.getByText('My Projects')).toBeInTheDocument();
    userEvent.click(screen.getByText('My Projects'));

    // Click the first project's checkbox
    const projectOptions = screen.getAllByTestId('checkbox-fancy');
    userEvent.click(projectOptions[0]);

    // Confirm the selection changed the visible text
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();

    // Close the dropdown
    userEvent.click(screen.getAllByText('project-2')[0]);

    // Verify we were redirected
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: [], project: ['2']}})
    );
  });

  it('can pin selection', async function () {
    mountWithTheme(
      <OrganizationContext.Provider value={organization}>
        <ProjectPageFilter />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );

    // Open the project dropdown
    expect(screen.getByText('My Projects')).toBeInTheDocument();
    userEvent.click(screen.getByText('My Projects'));

    // Click the pin button
    const pinButton = screen.getByRole('button', {name: 'Pin'});
    userEvent.click(pinButton);

    await screen.findByRole('button', {name: 'Pin', pressed: true});

    expect(PageFiltersStore.getState()).toEqual(
      expect.objectContaining({
        pinnedFilters: new Set(['projects']),
      })
    );
  });

  it('can quick select', async function () {
    mountWithTheme(
      <OrganizationContext.Provider value={organization}>
        <ProjectPageFilter />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );

    // Open the project dropdown
    expect(screen.getByText('My Projects')).toBeInTheDocument();
    userEvent.click(screen.getByText('My Projects'));

    // Click the first project's checkbox
    const projectLabel = screen.getByText('project-2');
    userEvent.click(projectLabel);

    // Verify we were redirected
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: [], project: ['2']}})
    );

    await screen.findByText('project-2');

    // Verify store state
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
    );
  });
});
