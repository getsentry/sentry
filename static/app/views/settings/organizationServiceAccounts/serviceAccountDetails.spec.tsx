import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import ServiceAccountDetails from './serviceAccountDetails';
import ServiceAccountsLayout from './serviceAccountsLayout';

describe('ServiceAccountDetails', () => {
  const organization = OrganizationFixture({
    features: ['service-accounts'],
    access: [...OrganizationFixture().access, 'service_account:write'],
  });
  const account = {
    id: '10',
    name: 'github-actions-deploy',
    scopes: ['event:read', 'org:read', 'project:read', 'project:write'],
    projectIds: ['1'],
    allProjects: false,
    ownerKind: 'organization',
    dateCreated: '2026-11-01T00:00:00Z',
  };

  function renderDetails(org = organization) {
    return render(<ServiceAccountsLayout />, {
      organization: org,
      initialRouterConfig: {
        location: {pathname: `/settings/${org.slug}/service-accounts/10/`},
        route: '/settings/:orgId/service-accounts/',
        children: [{path: ':serviceAccountId/', element: <ServiceAccountDetails />}],
      },
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'frontend'})]);
  });

  it('shows the account and the access each resource has', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/10/`,
      body: account,
    });

    renderDetails();

    expect(await screen.findByText('github-actions-deploy')).toBeInTheDocument();
    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('Owner').parentElement).toHaveTextContent(
      'OwnerOrganization'
    );

    const projectRow = screen.getByText('Project').closest('[role="row"]');
    expect(
      within(projectRow as HTMLElement).getByText('Read & Write')
    ).toBeInTheDocument();
    const releaseRow = screen.getByText('Release').closest('[role="row"]');
    expect(within(releaseRow as HTMLElement).getByText('No Access')).toBeInTheDocument();
  });

  it('is not found without the feature', () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/10/`,
      body: account,
    });

    renderDetails(OrganizationFixture());

    expect(
      screen.getByText(/the page you are looking for was not found/i)
    ).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('deletes the account after typing its name', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/10/`,
      body: account,
    });
    const deleteRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/10/`,
      method: 'DELETE',
    });

    const {router} = renderDetails();
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Delete'}));
    await userEvent.type(screen.getByRole('textbox'), 'github-actions-deploy');
    await userEvent.click(screen.getByRole('button', {name: 'Delete Service Account'}));

    await waitFor(() =>
      expect(router.location.pathname).toBe(
        `/settings/${organization.slug}/service-accounts/`
      )
    );
    expect(deleteRequest).toHaveBeenCalled();
  });

  it("can't edit or delete an account owned by a Seer automation", async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/10/`,
      body: {...account, ownerKind: 'seer_workflow_config'},
    });

    renderDetails();

    expect(await screen.findByRole('button', {name: 'Edit'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('button', {name: 'Delete'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
