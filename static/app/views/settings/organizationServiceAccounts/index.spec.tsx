import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import OrganizationServiceAccounts from '.';

describe('OrganizationServiceAccounts', () => {
  const organization = OrganizationFixture({features: ['service-accounts']});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'frontend'}),
      ProjectFixture({id: '2', slug: 'backend'}),
    ]);
  });

  it('lists service accounts with their owner, permissions and project access', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/`,
      body: [
        {
          id: '10',
          name: 'github-actions-deploy',
          scopes: ['org:read', 'project:read', 'project:releases'],
          projectIds: [],
          allProjects: true,
          ownerKind: 'organization',
          dateCreated: '2026-11-01T00:00:00Z',
        },
        {
          id: '11',
          name: 'breached-metric-investigation',
          scopes: ['event:read'],
          projectIds: ['1', '2'],
          allProjects: false,
          ownerKind: 'seer_workflow_config',
          dateCreated: '2026-11-02T00:00:00Z',
        },
      ],
    });

    render(<OrganizationServiceAccounts />, {organization});

    const deploy = await screen.findByRole('link', {name: 'github-actions-deploy'});
    expect(deploy).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/service-accounts/10/`
    );
    expect(screen.getByText('All projects')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('3 permissions')).toBeInTheDocument();

    expect(
      screen.getByRole('link', {name: 'breached-metric-investigation'})
    ).toBeInTheDocument();
    expect(screen.getByText('Seer automation')).toBeInTheDocument();
    expect(screen.getByText('backend, frontend')).toBeInTheDocument();
    expect(screen.getByText('1 permission')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/service-accounts/`,
      body: [],
    });

    render(<OrganizationServiceAccounts />, {organization});

    expect(await screen.findByText('No service accounts yet')).toBeInTheDocument();
  });
});
