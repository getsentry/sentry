import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import OrganizationServiceAccounts from './index';

describe('OrganizationServiceAccounts', () => {
  const ENDPOINT = '/organizations/org-slug/service-accounts/';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() =>
      ProjectsStore.loadInitialData([ProjectFixture({id: '2', slug: 'backend'})])
    );
  });

  it('lists service accounts', async () => {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [
        {
          id: '1',
          name: 'github-actions-deploy',
          scopes: ['project:read', 'project:releases'],
          projectIds: [],
          allProjects: true,
          dateCreated: '2026-11-02T00:00:00Z',
        },
        {
          id: '2',
          name: 'triage-agent',
          scopes: ['event:read'],
          projectIds: ['2'],
          allProjects: false,
          dateCreated: '2026-10-28T00:00:00Z',
        },
      ],
    });

    render(<OrganizationServiceAccounts />);

    expect(await screen.findByText('github-actions-deploy')).toBeInTheDocument();
    expect(screen.getByText('triage-agent')).toBeInTheDocument();
    expect(screen.getByText('All projects')).toBeInTheDocument();
    expect(screen.getByText('1 project')).toBeInTheDocument();
    expect(screen.getByText('2 scopes')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    MockApiClient.addMockResponse({url: ENDPOINT, body: []});

    render(<OrganizationServiceAccounts />);

    expect(await screen.findByText(/No service accounts yet/)).toBeInTheDocument();
  });

  it('disables create without service_account:write', async () => {
    MockApiClient.addMockResponse({url: ENDPOINT, body: []});

    render(<OrganizationServiceAccounts />, {
      organization: OrganizationFixture({access: ['org:read']}),
    });

    expect(await screen.findByText(/No service accounts yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'New Service Account'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
