import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture, ProjectFixture} from 'sentry-fixture/project';
import {ProjectFiltersFixture} from 'sentry-fixture/projectFilters';
import {TombstonesFixture} from 'sentry-fixture/tombstones';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import ProjectFilters from 'sentry/views/settings/project/projectFilters';

describe('ProjectFilters', () => {
  const {organization, project} = initializeOrg();
  const PROJECT_URL = `/projects/${organization.slug}/${project.slug}/`;

  const getFilterEndpoint = (filter: string) => `${PROJECT_URL}filters/${filter}/`;

  const createFilterMock = (
    filter: string,
    options: Parameters<typeof MockApiClient.addMockResponse>[0] = {}
  ) =>
    MockApiClient.addMockResponse({
      url: getFilterEndpoint(filter),
      method: 'PUT',
      ...options,
    });

  const initialRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/projects/${project.slug}/filters/data-filters/`,
    },
    route: '/settings/:orgId/projects/:projectId/filters/:filterType/',
  };

  function renderComponent() {
    return render(<ProjectFilters />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/stats_v2/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: PROJECT_URL,
      body: DetailedProjectFixture({slug: project.slug}),
    });

    MockApiClient.addMockResponse({
      url: `${PROJECT_URL}filters/`,
      body: ProjectFiltersFixture(),
    });

    MockApiClient.addMockResponse({
      url: `${PROJECT_URL}tombstones/`,
      body: TombstonesFixture(),
    });
  });

  it('has browser extensions enabled initially', async () => {
    renderComponent();

    const filter = 'browser-extensions';
    const mock = createFilterMock(filter, {asyncDelay: 100});

    const control = await screen.findByRole('checkbox', {
      name: 'Filter out errors known to be caused by browser extensions',
    });

    expect(control).toBeChecked();
    await userEvent.click(control);
    expect(control).not.toBeChecked();

    expect(mock).toHaveBeenCalledWith(
      getFilterEndpoint(filter),
      expect.objectContaining({
        method: 'PUT',
        data: {
          active: false,
        },
      })
    );
    await waitFor(() => {
      expect(
        screen.queryByRole('status', {name: `Saving ${filter}`})
      ).not.toBeInTheDocument();
    });
    expect(control).not.toBeChecked();
  });

  it('can toggle filters: localhost, web crawlers', async () => {
    renderComponent();

    const FILTERS = {
      localhost: 'Filter out events coming from localhost',
      'web-crawlers': 'Filter out known web crawlers',
    };

    await screen.findByText('Filters');

    for (const filter of Object.keys(FILTERS)) {
      const mock = createFilterMock(filter);

      await userEvent.click(
        screen.getByRole('checkbox', {name: FILTERS[filter as keyof typeof FILTERS]})
      );
      expect(mock).toHaveBeenCalledWith(
        getFilterEndpoint(filter),
        expect.objectContaining({
          method: 'PUT',
          data: {
            active: true,
          },
        })
      );
    }
  });

  it('keeps project option filters toggled after autosave resets', async () => {
    renderComponent();

    const updatedProject = DetailedProjectFixture({
      slug: project.slug,
      options: {
        'filters:chunk-load-error': true,
      },
    });

    const mock = MockApiClient.addMockResponse({
      url: PROJECT_URL,
      method: 'PUT',
      asyncDelay: 100,
      body: updatedProject,
    });

    MockApiClient.addMockResponse({
      url: PROJECT_URL,
      body: updatedProject,
    });

    const control = await screen.findByRole('checkbox', {
      name: 'Filter out ChunkLoadError(s)',
    });
    expect(control).not.toBeChecked();

    await userEvent.click(control);
    expect(control).toBeChecked();

    expect(mock).toHaveBeenCalledWith(
      PROJECT_URL,
      expect.objectContaining({
        method: 'PUT',
        data: {
          options: {
            'filters:chunk-load-error': true,
          },
        },
      })
    );
    await waitFor(() => {
      expect(
        screen.queryByRole('status', {name: 'Saving filters:chunk-load-error'})
      ).not.toBeInTheDocument();
    });
    expect(control).toBeChecked();
  });

  it('has correct legacy browsers selected', async () => {
    renderComponent();

    expect(
      await screen.findByRole('checkbox', {
        name: 'Internet Explorer Version 11 and lower',
      })
    ).toBeChecked();

    expect(
      await screen.findByRole('checkbox', {
        name: 'Safari Version 15 and lower',
      })
    ).toBeChecked();

    expect(
      screen.getByRole('checkbox', {name: 'Firefox Version 110 and lower'})
    ).not.toBeChecked();
  });

  it('can toggle legacy browser', async () => {
    renderComponent();

    const filter = 'legacy-browsers';
    const mock = createFilterMock(filter, {asyncDelay: 100});
    const firefoxToggle = await screen.findByRole('checkbox', {
      name: 'Firefox Version 110 and lower',
    });

    await userEvent.click(firefoxToggle);
    expect(firefoxToggle).toBeChecked();
    expect(
      await screen.findByRole('status', {name: 'Saving legacy-browsers'})
    ).toBeInTheDocument();
    expect(mock.mock.calls[0][0]).toBe(getFilterEndpoint(filter));
    expect(Array.isArray(mock.mock.calls[0][1].data.subfilters)).toBe(true);
    expect(mock.mock.calls[0][1].data.subfilters.toSorted()).toEqual([
      'firefox',
      'ie',
      'safari',
    ]);
    await waitFor(() => {
      expect(
        screen.queryByRole('status', {name: 'Saving legacy-browsers'})
      ).not.toBeInTheDocument();
    });
    expect(firefoxToggle).toBeChecked();

    // Toggle filter off
    await userEvent.click(firefoxToggle);
    expect(firefoxToggle).not.toBeChecked();
    expect(mock.mock.calls[1][1].data.subfilters.toSorted()).toEqual(['ie', 'safari']);
    await waitFor(() => {
      expect(
        screen.queryByRole('status', {name: 'Saving legacy-browsers'})
      ).not.toBeInTheDocument();
    });
    expect(firefoxToggle).not.toBeChecked();
  });

  it('can toggle all/none for legacy browser', async () => {
    renderComponent();

    const filter = 'legacy-browsers';
    const mock = createFilterMock(filter);

    await userEvent.click(await screen.findByRole('button', {name: 'All'}));
    expect(mock.mock.calls[0][0]).toBe(getFilterEndpoint(filter));
    expect(mock.mock.calls[0][1].data.subfilters.toSorted()).toEqual([
      'android',
      'chrome',
      'edge',
      'firefox',
      'ie',
      'opera',
      'opera_mini',
      'safari',
    ]);

    await userEvent.click(screen.getByRole('button', {name: 'None'}));
    expect(mock.mock.calls[1][1].data.subfilters).toEqual([]);
  });

  it('can set ip address filter', async () => {
    renderComponent();

    const mock = MockApiClient.addMockResponse({
      url: PROJECT_URL,
      method: 'PUT',
    });

    const textbox = await screen.findByRole('textbox', {name: 'IP Addresses'});
    expect(
      screen.queryByText('Changing this filter will apply to all new events.')
    ).not.toBeInTheDocument();
    await userEvent.type(textbox, 'test\ntest2');
    expect(
      screen.getByText('Changing this filter will apply to all new events.')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(mock.mock.calls[0][0]).toBe(PROJECT_URL);
    expect(mock.mock.calls[0][1].data.options['filters:blacklisted_ips']).toBe(
      'test\ntest2'
    );
  });

  it('can cancel custom filter changes', async () => {
    renderComponent();

    const textbox = await screen.findByRole('textbox', {name: 'IP Addresses'});
    await userEvent.type(textbox, 'test\ntest2');
    expect(textbox).toHaveValue('test\ntest2');

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(textbox).toHaveValue('');
  });

  it('shows ip address filter without custom-inbound-filters flag', async () => {
    renderComponent();

    expect(await screen.findByRole('textbox', {name: 'IP Addresses'})).toBeEnabled();
  });

  it('filter by release/error message are not enabled', async () => {
    renderComponent();

    expect(await screen.findByRole('textbox', {name: 'Releases'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Error Message'})).toBeDisabled();
  });

  it('has custom inbound filters with flag + can change', async () => {
    render(<ProjectFilters />, {
      organization,
      outletContext: {
        project: {
          ...project,
          features: ['custom-inbound-filters'],
        },
      },
      initialRouterConfig,
    });

    expect(await screen.findByRole('textbox', {name: 'Releases'})).toBeEnabled();
    expect(screen.getByRole('textbox', {name: 'Error Message'})).toBeEnabled();

    const mock = MockApiClient.addMockResponse({
      url: PROJECT_URL,
      method: 'PUT',
    });

    const releasesField = screen.getByRole('textbox', {name: 'Releases'});
    await userEvent.type(releasesField, 'release\nrelease2');

    const errorField = screen.getByRole('textbox', {name: 'Error Message'});
    await userEvent.type(errorField, 'error\nerror2');
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0]).toBe(PROJECT_URL);
    expect(mock.mock.calls[0][1].data.options).toEqual(
      expect.objectContaining({
        'filters:releases': 'release\nrelease2',
        'filters:error_messages': 'error\nerror2',
      })
    );
  });

  it('shows inbound filters v2 tab between data filters and discarded issues', () => {
    const organizationWithFlag = OrganizationFixture({
      ...organization,
      features: ['inbound-filters-v2'],
    });
    const projectWithDiscardGroups = ProjectFixture({
      ...project,
      features: ['discard-groups'],
    });

    render(<ProjectFilters />, {
      organization: organizationWithFlag,
      outletContext: {project: projectWithDiscardGroups},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organizationWithFlag.slug}/projects/${projectWithDiscardGroups.slug}/filters/inbound-filters/`,
        },
        route: '/settings/:orgId/projects/:projectId/filters/:filterType/',
      },
    });

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Data Filters',
      'Custom Filters',
      'Discarded Issues',
    ]);
    expect(screen.getByRole('table')).toBeInTheDocument();
    for (const column of [
      'Active',
      'Name',
      'Conditions',
      'Created',
      'Edited',
      'Action',
    ]) {
      expect(screen.getByRole('columnheader', {name: column})).toBeInTheDocument();
    }
    expect(screen.getByText('No inbound filters found')).toBeInTheDocument();
  });

  it('disables configuration for non project:write users', async () => {
    render(<ProjectFilters />, {
      organization: OrganizationFixture({access: []}),
      outletContext: {project},
      initialRouterConfig,
    });

    const checkboxes = await screen.findAllByRole('checkbox');
    checkboxes.forEach(checkbox => {
      expect(checkbox).toBeDisabled();
    });

    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
  });

  it('shows disclaimer if error message filter is populated', async () => {
    render(<ProjectFilters />, {
      organization,
      outletContext: {
        project: {
          ...project,
          features: ['custom-inbound-filters'],
          options: {
            'filters:error_messages': 'test',
          },
        },
      },
      initialRouterConfig,
    });

    expect(
      await screen.findByText(
        "Minidumps, obfuscated or minified exceptions (ProGuard, errors in the minified production build of React), and Internet Explorer's i18n errors cannot be filtered by message."
      )
    ).toBeInTheDocument();
  });

  it('disables undiscard tombstone for users without project:write', async () => {
    const discardProject = ProjectFixture({
      ...project,
      features: ['discard-groups'],
    });
    const discardOrg = OrganizationFixture({access: [], features: ['discard-groups']});

    render(<ProjectFilters />, {
      organization: discardOrg,
      outletContext: {project: discardProject},
      initialRouterConfig: {
        location: {
          pathname: `/settings/${discardOrg.slug}/projects/${discardProject.slug}/filters/discarded-groups/`,
        },
        route: '/settings/:orgId/projects/:projectId/filters/:filterType/',
      },
    });

    expect(await screen.findByRole('button', {name: 'Undiscard'})).toBeDisabled();
  });
});
