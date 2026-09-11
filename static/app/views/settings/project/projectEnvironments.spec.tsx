import {
  EnvironmentsFixture,
  HiddenEnvironmentsFixture,
} from 'sentry-fixture/environments';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import ProjectEnvironments from 'sentry/views/settings/project/projectEnvironments';

function renderComponent(isHidden: boolean) {
  const {organization, project} = initializeOrg();
  const pathname = isHidden
    ? `/settings/${organization.slug}/projects/${project.slug}/environments/hidden/`
    : `/settings/${organization.slug}/projects/${project.slug}/environments/`;
  const route = isHidden
    ? '/settings/:orgId/projects/:projectId/environments/hidden/'
    : '/settings/:orgId/projects/:projectId/environments/';

  return render(<ProjectEnvironments />, {
    organization,
    outletContext: {project},
    initialRouterConfig: {
      location: {pathname},
      route,
    },
  });
}

function getEnvironmentRow(name: string) {
  const row = screen.getByText(name).closest('[role="row"]');

  if (!(row instanceof HTMLElement)) {
    throw new Error(`Unable to find row for environment: ${name}`);
  }

  return row;
}

async function clickEnvironmentAction(name: string, action: string) {
  await screen.findByText(name);
  await userEvent.click(
    within(getEnvironmentRow(name)).getByRole('button', {name: action})
  );
}

describe('ProjectEnvironments', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/tags/environment/values/',
      body: [],
    });
  });

  it.each([
    ['active', false, "You don't have any environments yet."],
    ['hidden', true, "You don't have any hidden environments."],
  ])('renders the %s empty state', async (_label, isHidden, message) => {
    MockApiClient.addContractResponse(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/',
      {
        path: {organizationIdOrSlug: 'org-slug', projectIdOrSlug: 'project-slug'},
        body: [],
      }
    );

    renderComponent(isHidden);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('renders active environments', async () => {
    MockApiClient.addContractResponse(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/',
      {
        path: {organizationIdOrSlug: 'org-slug', projectIdOrSlug: 'project-slug'},
        body: EnvironmentsFixture().map(({id, name}) => ({id, name, isHidden: false})),
      }
    );

    renderComponent(false);

    expect(await screen.findByText('production')).toBeInTheDocument();
    expect(screen.getByText('All Environments')).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Hide'})).toHaveLength(3);
  });

  it('shows event counts per environment', async () => {
    MockApiClient.addContractResponse(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/',
      {
        path: {organizationIdOrSlug: 'org-slug', projectIdOrSlug: 'project-slug'},
        body: EnvironmentsFixture().map(({id, name}) => ({id, name, isHidden: false})),
      }
    );
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/tags/environment/values/',
      body: [
        {value: 'production', name: 'production', count: 12345},
        {value: 'staging', name: 'staging', count: 678},
        {value: 'STAGING', name: 'STAGING', count: 99},
      ],
    });

    renderComponent(false);

    expect(await screen.findByText('12K')).toBeInTheDocument();
    expect(screen.getByText('678')).toBeInTheDocument();
    expect(screen.getByText('13K')).toBeInTheDocument();
  });

  it('filters environments and persists the search query', async () => {
    MockApiClient.addContractResponse(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/',
      {
        path: {organizationIdOrSlug: 'org-slug', projectIdOrSlug: 'project-slug'},
        body: EnvironmentsFixture().map(({id, name}) => ({id, name, isHidden: false})),
      }
    );

    const {router} = renderComponent(false);

    const searchInput = await screen.findByRole('textbox', {
      name: 'Search environments',
    });
    await userEvent.type(searchInput, 'pdct');

    await waitFor(() => {
      expect(router.location.query.query).toBe('pdct');
      expect(screen.queryByText('staging')).not.toBeInTheDocument();
    });
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.queryByText('All Environments')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));

    expect(await screen.findByText('staging')).toBeInTheDocument();
    expect(router.location.query.query).toBeUndefined();
  });

  it.each([
    ['%app_env%', '%2525app_env%2525'],
    ['us%2Feast', 'us%25252Feast'],
  ])('double-encodes environment path params for %s', async (name, encodedName) => {
    MockApiClient.addContractResponse(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/',
      {
        path: {organizationIdOrSlug: 'org-slug', projectIdOrSlug: 'project-slug'},
        body: [{id: '1', name, isHidden: false}],
      }
    );
    const hideMock = MockApiClient.addContractResponse(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/$environment/',
      {
        path: {
          organizationIdOrSlug: 'org-slug',
          projectIdOrSlug: 'project-slug',
          environment: encodeURIComponent(name),
        },
        method: 'PUT',
        body: {id: '1', name, isHidden: true},
      }
    );

    renderComponent(false);

    await clickEnvironmentAction(name, 'Hide');

    expect(hideMock).toHaveBeenCalledWith(
      `/projects/org-slug/project-slug/environments/${encodedName}/`,
      expect.objectContaining({
        data: expect.objectContaining({isHidden: true}),
      })
    );
  });

  it('renders hidden environments and unhides them', async () => {
    MockApiClient.addContractResponse(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/',
      {
        path: {organizationIdOrSlug: 'org-slug', projectIdOrSlug: 'project-slug'},
        body: HiddenEnvironmentsFixture().map(({id, name}) => ({
          id,
          name,
          isHidden: true,
        })),
      }
    );
    const showMock = MockApiClient.addContractResponse(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/$environment/',
      {
        path: {
          organizationIdOrSlug: 'org-slug',
          projectIdOrSlug: 'project-slug',
          environment: 'zzz',
        },
        method: 'PUT',
        body: {id: '1', name: 'zzz', isHidden: false},
      }
    );

    renderComponent(true);

    await clickEnvironmentAction('zzz', 'Show');

    expect(screen.queryByText('All Environments')).not.toBeInTheDocument();
    expect(showMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/environments/zzz/',
      expect.objectContaining({
        data: expect.objectContaining({isHidden: false}),
      })
    );
  });
});
