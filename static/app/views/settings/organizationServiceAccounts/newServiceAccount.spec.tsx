import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import NewServiceAccount from './newServiceAccount';

describe('NewServiceAccount', () => {
  const access = OrganizationFixture().access;
  const organization = OrganizationFixture({
    features: ['service-accounts'],
    orgRole: 'owner',
    access: [
      ...access,
      'event:read',
      'member:read',
      'service_account:read',
      'service_account:write',
    ],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'frontend'})]);
  });

  function renderNew(org = organization) {
    return render(<NewServiceAccount />, {
      organization: org,
      initialRouterConfig: {
        location: {pathname: `/settings/${org.slug}/service-accounts/new/`},
        route: '/settings/:orgId/service-accounts/new/',
      },
    });
  }

  it('creates an account with the Seer automation default permissions', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/`,
      method: 'POST',
      body: {id: '10'},
    });

    const {router} = renderNew();

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'deploy');
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));

    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/service-accounts/`,
      expect.objectContaining({
        data: {
          name: 'deploy',
          allProjects: true,
          projectIds: [],
          scopes: ['event:read', 'member:read', 'org:read', 'project:read', 'team:read'],
        },
      })
    );
    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/service-accounts/10/`
    );
  });

  it('limits a role without access to all projects to specific projects', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/`,
      method: 'POST',
      body: {id: '10'},
    });

    renderNew({...organization, orgRole: 'admin'});

    expect(screen.getByRole('radio', {name: 'Specific projects'})).toBeChecked();
    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'deploy');
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));

    expect(await screen.findByText('Pick at least one project.')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('shows the API error on the name field', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/`,
      method: 'POST',
      statusCode: 400,
      body: {detail: {name: ['A service account with this name already exists.']}},
    });

    renderNew();

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'deploy');
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));

    expect(
      await screen.findByText('A service account with this name already exists.')
    ).toBeInTheDocument();
  });
});
