import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture, ProjectFixture} from 'sentry-fixture/project';
import {ProjectFiltersFixture} from 'sentry-fixture/projectFilters';
import {TombstonesFixture} from 'sentry-fixture/tombstones';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

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

  const CUSTOM_INBOUND_FILTERS_URL = `${PROJECT_URL}custom-inbound-filters/`;

  const inboundFiltersV2Org = OrganizationFixture({
    ...organization,
    features: ['inbound-filters-v2'],
  });

  const inboundFiltersRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/projects/${project.slug}/filters/inbound-filters/`,
    },
    route: '/settings/:orgId/projects/:projectId/filters/:filterType/',
  };

  type CustomInboundFilter = {
    active: boolean;
    conditions: Array<{type: string; value: string[]}>;
    dateCreated: string;
    dateUpdated: string;
    id: string;
    name: string | null;
  };

  function CustomInboundFilterFixture(
    params: Partial<CustomInboundFilter> = {}
  ): CustomInboundFilter {
    return {
      id: '1',
      name: 'A filter',
      active: true,
      conditions: [{type: 'error_message', value: ['*Error*']}],
      dateCreated: '2024-01-01T00:00:00Z',
      dateUpdated: '2024-01-01T00:00:00Z',
      ...params,
    };
  }

  function renderInboundFilters(filters: CustomInboundFilter[]) {
    MockApiClient.addMockResponse({
      url: CUSTOM_INBOUND_FILTERS_URL,
      body: filters,
    });
    const result = render(<ProjectFilters />, {
      organization: inboundFiltersV2Org,
      outletContext: {project},
      initialRouterConfig: inboundFiltersRouterConfig,
    });
    renderGlobalModal();
    return result;
  }

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

  it('shows inbound filters v2 tab between data filters and discarded issues', async () => {
    const organizationWithFlag = OrganizationFixture({
      ...organization,
      features: ['inbound-filters-v2'],
    });
    const projectWithDiscardGroups = ProjectFixture({
      ...project,
      features: ['discard-groups'],
    });

    MockApiClient.addMockResponse({
      url: CUSTOM_INBOUND_FILTERS_URL,
      body: [
        CustomInboundFilterFixture({id: '1', name: 'Ignore flaky connection errors'}),
        CustomInboundFilterFixture({
          id: '2',
          name: 'Drop debug log spam',
          active: false,
          conditions: [{type: 'log_message', value: ['*DEBUG*']}],
        }),
      ],
    });

    render(<ProjectFilters />, {
      organization: organizationWithFlag,
      outletContext: {project: projectWithDiscardGroups},
      initialRouterConfig: inboundFiltersRouterConfig,
    });

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Data Filters',
      'Custom Filters',
      'Discarded Issues',
    ]);
    expect(await screen.findByRole('table')).toBeInTheDocument();
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
    expect(screen.getByText('Ignore flaky connection errors')).toBeInTheDocument();
    expect(screen.getByText('Drop debug log spam')).toBeInTheDocument();
  });

  it('loads custom filters from the API and filters them by search', async () => {
    renderInboundFilters([
      CustomInboundFilterFixture({
        id: '1',
        name: 'Ignore flaky connection errors',
        conditions: [{type: 'error_message', value: ['*ConnectionError*']}],
      }),
      CustomInboundFilterFixture({
        id: '2',
        name: 'Drop debug log spam',
        active: false,
        conditions: [{type: 'log_message', value: ['*DEBUG*']}],
      }),
    ]);

    expect(await screen.findByText('Ignore flaky connection errors')).toBeInTheDocument();
    expect(screen.getByText('Drop debug log spam')).toBeInTheDocument();
    expect(screen.getByText('Error Message:*ConnectionError*')).toBeInTheDocument();

    const searchInput = screen.getByRole('textbox', {name: 'Search rules'});
    await userEvent.type(searchInput, 'ConnectionError');
    expect(screen.getByText('Ignore flaky connection errors')).toBeInTheDocument();
    expect(screen.queryByText('Drop debug log spam')).not.toBeInTheDocument();
  });

  it('shows an error when the filters fail to load', async () => {
    MockApiClient.addMockResponse({
      url: CUSTOM_INBOUND_FILTERS_URL,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(<ProjectFilters />, {
      organization: inboundFiltersV2Org,
      outletContext: {project},
      initialRouterConfig: inboundFiltersRouterConfig,
    });

    expect(await screen.findByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });

  it('toggles a filter active state via the API', async () => {
    renderInboundFilters([
      CustomInboundFilterFixture({id: '1', name: 'Active filter', active: true}),
    ]);

    const toggleMock = MockApiClient.addMockResponse({
      url: `${CUSTOM_INBOUND_FILTERS_URL}1/`,
      method: 'PUT',
      body: CustomInboundFilterFixture({id: '1', name: 'Active filter', active: false}),
    });

    await userEvent.click(await screen.findByRole('checkbox', {name: 'Disable filter'}));

    await waitFor(() =>
      expect(toggleMock).toHaveBeenCalledWith(
        `${CUSTOM_INBOUND_FILTERS_URL}1/`,
        expect.objectContaining({method: 'PUT', data: {active: false}})
      )
    );
  });

  it('creates a filter via the modal', async () => {
    renderInboundFilters([]);
    expect(await screen.findByText('No inbound filters found')).toBeInTheDocument();

    const createMock = MockApiClient.addMockResponse({
      url: CUSTOM_INBOUND_FILTERS_URL,
      method: 'POST',
      body: CustomInboundFilterFixture({id: '10', name: 'Block spam messages'}),
    });

    await userEvent.click(screen.getByRole('button', {name: 'Add Rule'}));
    expect(await screen.findByText('Create Custom Filter')).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Name'}),
      'Block spam messages'
    );
    await userEvent.type(screen.getByRole('textbox', {name: 'Condition value'}), 'spam');

    // Override the list response so the post-create refetch shows the new filter
    MockApiClient.addMockResponse({
      url: CUSTOM_INBOUND_FILTERS_URL,
      body: [CustomInboundFilterFixture({id: '10', name: 'Block spam messages'})],
    });

    await userEvent.click(screen.getByRole('button', {name: 'Create Filter'}));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(
        CUSTOM_INBOUND_FILTERS_URL,
        expect.objectContaining({
          method: 'POST',
          data: {
            name: 'Block spam messages',
            conditions: [{type: 'error_message', value: ['spam']}],
          },
        })
      )
    );
    expect(await screen.findByText('Block spam messages')).toBeInTheDocument();
  });

  it('keeps the modal open when creating a filter fails', async () => {
    renderInboundFilters([]);
    expect(await screen.findByText('No inbound filters found')).toBeInTheDocument();

    const createMock = MockApiClient.addMockResponse({
      url: CUSTOM_INBOUND_FILTERS_URL,
      method: 'POST',
      statusCode: 400,
      body: {detail: 'Log message filters are not enabled for this organization.'},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Add Rule'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'Bad filter');
    await userEvent.type(screen.getByRole('textbox', {name: 'Condition value'}), 'x');
    await userEvent.click(screen.getByRole('button', {name: 'Create Filter'}));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    // The modal stays open so the user can correct the error
    expect(screen.getByText('Create Custom Filter')).toBeInTheDocument();
  });

  it('edits a filter via the modal', async () => {
    renderInboundFilters([
      CustomInboundFilterFixture({
        id: '1',
        name: 'Original name',
        conditions: [{type: 'error_message', value: ['*Error*']}],
      }),
    ]);

    const editMock = MockApiClient.addMockResponse({
      url: `${CUSTOM_INBOUND_FILTERS_URL}1/`,
      method: 'PUT',
      body: CustomInboundFilterFixture({id: '1', name: 'Updated name'}),
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Edit filter'}));
    expect(await screen.findByText('Edit Custom Filter')).toBeInTheDocument();

    const nameInput = screen.getByRole('textbox', {name: 'Name'});
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Updated name');

    MockApiClient.addMockResponse({
      url: CUSTOM_INBOUND_FILTERS_URL,
      body: [CustomInboundFilterFixture({id: '1', name: 'Updated name'})],
    });

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() =>
      expect(editMock).toHaveBeenCalledWith(
        `${CUSTOM_INBOUND_FILTERS_URL}1/`,
        expect.objectContaining({
          method: 'PUT',
          data: {
            name: 'Updated name',
            conditions: [{type: 'error_message', value: ['*Error*']}],
          },
        })
      )
    );
    expect(await screen.findByText('Updated name')).toBeInTheDocument();
  });

  it('keeps a gated condition property selectable when editing', async () => {
    renderInboundFilters([
      CustomInboundFilterFixture({
        id: '1',
        name: 'Drop debug log spam',
        conditions: [{type: 'log_message', value: ['*DEBUG*']}],
      }),
    ]);

    await userEvent.click(await screen.findByRole('button', {name: 'Edit filter'}));
    expect(await screen.findByText('Edit Custom Filter')).toBeInTheDocument();

    const propertySelect = screen.getByRole('textbox', {name: 'Condition property'});
    expect(screen.getByText('Log Message')).toBeInTheDocument();

    await userEvent.click(propertySelect);
    expect(screen.getByRole('menuitemradio', {name: 'Log Message'})).toBeInTheDocument();
  });

  it('deletes a filter', async () => {
    renderInboundFilters([CustomInboundFilterFixture({id: '1', name: 'Delete me'})]);

    const deleteMock = MockApiClient.addMockResponse({
      url: `${CUSTOM_INBOUND_FILTERS_URL}1/`,
      method: 'DELETE',
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Delete filter'}));

    // Override the list response so the post-delete refetch drops the filter
    MockApiClient.addMockResponse({
      url: CUSTOM_INBOUND_FILTERS_URL,
      body: [],
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith(
        `${CUSTOM_INBOUND_FILTERS_URL}1/`,
        expect.objectContaining({method: 'DELETE'})
      )
    );
    await waitFor(() => expect(screen.queryByText('Delete me')).not.toBeInTheDocument());
  });

  it('gates log and metric condition options behind ingestion features', async () => {
    renderInboundFilters([]);

    await userEvent.click(await screen.findByRole('button', {name: 'Add Rule'}));
    await userEvent.click(screen.getByRole('textbox', {name: 'Condition property'}));

    expect(
      screen.getByRole('menuitemradio', {name: 'Error Message'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Release'})).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Log Message'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Metric Name'})
    ).not.toBeInTheDocument();
  });

  it('offers log and metric options when the ingestion features are enabled', async () => {
    MockApiClient.addMockResponse({
      url: CUSTOM_INBOUND_FILTERS_URL,
      body: [],
    });
    render(<ProjectFilters />, {
      organization: OrganizationFixture({
        ...organization,
        features: ['inbound-filters-v2', 'ourlogs-ingestion', 'tracemetrics-ingestion'],
      }),
      outletContext: {project},
      initialRouterConfig: inboundFiltersRouterConfig,
    });
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Add Rule'}));
    await userEvent.click(screen.getByRole('textbox', {name: 'Condition property'}));

    expect(screen.getByRole('menuitemradio', {name: 'Log Message'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Metric Name'})).toBeInTheDocument();
  });

  it('drops conflicting category options from other conditions', async () => {
    MockApiClient.addMockResponse({
      url: CUSTOM_INBOUND_FILTERS_URL,
      body: [],
    });
    render(<ProjectFilters />, {
      organization: OrganizationFixture({
        ...organization,
        features: ['inbound-filters-v2', 'ourlogs-ingestion', 'tracemetrics-ingestion'],
      }),
      outletContext: {project},
      initialRouterConfig: inboundFiltersRouterConfig,
    });
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Add Rule'}));
    // First condition defaults to Error Message; add a second condition and
    // open its property dropdown.
    await userEvent.click(screen.getByRole('button', {name: 'Add Condition'}));
    await userEvent.click(
      screen.getAllByRole('textbox', {name: 'Condition property'})[1]!
    );

    expect(
      screen.getByRole('menuitemradio', {name: 'Error Message'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Release'})).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Metric Name'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Log Message'})
    ).not.toBeInTheDocument();
  });

  it('disables custom filter controls without project:write access', async () => {
    MockApiClient.addMockResponse({
      url: CUSTOM_INBOUND_FILTERS_URL,
      body: [CustomInboundFilterFixture({id: '1', name: 'A filter'})],
    });
    render(<ProjectFilters />, {
      organization: OrganizationFixture({
        ...organization,
        access: [],
        features: ['inbound-filters-v2'],
      }),
      outletContext: {project},
      initialRouterConfig: inboundFiltersRouterConfig,
    });
    renderGlobalModal();

    expect(await screen.findByRole('checkbox', {name: 'Disable filter'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Add Rule'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Edit filter'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Delete filter'})).toBeDisabled();
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
