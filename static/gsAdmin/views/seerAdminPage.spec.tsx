import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ConfigStore} from 'sentry/stores/configStore';

import {SeerAdminPage} from 'admin/views/seerAdminPage';
import {SyntheticMetricBreachForm} from 'admin/views/syntheticMetricBreachForm';

describe('SeerAdminPage', () => {
  beforeEach(() => {
    ConfigStore.set('localities', [
      {
        name: 'US',
        url: 'https://us.example.com',
      },
      {
        name: 'EU',
        url: 'https://eu.example.com',
      },
    ]);
  });

  it('only clears the organization ID after triggering a night shift run', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/night-shift/trigger/',
      method: 'POST',
    });

    render(<SeerAdminPage />);

    const organizationId = screen.getByRole('spinbutton', {
      name: 'Organization ID (blank = all orgs)',
    });
    const maxCandidates = screen.getByRole('spinbutton', {
      name: 'Max candidates (optional)',
    });
    const dryRun = screen.getByRole('checkbox', {
      name: 'Dry run (triage only, no autofix triggered)',
    });

    await selectEvent.select(screen.getAllByRole('textbox', {name: 'Region'})[0]!, 'EU');
    await userEvent.type(organizationId, '123');
    await userEvent.type(maxCandidates, '5');
    await userEvent.click(dryRun);
    await userEvent.click(screen.getByRole('button', {name: 'Trigger Night Shift'}));

    await waitFor(() => expect(request).toHaveBeenCalled());
    await waitFor(() => expect(organizationId).toHaveValue(null));
    expect(maxCandidates).toHaveValue(5);
    expect(dryRun).toBeChecked();
    expect(screen.getByText('EU')).toBeInTheDocument();
  });

  it('retries autofix runs and shows per-run results', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/autofix/retry/',
      method: 'POST',
      body: {
        results: [
          {run_id: 1, retried: true, step: 'root_cause'},
          {run_id: 2, retried: false, reason: "Run status is 'completed', not 'error'"},
        ],
      },
    });

    render(<SeerAdminPage />);

    await userEvent.type(screen.getByRole('textbox', {name: 'Run IDs'}), '1, 2');
    await userEvent.click(screen.getByRole('button', {name: 'Retry Runs'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/internal/seer/autofix/retry/',
        expect.objectContaining({data: {run_ids: [1, 2]}})
      )
    );
    expect(await screen.findByText('Retried root_cause')).toBeInTheDocument();
    expect(
      screen.getByText("Skipped: Run status is 'completed', not 'error'")
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Run IDs'})).toHaveValue('');
  });

  it('does not retry autofix runs with invalid run IDs', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/autofix/retry/',
      method: 'POST',
    });

    render(<SeerAdminPage />);

    await userEvent.type(screen.getByRole('textbox', {name: 'Run IDs'}), '1, abc');
    await userEvent.click(screen.getByRole('button', {name: 'Retry Runs'}));

    expect(
      await screen.findByText('Enter 1-50 run IDs separated by commas or whitespace')
    ).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('starts a single run on a Sentry issue and links to it', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/autofix/single-run/',
      method: 'POST',
      body: {
        group_id: 7,
        project_id: 1,
        run_id: 321,
        url: 'https://sentry.sentry.io/issues/7/?project=1&explorerRunId=321',
      },
    });

    render(<SeerAdminPage />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Issue short ID'}),
      'SENTRY-5RDF'
    );
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Start as automated (no owner)'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Start Single Run'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/internal/seer/autofix/single-run/',
        expect.objectContaining({
          data: {organization_slug: 'sentry', short_id: 'SENTRY-5RDF', automated: true},
        })
      )
    );
    expect(await screen.findByRole('link', {name: 'Open run 321'})).toHaveAttribute(
      'href',
      'https://sentry.sentry.io/issues/7/?project=1&explorerRunId=321'
    );
  });

  it('only allows single-run Autofix for the Sentry org', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/night-shift/trigger/',
      method: 'POST',
    });

    render(<SeerAdminPage />);

    const singleRun = screen.getByRole('checkbox', {
      name: 'Single-run Autofix (Sentry org only)',
    });
    expect(singleRun).toBeDisabled();

    await userEvent.type(
      screen.getByRole('spinbutton', {name: 'Organization ID (blank = all orgs)'}),
      '1'
    );
    expect(singleRun).toBeEnabled();
    await userEvent.click(singleRun);
    await userEvent.click(screen.getByRole('button', {name: 'Trigger Night Shift'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/internal/seer/night-shift/trigger/',
        expect.objectContaining({
          data: expect.objectContaining({organization_id: 1, single_run: true}),
        })
      )
    );
  });
});

describe('SyntheticMetricBreachForm', () => {
  const organization = OrganizationFixture({
    id: '123',
    slug: 'test-org',
    name: 'Test organization',
  });
  const otherOrganization = OrganizationFixture({
    id: '456',
    slug: 'other-org',
    name: 'Other organization',
  });
  const monitor = MetricDetectorFixture({
    id: '42',
    name: 'Checkout latency',
    projectId: '7',
  });
  const otherMonitor = MetricDetectorFixture({
    id: '43',
    name: 'API errors',
    projectId: '8',
  });

  beforeEach(() => {
    ConfigStore.set('localities', [
      {name: 'US', url: 'https://us.example.com'},
      {name: 'EU', url: 'https://eu.example.com'},
    ]);
    ConfigStore.set('cells', [
      {name: 'us', locality_url: 'https://us.example.com'},
      {name: 'eu', locality_url: 'https://eu.example.com'},
    ]);
    for (const cell of ['us', 'eu']) {
      MockApiClient.addMockResponse({
        url: `/_admin/cells/${cell}/customers/`,
        body: [organization, otherOrganization],
      });
    }
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/detectors/',
      body: [monitor],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/other-org/detectors/',
      body: [otherMonitor],
    });
  });

  it('defaults to the sentry organization and loads its monitors', async () => {
    const defaultOrganization = OrganizationFixture({
      id: '789',
      slug: 'sentry',
      name: 'Default organization',
    });
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      match: [MockApiClient.matchQuery({query: 'slug:sentry', per_page: 1})],
      body: [defaultOrganization],
    });
    const monitors = MockApiClient.addMockResponse({
      url: '/organizations/sentry/detectors/',
      body: [monitor],
    });
    render(<SyntheticMetricBreachForm />);

    expect(await screen.findByText('Default organization (sentry)')).toBeInTheDocument();
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Metric monitor'}),
      'Checkout latency (Project ID: 7, Monitor ID: 42)'
    );
    expect(monitors).toHaveBeenCalledWith(
      '/organizations/sentry/detectors/',
      expect.objectContaining({host: 'https://us.example.com'})
    );
    expect(screen.getByRole('button', {name: 'Create test breach'})).toBeEnabled();
  });

  it('keeps an explicit selection when the default organization arrives late', async () => {
    const response = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: '/_admin/cells/us/customers/',
      match: [MockApiClient.matchQuery({query: 'slug:sentry'})],
      asyncDelay: response.promise,
      body: [OrganizationFixture({id: '789', slug: 'sentry'})],
    });
    render(<SyntheticMetricBreachForm />);

    await userEvent.type(screen.getByRole('textbox', {name: 'Organization'}), 'Test');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Organization'}),
      'Test organization (test-org)'
    );
    await act(async () => {
      response.resolve();
      await response.promise;
    });

    expect(screen.getByText('Test organization (test-org)')).toBeInTheDocument();
    expect(screen.queryByText(/\(sentry\)/)).not.toBeInTheDocument();
  });

  it('sorts by members and promotes an exact slug match loaded on a later page', async () => {
    const firstPage = MockApiClient.addMockResponse({
      url: '/_admin/cells/eu/customers/',
      match: [MockApiClient.matchQuery({query: 'TEST-ORG', cursor: undefined})],
      body: [otherOrganization],
      headers: {
        Link: '<https://eu.example.com/api/0/_admin/cells/eu/customers/?cursor=0:50:0>; rel="next"; results="true"; cursor="0:50:0"',
      },
    });
    const nextPage = MockApiClient.addMockResponse({
      url: '/_admin/cells/eu/customers/',
      match: [MockApiClient.matchQuery({query: 'TEST-ORG', cursor: '0:50:0'})],
      body: [organization],
    });
    render(<SyntheticMetricBreachForm />);

    await selectEvent.select(screen.getByRole('textbox', {name: 'Region'}), 'EU');
    await userEvent.type(screen.getByRole('textbox', {name: 'Organization'}), 'TEST-ORG');
    expect(await screen.findByText('Other organization (other-org)')).toBeInTheDocument();
    expect(firstPage).toHaveBeenCalledWith(
      '/_admin/cells/eu/customers/',
      expect.objectContaining({
        host: 'https://eu.example.com',
        query: {query: 'TEST-ORG', per_page: 50, sortBy: 'members', cursor: undefined},
      })
    );
    await userEvent.click(screen.getByRole('button', {name: 'Load more organizations'}));
    expect(await screen.findByText('Test organization (test-org)')).toBeInTheDocument();
    expect(
      screen.getAllByRole('menuitemradio').map(option => option.textContent)
    ).toEqual(['Test organization (test-org)', 'Other organization (other-org)']);
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Organization'}),
      'Test organization (test-org)'
    );
    expect(nextPage).toHaveBeenCalledWith(
      '/_admin/cells/eu/customers/',
      expect.objectContaining({
        host: 'https://eu.example.com',
        query: {query: 'TEST-ORG', per_page: 50, sortBy: 'members', cursor: '0:50:0'},
      })
    );
    expect(
      screen.queryByRole('button', {name: 'Load more organizations'})
    ).not.toBeInTheDocument();
  });

  it('creates an issue in the selected locality and retains selections for another test', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/detectors/',
      body: [
        monitor,
        MetricDetectorFixture({id: '44', name: 'Checkout latency', projectId: '8'}),
      ],
    });
    const response = Promise.withResolvers<void>();
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/metric-breaches/',
      method: 'POST',
      asyncDelay: response.promise,
      body: {issueId: '8', issueUrl: 'https://example.com/issues/8/', eventId: 'event-8'},
    });
    render(<SyntheticMetricBreachForm />);

    await selectEvent.select(screen.getByRole('textbox', {name: 'Region'}), 'EU');
    await userEvent.type(screen.getByRole('textbox', {name: 'Organization'}), 'Te');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Organization'}),
      'Test organization (test-org)'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Metric monitor'}),
      'Checkout latency (Project ID: 8, Monitor ID: 44)'
    );
    const submit = screen.getByRole('button', {name: 'Create test breach'});
    await userEvent.click(submit);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/internal/seer/metric-breaches/',
        expect.objectContaining({
          data: {organizationId: 123, monitorId: 44},
          host: 'https://eu.example.com',
        })
      )
    );
    expect(submit).toBeDisabled();
    await userEvent.click(submit);
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => {
      response.resolve();
      await response.promise;
    });
    expect(await screen.findByRole('link', {name: 'Open issue'})).toHaveAttribute(
      'href',
      'https://example.com/issues/8/'
    );
    expect(screen.getByText(/Test issue created/)).toBeInTheDocument();

    const secondRequest = MockApiClient.addMockResponse({
      url: '/internal/seer/metric-breaches/',
      method: 'POST',
      body: {issueId: '9', issueUrl: 'https://example.com/issues/9/', eventId: 'event-9'},
    });
    await userEvent.click(submit);
    expect(await screen.findByRole('link', {name: 'Open issue'})).toHaveAttribute(
      'href',
      'https://example.com/issues/9/'
    );
    expect(secondRequest).toHaveBeenCalledWith(
      '/internal/seer/metric-breaches/',
      expect.objectContaining({data: {organizationId: 123, monitorId: 44}})
    );
  });

  it('clears dependent selections and ignores a late response after switching context', async () => {
    const response = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: '/internal/seer/metric-breaches/',
      method: 'POST',
      body: {issueId: '8', issueUrl: 'https://example.com/issues/8/', eventId: 'event-8'},
    });
    const otherMonitors = MockApiClient.addMockResponse({
      url: '/organizations/other-org/detectors/',
      body: [otherMonitor],
    });
    render(<SyntheticMetricBreachForm />);
    await userEvent.type(screen.getByRole('textbox', {name: 'Organization'}), 'Test');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Organization'}),
      'Test organization (test-org)'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Metric monitor'}),
      'Checkout latency (Project ID: 7, Monitor ID: 42)'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Create test breach'}));
    expect(await screen.findByRole('link', {name: 'Open issue'})).toBeInTheDocument();
    MockApiClient.addMockResponse({
      url: '/internal/seer/metric-breaches/',
      method: 'POST',
      asyncDelay: response.promise,
      body: {issueId: '9', issueUrl: 'https://example.com/issues/9/', eventId: 'event-9'},
    });
    await userEvent.click(screen.getByRole('button', {name: 'Create test breach'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Organization'}), 'Other');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Organization'}),
      'Other organization (other-org)'
    );
    expect(
      screen.queryByText('Checkout latency (Project ID: 7, Monitor ID: 42)')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Open issue'})).not.toBeInTheDocument();
    await act(async () => {
      response.resolve();
      await response.promise;
    });
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Metric monitor'}),
      'API errors (Project ID: 8, Monitor ID: 43)'
    );
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Create test breach'})).toBeEnabled()
    );
    expect(otherMonitors).toHaveBeenCalledWith(
      '/organizations/other-org/detectors/',
      expect.objectContaining({
        host: 'https://us.example.com',
        query: {query: 'type:metric_issue', per_page: 50},
      })
    );
    expect(screen.queryByRole('link', {name: 'Open issue'})).not.toBeInTheDocument();
    await selectEvent.select(screen.getByRole('textbox', {name: 'Region'}), 'EU');
    expect(screen.queryByText('Other organization (other-org)')).not.toBeInTheDocument();
    expect(
      screen.queryByText('API errors (Project ID: 8, Monitor ID: 43)')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create test breach'})).toBeDisabled();
  });

  it('shows a generic drop error without automatically retrying or losing selections', async () => {
    ConfigStore.set('localities', [
      {name: 'default', url: 'http://dev.example.com:8000'},
    ]);
    ConfigStore.set('cells', [
      {name: '--monolith--', locality_url: 'http://dev.example.com:8000'},
    ]);
    MockApiClient.addMockResponse({
      url: '/_admin/cells/--monolith--/customers/',
      body: [organization],
    });
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/metric-breaches/',
      method: 'POST',
      statusCode: 409,
      body: {detail: 'Synthetic breach was dropped by ingestion controls.'},
    });
    render(<SyntheticMetricBreachForm />);
    await userEvent.type(screen.getByRole('textbox', {name: 'Organization'}), 'Test');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Organization'}),
      'Test organization (test-org)'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Metric monitor'}),
      'Checkout latency (Project ID: 7, Monitor ID: 42)'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Create test breach'}));
    expect(
      await screen.findByText('Synthetic breach was dropped by ingestion controls.')
    ).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', {name: 'Open issue'})).not.toBeInTheDocument();
    expect(
      screen.getByText('Checkout latency (Project ID: 7, Monitor ID: 42)')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create test breach'})).toBeEnabled();
  });
});
