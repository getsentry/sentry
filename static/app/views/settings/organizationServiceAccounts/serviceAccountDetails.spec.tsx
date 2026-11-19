import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import ServiceAccountDetails from './serviceAccountDetails';
import ServiceAccountsLayout from './serviceAccountsLayout';

describe('ServiceAccountDetails', () => {
  const organization = OrganizationFixture({features: ['service-accounts']});
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
});
