import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectCustomIngestDomain from 'sentry/views/settings/projectCustomIngestDomain';

describe('ProjectCustomIngestDomain', () => {
  const organization = OrganizationFixture();
  const project = DetailedProjectFixture();
  const endpoint = `/projects/${organization.slug}/${project.slug}/managed-ingest-domain/`;
  const domainConnectEndpoint = `${endpoint}domain-connect/`;
  const refreshEndpoint = `${endpoint}refresh/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function renderPage() {
    return render(<ProjectCustomIngestDomain />, {
      organization,
      outletContext: {project},
    });
  }

  it('adds a custom ingest domain and shows its DNS record', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'GET',
      body: {domain: null},
    });
    const post = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: {
        domain: {
          id: '1',
          projectId: project.id,
          hostname: 'errors.example.com',
          provider: 'cloudflare',
          providerHostnameId: 'hostname-id',
          cnameTarget: 'ingest.dsntry.com',
          status: 'pending_dns',
          providerStatus: 'pending',
          certificateStatus: 'pending_validation',
          verificationErrors: [],
          lastError: null,
          lastCheckedAt: null,
          activatedAt: null,
          dateCreated: '2026-08-17T00:00:00Z',
          dateUpdated: '2026-08-17T00:00:00Z',
          dnsProvider: 'cloudflare',
          diagnostics: {
            ranAt: null,
            checks: [
              {
                slug: 'provider_hostname',
                label: 'Provider hostname',
                status: 'passed',
                summary: 'The hostname is registered with the managed ingest provider.',
                expected: 'registered',
                observed: 'pending',
                dependsOn: [],
              },
              {
                slug: 'dns_cname',
                label: 'DNS CNAME',
                status: 'waiting',
                summary: 'Point the hostname to the expected CNAME target, then refresh.',
                expected: 'errors.example.com CNAME ingest.dsntry.com',
                observed: 'pending',
                dependsOn: ['provider_hostname'],
              },
              {
                slug: 'certificate',
                label: 'TLS certificate',
                status: 'waiting',
                summary: 'Waiting for DNS verification.',
                expected: 'active',
                observed: 'pending_validation',
                dependsOn: ['dns_cname'],
              },
              {
                slug: 'edge_routing',
                label: 'Edge routing',
                status: 'waiting',
                summary: 'Waiting for the managed TLS certificate.',
                expected: 'active',
                observed: 'pending_dns',
                dependsOn: ['certificate'],
              },
            ],
          },
        },
      },
    });
    MockApiClient.addMockResponse({
      url: domainConnectEndpoint,
      method: 'GET',
      body: {
        provider: 'cloudflare',
        url: 'https://dash.cloudflare.com/domainconnect/signed-request',
      },
    });

    renderPage();

    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Hostname'}),
      'errors.example.com'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Add Domain'}));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          method: 'POST',
          data: {hostname: 'errors.example.com'},
        })
      )
    );
    expect(await screen.findByText('Waiting for DNS')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Custom Ingest Domain'})
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'CNAME target'})).toHaveValue(
      'ingest.dsntry.com'
    );
    expect(screen.getByText('DNS CNAME')).toBeVisible();
    expect(screen.getAllByText('Waiting')).toHaveLength(3);
    expect(
      await screen.findByRole('button', {name: 'Configure automatically'})
    ).toHaveAttribute('href', 'https://dash.cloudflare.com/domainconnect/signed-request');
    expect(
      screen
        .getAllByText(/^(Provider hostname|DNS CNAME|TLS certificate|Edge routing)$/)
        .map(element => element.textContent)
    ).toEqual(['Provider hostname', 'DNS CNAME', 'TLS certificate', 'Edge routing']);
  });

  it('shows the custom and standard DSNs for an active domain', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'GET',
      body: {
        domain: {
          id: '1',
          projectId: project.id,
          hostname: 'errors.example.com',
          provider: 'cloudflare',
          providerHostnameId: 'hostname-id',
          cnameTarget: 'ingest.dsntry.com',
          status: 'active',
          providerStatus: 'active',
          certificateStatus: 'active',
          verificationErrors: [],
          lastError: null,
          lastCheckedAt: '2026-08-17T00:00:00Z',
          activatedAt: '2026-08-17T00:00:00Z',
          dateCreated: '2026-08-17T00:00:00Z',
          dateUpdated: '2026-08-17T00:00:00Z',
          dnsProvider: 'cloudflare',
          diagnostics: {
            ranAt: '2026-08-17T00:00:00Z',
            checks: [
              {
                slug: 'provider_hostname',
                label: 'Provider hostname',
                status: 'passed',
                summary: 'The hostname is registered with the managed ingest provider.',
                expected: 'registered',
                observed: 'active',
                dependsOn: [],
              },
              {
                slug: 'dns_cname',
                label: 'DNS CNAME',
                status: 'passed',
                summary: "The provider has verified the hostname's DNS configuration.",
                expected: 'errors.example.com CNAME ingest.dsntry.com',
                observed: 'active',
                dependsOn: ['provider_hostname'],
              },
              {
                slug: 'certificate',
                label: 'TLS certificate',
                status: 'passed',
                summary: 'The managed TLS certificate is active.',
                expected: 'active',
                observed: 'active',
                dependsOn: ['dns_cname'],
              },
              {
                slug: 'edge_routing',
                label: 'Edge routing',
                status: 'passed',
                summary: "The hostname's edge authorization mapping is active.",
                expected: 'active',
                observed: 'active',
                dependsOn: ['certificate'],
              },
            ],
          },
        },
      },
    });

    const [projectKey] = ProjectKeysFixture();
    projectKey.dsn.public = 'http://public-key@localhost:7899/2';
    projectKey.managedIngest = {
      domainId: '1',
      hostname: 'errors.example.com',
      dsn: {public: 'https://public-key@errors.example.com/2'},
    };
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [projectKey],
    });

    renderPage();

    expect(await screen.findByRole('textbox', {name: 'Custom ingest DSN'})).toHaveValue(
      'https://public-key@errors.example.com/2'
    );
    expect(screen.getByRole('button', {name: 'Check Status'})).toBeEnabled();
    expect(screen.getByRole('textbox', {name: 'Standard Sentry DSN'})).toHaveValue(
      `https://public-key@o${organization.id}.ingest.sentry.io/2`
    );
    await userEvent.click(screen.getByRole('button', {name: 'Setup progress'}));
    expect(screen.getAllByText('Passed')).toHaveLength(4);
  });

  it('polls until an active domain status check has completed', async () => {
    const checkedAt = '2026-08-17T00:00:00Z';
    const refreshedAt = '2026-08-17T00:01:00Z';
    const activeDomain = {
      id: '1',
      hostname: 'errors.example.com',
      status: 'active',
      cnameTarget: null,
      lastError: null,
      lastCheckedAt: checkedAt,
      diagnostics: {ranAt: checkedAt, checks: []},
    };
    let domainRequestCount = 0;
    const domainRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'GET',
      body: () => {
        domainRequestCount++;
        return {
          domain:
            domainRequestCount < 3
              ? activeDomain
              : {
                  ...activeDomain,
                  status: 'error',
                  lastError: 'Provider refresh found an error.',
                  lastCheckedAt: refreshedAt,
                  diagnostics: {ranAt: refreshedAt, checks: []},
                },
        };
      },
    });
    const refreshRequest = MockApiClient.addMockResponse({
      url: refreshEndpoint,
      method: 'POST',
      body: {domain: activeDomain},
    });
    const [projectKey] = ProjectKeysFixture();
    projectKey.managedIngest = {
      domainId: activeDomain.id,
      hostname: activeDomain.hostname,
      dsn: {public: 'https://public-key@errors.example.com/2'},
    };
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      method: 'GET',
      body: [projectKey],
    });

    renderPage();

    const checkStatus = await screen.findByRole('button', {name: 'Check Status'});
    jest.useFakeTimers();
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
    await user.click(checkStatus);

    await waitFor(() => expect(refreshRequest).toHaveBeenCalledTimes(1));
    expect(checkStatus).toBeDisabled();

    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    jest.useRealTimers();

    expect(await screen.findByText('Provider refresh found an error.')).toBeVisible();
    expect(screen.getByText('Needs attention')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Refresh Status'})).toBeEnabled();
    expect(domainRequest.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
