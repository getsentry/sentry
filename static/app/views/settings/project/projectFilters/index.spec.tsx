import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectFiltersFixture} from 'sentry-fixture/projectFilters';
import {TombstonesFixture} from 'sentry-fixture/tombstones';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectFilters from 'sentry/views/settings/project/projectFilters';

describe('ProjectFilters', function () {
  const {organization, project, routerProps} = initializeOrg();
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
      body: TombstonesFixture(),
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
      await screen.findByRole('checkbox', {
        name: 'Internet Explorer Version 11 and lower',
      })
    ).toBeChecked();

    expect(
      await screen.findByRole('checkbox', {
        name: 'Safari Version 11 and lower',
      })
    ).toBeChecked();

    expect(
      screen.getByRole('checkbox', {name: 'Firefox Version 66 and lower'})
    ).not.toBeChecked();
  });

  it('can toggle legacy browser', async function () {
    renderComponent();

    const filter = 'legacy-browsers';
    const mock = createFilterMock(filter);

    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Firefox Version 66 and lower',
      })
    );
    expect(mock.mock.calls[0][0]).toBe(getFilterEndpoint(filter));
    // Have to do this because no jest matcher for JS Set
    expect(Array.from(mock.mock.calls[0][1].data.subfilters)).toEqual([
      'ie',
      'safari',
      'firefox',
    ]);

    // Toggle filter off
    await userEvent.click(
      await screen.findByRole('checkbox', {name: 'Firefox Version 66 and lower'})
    );
    expect(Array.from(mock.mock.calls[1][1].data.subfilters)).toEqual(['ie', 'safari']);
  });

  it('can toggle all/none for legacy browser', async function () {
    renderComponent();

    const filter = 'legacy-browsers';
    const mock = createFilterMock(filter);

    await userEvent.click(await screen.findByRole('button', {name: 'All'}));
    expect(mock.mock.calls[0][0]).toBe(getFilterEndpoint(filter));
    expect(Array.from(mock.mock.calls[0][1].data.subfilters)).toEqual([
      'chrome',
      'safari',
      'firefox',
      'android',
      'edge',
      'ie',
      'opera',
      'opera_mini',
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
      {organization: OrganizationFixture({access: []})}
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
