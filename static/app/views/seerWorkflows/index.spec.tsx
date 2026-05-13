import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import SeerWorkflows from 'sentry/views/seerWorkflows';

describe('SeerWorkflows', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders list of runs', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {},
          issues: [
            {
              id: '10',
              groupId: '100',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByText('Agentic triage')).toBeInTheDocument();
    expect(screen.getByLabelText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('1 issue')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Sentry Workflows'})).toBeInTheDocument();
  });

  it('shows a short failure label inline and the full error after expanding', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: 'No Seer quota available',
          extras: {},
          issues: [],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByText('Run failed')).toBeInTheDocument();
    expect(screen.getByLabelText('Failed')).toBeInTheDocument();
    expect(screen.queryByText('No Seer quota available')).not.toBeInTheDocument();

    // The raw error string is now debug-only (employees see it inside the
    // Debug disclosure). For a non-employee user, expanding the row should NOT
    // surface the raw "No Seer quota available" string.
    await userEvent.click(screen.getByRole('button', {name: 'Expand run'}));
    expect(screen.queryByText(/No Seer quota available/)).not.toBeInTheDocument();
  });

  it('renders zero-issue triage runs as muted "No issues processed"', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {},
          issues: [],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByText('No issues processed')).toBeInTheDocument();
  });

  it('expands a row to show issue drill-down', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {foo: 'bar'},
          issues: [
            {
              id: '10',
              groupId: '100',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    const expandButton = await screen.findByRole('button', {name: 'Expand run'});
    await userEvent.click(expandButton);

    // User-facing view shows the friendly action label, not the raw enum.
    expect(screen.getByText('Autofix queued')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '100'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/100/`
    );
    // Seer Run ID is a debug field — only visible to employees inside the
    // Debug disclosure. Non-employee tests should not see it.
    expect(screen.queryByText('seer-1')).not.toBeInTheDocument();
  });

  it('links the Result cell to Seer Explorer when agent_run_id is present', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {agent_run_id: 42},
          issues: [
            {
              id: '10',
              groupId: '100',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              dateAdded: '2026-04-20T00:00:01Z',
            },
            {
              id: '11',
              groupId: '101',
              action: 'autofix_triggered',
              seerRunId: 'seer-2',
              dateAdded: '2026-04-20T00:00:02Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    const link = await screen.findByRole('link', {name: '2 issues'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/autofix/?explorerRunId=42`
    );
  });

  it('renders the Result cell as plain text when agent_run_id is missing', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {},
          issues: [
            {
              id: '10',
              groupId: '100',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await screen.findByText('1 issue');
    expect(screen.queryByRole('link', {name: '1 issue'})).not.toBeInTheDocument();
  });

  it('sorts by date desc by default and toggles asc on Date header click', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: 'older',
          dateAdded: '2026-04-10T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {options: {source: 'cron'}},
          issues: [
            {
              id: '1',
              groupId: '100',
              action: 'a',
              seerRunId: 's1',
              dateAdded: '2026-04-10T00:00:01Z',
            },
          ],
        },
        {
          id: 'newer',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {options: {source: 'cron'}},
          issues: [
            {
              id: '2',
              groupId: '101',
              action: 'a',
              seerRunId: 's2',
              dateAdded: '2026-04-20T00:00:01Z',
            },
            {
              id: '3',
              groupId: '102',
              action: 'a',
              seerRunId: 's3',
              dateAdded: '2026-04-20T00:00:02Z',
            },
          ],
        },
      ],
    });

    const {router} = render(<SeerWorkflows />, {organization});

    // Default desc → "2 issues" (newer) appears before "1 issue" (older).
    const resultsDesc = (await screen.findAllByText(/issues?$/)).map(
      el => el.textContent
    );
    expect(resultsDesc).toEqual(['2 issues', '1 issue']);

    await userEvent.click(screen.getByRole('columnheader', {name: /Date/}));

    expect(router.location.query.sort).toBe('asc');
    const resultsAsc = (await screen.findAllByText(/issues?$/)).map(el => el.textContent);
    expect(resultsAsc).toEqual(['1 issue', '2 issues']);
  });

  it('toggles the expanded row when any part of the row is clicked', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {},
          issues: [
            {
              id: '10',
              groupId: '100',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    // Clicking the Strategy text (anywhere in the row that isn't a Link or the
    // chevron button) should toggle the expanded view.
    await userEvent.click(await screen.findByText('Agentic triage'));
    expect(screen.getByText('Autofix queued')).toBeInTheDocument();

    // Clicking again collapses.
    await userEvent.click(screen.getByText('Agentic triage'));
    expect(screen.queryByText('Autofix queued')).not.toBeInTheDocument();
  });

  it('shows empty state when no runs', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [],
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByText('No workflow runs yet.')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      statusCode: 404,
      body: {detail: 'not found'},
    });

    render(<SeerWorkflows />, {organization});

    await waitFor(() => {
      expect(screen.getByRole('button', {name: /retry/i})).toBeInTheDocument();
    });
  });

  it('filters rows by status via URL query param', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {options: {source: 'cron'}},
          issues: [
            {
              id: '10',
              groupId: '100',
              action: 'autofix_triggered',
              seerRunId: 's1',
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
        {
          id: '2',
          dateAdded: '2026-04-21T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: 'No Seer quota available',
          extras: {options: {source: 'cron'}},
          issues: [],
        },
      ],
    });

    render(<SeerWorkflows />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/',
          query: {status: 'failed'},
        },
      },
    });

    expect(await screen.findByText('Run failed')).toBeInTheDocument();
    expect(screen.queryByText('1 issue')).not.toBeInTheDocument();
  });

  it('shows "No runs match your filters." when a filter hides everything', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {options: {source: 'cron'}},
          issues: [
            {
              id: '10',
              groupId: '100',
              action: 'autofix_triggered',
              seerRunId: 's1',
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/',
          query: {status: 'failed'},
        },
      },
    });

    expect(await screen.findByText('No runs match your filters.')).toBeInTheDocument();
  });

  it('Clear all resets all filter query params', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {options: {source: 'cron'}},
          issues: [
            {
              id: '10',
              groupId: '100',
              action: 'autofix_triggered',
              seerRunId: 's1',
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    const {router} = render(<SeerWorkflows />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/',
          query: {status: 'failed', strategy: 'agentic_triage', period: '7d'},
        },
      },
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Clear all'}));

    expect(router.location.query.status).toBeUndefined();
    expect(router.location.query.strategy).toBeUndefined();
    expect(router.location.query.period).toBeUndefined();
    // After clearing, the (previously hidden) succeeded row should re-appear.
    expect(await screen.findByText('1 issue')).toBeInTheDocument();
  });

  it('renders mocked feedback_summary rows when ?mock=1 is set', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [],
    });

    render(<SeerWorkflows />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/',
          query: {mock: '1'},
        },
      },
    });

    expect(await screen.findAllByText('Feedback summary')).toHaveLength(3);
    // Other configurable strategies have one mock run each.
    expect(screen.getAllByLabelText('Succeeded').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Failed')).toBeInTheDocument();
    expect(screen.getByLabelText('Skipped')).toBeInTheDocument();
    // Result cells link to Explorer when agent_run_id is present.
    expect(
      screen.getByRole('link', {name: '4 themes · 47 feedbacks'})
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Run failed'})).toBeInTheDocument();
    // Skipped never started a run, so its Result cell is plain text, not a link.
    expect(screen.getByText('Skipped — too few feedbacks')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /Skipped/})).not.toBeInTheDocument();
    // Non-agentic / non-feedback strategies render their resultText verbatim.
    expect(screen.getByText('3 endpoints regressed')).toBeInTheDocument();
    expect(screen.getByText('4 friction themes · 87 replays')).toBeInTheDocument();
  });

  it('opens the onboarding modal when ?onboarding=1 is set', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [],
    });

    render(<SeerWorkflows />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/',
          query: {onboarding: '1'},
        },
      },
    });
    renderGlobalModal();

    expect(
      await screen.findByRole('heading', {name: 'Welcome to Sentry Workflows'})
    ).toBeInTheDocument();
  });

  it('does NOT open the onboarding modal without ?onboarding=1', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [],
    });

    render(<SeerWorkflows />, {organization});
    renderGlobalModal();

    await screen.findByText('No workflow runs yet.');
    expect(
      screen.queryByRole('heading', {name: 'Welcome to Sentry Workflows'})
    ).not.toBeInTheDocument();
  });

  it('Skip closes the onboarding modal and strips ?onboarding from the URL', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [],
    });

    const {router} = render(<SeerWorkflows />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/',
          query: {onboarding: '1'},
        },
      },
    });
    renderGlobalModal();

    await screen.findByRole('heading', {name: 'Welcome to Sentry Workflows'});
    await userEvent.click(screen.getByRole('button', {name: 'Skip'}));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {name: 'Welcome to Sentry Workflows'})
      ).not.toBeInTheDocument();
    });
    expect(router.location.query.onboarding).toBeUndefined();
  });

  it('renders a "Configure workflows" link to the configure page', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [],
    });

    render(<SeerWorkflows />, {organization});

    const link = await screen.findByRole('button', {name: /Configure workflows/});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/autofix/configure/`
    );
  });
});
