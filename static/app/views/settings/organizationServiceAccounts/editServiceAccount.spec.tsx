import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import EditServiceAccount from './editServiceAccount';

describe('EditServiceAccount', () => {
  const organization = OrganizationFixture({
    features: ['service-accounts'],
    access: [...OrganizationFixture().access, 'service_account:write'],
  });
  const account = {
    id: '10',
    name: 'deploy',
    scopes: ['org:read', 'project:read'],
    projectIds: ['1'],
    allProjects: false,
    ownerKind: 'organization',
    dateCreated: '2026-11-01T00:00:00Z',
  };

  function renderEdit() {
    return render(<EditServiceAccount />, {
      organization,
      initialRouterConfig: {
        location: {pathname: `/settings/${organization.slug}/service-accounts/10/edit/`},
        route: '/settings/:orgId/service-accounts/:serviceAccountId/edit/',
      },
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'frontend'})]);
  });

  it('saves the account and returns to its details', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/10/`,
      body: account,
    });
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/10/`,
      method: 'PUT',
      body: {...account, name: 'deploy-prod'},
    });

    const {router} = renderEdit();

    const name = await screen.findByRole('textbox', {name: 'Name'});
    await userEvent.clear(name);
    await userEvent.type(name, 'deploy-prod');
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/service-accounts/10/`,
      expect.objectContaining({
        data: {
          name: 'deploy-prod',
          allProjects: false,
          projectIds: [1],
          scopes: ['org:read', 'project:read'],
        },
      })
    );
    await waitFor(() =>
      expect(router.location.pathname).toBe(
        `/settings/${organization.slug}/service-accounts/10/`
      )
    );
  });

  it('does not show the form for an account owned by a Seer automation', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/10/`,
      body: {...account, ownerKind: 'seer_workflow_config'},
    });

    renderEdit();

    expect(
      await screen.findByText(
        'This account belongs to a Seer automation. Change it from the automation.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Name'})).not.toBeInTheDocument();
  });
});
