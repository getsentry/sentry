import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {ProjectFilters as ProjectFiltersFixture} from 'sentry-fixture/projectFilters';
import {Tombstones} from 'sentry-fixture/tombstones';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectFilters from 'sentry/views/settings/project/projectFilters';

describe('ProjectFilters', function () {
  const {organization, project, routerProps} = initializeOrg({project: {options: {}}});
  const PROJECT_URL = `/projects/${organization.slug}/${project.slug}/`;

  const getFilterEndpoint = (filter: string) => `${PROJECT_URL}filters/${filter}/`;

  const createFilterMock = (filter: string) =>
    MockApiClient.addMockResponse({
      url: getFilterEndpoint(filter),
      method: 'PUT',
    });

  function renderComponent() {
    return render(
      <ProjectFilters
        {...routerProps}
        params={{projectId: project.slug, filterType: ''}}
        project={project}
        organization={organization}
      />,
      {organization}
    );
  }

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: PROJECT_URL,
      body: project,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/stats_v2/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `${PROJECT_URL}filters/`,
      body: ProjectFiltersFixture(),
    });

    MockApiClient.addMockResponse({
      url: `${PROJECT_URL}tombstones/`,
      body: Tombstones(),
    });
  });

  it('has browser extensions enabled initially', async function () {
    renderComponent();

    const filter = 'browser-extensions';
    const mock = createFilterMock(filter);

    const control = await screen.findByRole('checkbox', {
      name: 'Filter out errors known to be caused by browser extensions',
    });

    expect(control).toBeChecked();
    await userEvent.click(control);

    expect(mock).toHaveBeenCalledWith(
      getFilterEndpoint(filter),
      expect.objectContaining({
        method: 'PUT',
        data: {
          active: false,
        },
      })
    );
  });

  it('can toggle filters: localhost, web crawlers', async function () {
    renderComponent();

    const FILTERS = {
      localhost: 'Filter out events coming from localhost',
      'web-crawlers': 'Filter out known web crawlers',
    };

    await screen.findByText('Filters');

    for (const filter of Object.keys(FILTERS)) {
      const mock = createFilterMock(filter);

      await userEvent.click(screen.getByRole('checkbox', {name: FILTERS[filter]}));
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

  it('has correct legacy browsers selected', async function () {
    renderComponent();

    expect(
      await screen.findByRole('checkbox', {name: 'Internet Explorer Version 8 and lower'})
    ).toBeChecked();

    expect(
      screen.getByRole('checkbox', {name: 'Internet Explorer Version 9'})
    ).toBeChecked();

    expect(
      screen.getByRole('checkbox', {name: 'Internet Explorer Version 10'})
    ).not.toBeChecked();
  });

  it('can toggle legacy browser', async function () {
    renderComponent();

    const filter = 'legacy-browsers';
    const mock = createFilterMock(filter);

    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Safari Version 5 and lower'})
    );
    expect(mock.mock.calls[0][0]).toBe(getFilterEndpoint(filter));
    // Have to do this because no jest matcher for JS Set
    expect(Array.from(mock.mock.calls[0][1].data.subfilters)).toEqual([
      'ie_pre_9',
      'ie9',
      'safari_pre_6',
    ]);

    // Toggle filter off
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Internet Explorer Version 11'})
    );
    expect(Array.from(mock.mock.calls[1][1].data.subfilters)).toEqual([
      'ie_pre_9',
      'ie9',
      'safari_pre_6',
      'ie11',
    ]);

    mock.mockReset();

    // Click ie9 and < ie9
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Internet Explorer Version 9'})
    );
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Internet Explorer Version 8 and lower'})
    );

    expect(Array.from(mock.mock.calls[1][1].data.subfilters)).toEqual([
      'safari_pre_6',
      'ie11',
    ]);
  });

  it('can toggle all/none for legacy browser', async function () {
    renderComponent();

    const filter = 'legacy-browsers';
    const mock = createFilterMock(filter);

    await userEvent.click(await screen.findByRole('button', {name: 'All'}));
    expect(mock.mock.calls[0][0]).toBe(getFilterEndpoint(filter));
    expect(Array.from(mock.mock.calls[0][1].data.subfilters)).toEqual([
      'ie_pre_9',
      'ie9',
      'ie10',
      'ie11',
      'safari_pre_6',
      'opera_pre_15',
      'opera_mini_pre_8',
      'android_pre_4',
      'edge_pre_79',
    ]);

    await userEvent.click(screen.getByRole('button', {name: 'None'}));
    expect(Array.from(mock.mock.calls[1][1].data.subfilters)).toEqual([]);
  });

  it('can set ip address filter', async function () {
    renderComponent();

    const mock = MockApiClient.addMockResponse({
      url: PROJECT_URL,
      method: 'PUT',
    });

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'IP Addresses'}),
      'test\ntest2'
    );
    await userEvent.tab();

    expect(mock.mock.calls[0][0]).toBe(PROJECT_URL);
    expect(mock.mock.calls[0][1].data.options['filters:blacklisted_ips']).toBe(
      'test\ntest2'
    );
  });

  it('filter by release/error message are not enabled', async function () {
    renderComponent();

    expect(await screen.findByRole('textbox', {name: 'Releases'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Error Message'})).toBeDisabled();
  });

  it('has custom inbound filters with flag + can change', async function () {
    render(
      <ProjectFilters
        {...routerProps}
        organization={organization}
        params={{projectId: project.slug, filterType: ''}}
        project={{
          ...project,
          features: ['custom-inbound-filters'],
        }}
      />
    );

    expect(await screen.findByRole('textbox', {name: 'Releases'})).toBeEnabled();
    expect(screen.getByRole('textbox', {name: 'Error Message'})).toBeEnabled();

    const mock = MockApiClient.addMockResponse({
      url: PROJECT_URL,
      method: 'PUT',
    });

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Releases'}),
      'release\nrelease2'
    );
    await userEvent.tab();

    expect(mock.mock.calls[0][0]).toBe(PROJECT_URL);
    expect(mock.mock.calls[0][1].data.options['filters:releases']).toBe(
      'release\nrelease2'
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Error Message'}),
      'error\nerror2'
    );
    await userEvent.tab();

    expect(mock.mock.calls[1][1].data.options['filters:error_messages']).toBe(
      'error\nerror2'
    );
  });

  it('disables configuration for non project:write users', async function () {
    render(
      <ProjectFilters
        {...routerProps}
        organization={organization}
        params={{projectId: project.slug, filterType: ''}}
        project={project}
      />,
      {organization: Organization({access: []})}
    );

    const checkboxes = await screen.findAllByRole('checkbox');
    checkboxes.forEach(checkbox => {
      expect(checkbox).toBeDisabled();
    });
  });

  it('shows disclaimer if error message filter is populated', async function () {
    render(
      <ProjectFilters
        {...routerProps}
        organization={organization}
        params={{projectId: project.slug, filterType: ''}}
        project={{
          ...project,
          features: ['custom-inbound-filters'],
          options: {
            'filters:error_messages': 'test',
          },
        }}
      />
    );

    expect(
      await screen.findByText(
        "Minidumps, errors in the minified production build of React, and Internet Explorer's i18n errors cannot be filtered by message."
      )
    ).toBeInTheDocument();
  });

  it('disables undiscard tombstone for users without project:write', async () => {
    const discardProject = ProjectFixture({
      ...project,
      features: ['discard-groups'],
    });
    const discardOrg = Organization({access: [], features: ['discard-groups']});

    render(
      <ProjectFilters
        {...routerProps}
        organization={organization}
        params={{
          projectId: discardProject.slug,
          filterType: 'discarded-groups',
        }}
        project={discardProject}
      />,
      {organization: discardOrg}
    );

    expect(await screen.findByRole('button', {name: 'Undiscard'})).toBeDisabled();
  });
});
