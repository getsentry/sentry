import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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
              groupTitle: 'ValueError: something broke',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [],
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

  it('expands a row to show the issue title, action, and a conversation link', async () => {
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
              groupTitle: 'ValueError: something broke',
              groupShortId: 'SEER-ABC',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [],
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

    // The issue links via its short id and real title, not the bare numeric
    // group id.
    expect(
      screen.getByRole('link', {name: 'SEER-ABC ValueError: something broke'})
    ).toHaveAttribute('href', `/organizations/${organization.slug}/issues/100/`);
    expect(screen.queryByRole('link', {name: '100'})).not.toBeInTheDocument();

    // The action tag itself is the conversation link, not a separate button.
    expect(screen.getByRole('link', {name: 'Autofix queued'})).toHaveAttribute(
      'href',
      expect.stringContaining('explorerRunId=seer-1')
    );

    // Seer Run ID is a debug field — only visible to employees inside the
    // Debug disclosure. Non-employee tests should not see it.
    expect(screen.queryByText('seer-1')).not.toBeInTheDocument();
  });

  it('does not link the action tag for an issue with no seer run', async () => {
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
              groupTitle: 'ValueError: something broke',
              action: 'skip',
              seerRunId: null,
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand run'}));

    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Skipped'})).not.toBeInTheDocument();
  });

  it('shows the triage reason below the action, e.g. why an issue was skipped', async () => {
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
              groupTitle: 'ValueError: something broke',
              action: 'skip',
              reason: 'Third-party rate limit error, not actionable by the team.',
              seerRunId: null,
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand run'}));

    expect(
      screen.getByText('Third-party rate limit error, not actionable by the team.')
    ).toBeInTheDocument();
  });

  it('shows nothing extra when no reason is recorded for an issue', async () => {
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
              groupTitle: 'ValueError: something broke',
              action: 'skip',
              reason: null,
              seerRunId: null,
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand run'}));

    expect(screen.getByText('Skipped')).toBeInTheDocument();
  });

  it('falls back to the bare group id when the issue has no resolved title', async () => {
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
              groupTitle: null,
              groupShortId: null,
              action: 'skip',
              seerRunId: null,
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand run'}));

    expect(screen.getByRole('link', {name: '100'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/100/`
    );
  });

  it('shows a pull request chip for each PR linked to an issue', async () => {
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
              groupTitle: 'ValueError: something broke',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [
                {
                  id: '42',
                  title: 'Fix the ValueError',
                  message: null,
                  dateCreated: '2026-04-20T00:00:01Z',
                  repository: {
                    id: '1',
                    name: 'sentry',
                    url: 'https://github.com/getsentry/sentry',
                    provider: {id: 'github', name: 'GitHub'},
                    status: 'active',
                    externalSlug: 'getsentry/sentry',
                    dateCreated: '2026-04-20T00:00:00Z',
                  },
                  externalUrl: 'https://github.com/getsentry/sentry/pull/42',
                  status: 'merged',
                },
              ],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand run'}));

    // A single button carries both the PR and its status -- no separate
    // "Autofix queued" tag, which would contradict a merged PR.
    const prChip = screen.getByRole('button', {name: 'Merged #42'});
    expect(prChip).toHaveAttribute('href', 'https://github.com/getsentry/sentry/pull/42');
    expect(prChip).toHaveAttribute('target', '_blank');
    expect(screen.queryByText('Autofix queued')).not.toBeInTheDocument();
  });

  it('does not render a link when the PR has no resolved external URL', async () => {
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
              groupTitle: 'ValueError: something broke',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [
                {
                  id: '42',
                  title: 'Fix the ValueError',
                  message: null,
                  dateCreated: '2026-04-20T00:00:01Z',
                  repository: {
                    id: '1',
                    name: 'sentry',
                    url: 'https://github.com/getsentry/sentry',
                    provider: {id: 'github', name: 'GitHub'},
                    status: 'active',
                    externalSlug: 'getsentry/sentry',
                    dateCreated: '2026-04-20T00:00:00Z',
                  },
                  externalUrl: '',
                  status: 'merged',
                },
              ],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand run'}));

    expect(screen.getByText('Merged #42')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Merged #42'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Merged #42'})).not.toBeInTheDocument();
  });

  it('shows the plain PR number with no status prefix when status is unobserved', async () => {
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
              groupTitle: 'ValueError: something broke',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [
                {
                  id: '42',
                  title: 'Fix the ValueError',
                  message: null,
                  dateCreated: '2026-04-20T00:00:01Z',
                  repository: {
                    id: '1',
                    name: 'sentry',
                    url: 'https://github.com/getsentry/sentry',
                    provider: {id: 'github', name: 'GitHub'},
                    status: 'active',
                    externalSlug: 'getsentry/sentry',
                    dateCreated: '2026-04-20T00:00:00Z',
                  },
                  externalUrl: 'https://github.com/getsentry/sentry/pull/42',
                  status: null,
                },
              ],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand run'}));

    expect(screen.getByRole('button', {name: '#42'})).toBeInTheDocument();
    expect(screen.queryByText('Autofix queued')).not.toBeInTheDocument();
  });

  it('shows one labeled pill per triage batch in the expanded panel', async () => {
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
              groupTitle: 'ValueError: something broke',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
          // The null-id shard (not yet mirrored back from Seer) is skipped.
          seerRuns: [{seerRunId: '42'}, {seerRunId: '43'}, {seerRunId: null}],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    // The collapsed row's Result cell is plain text now -- no stacked icons.
    expect(await screen.findByText('1 issue')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Open run in Seer Explorer'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Expand run'}));

    expect(screen.getByText('Triage batches (2)')).toBeInTheDocument();
    // window.location doesn't track the router's memory-history location
    // here, so only the explorerRunId query param is meaningful to assert.
    expect(screen.getByRole('button', {name: 'Batch 1'})).toHaveAttribute(
      'href',
      expect.stringContaining('explorerRunId=42')
    );
    expect(screen.getByRole('button', {name: 'Batch 2'})).toHaveAttribute(
      'href',
      expect.stringContaining('explorerRunId=43')
    );
  });

  it('falls back to extras.agent_run_id for the dispatches panel when a run has no seer runs', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {agent_run_id: 42},
          issues: [],
          seerRuns: [],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand run'}));

    expect(screen.getByRole('button', {name: 'Batch 1'})).toHaveAttribute(
      'href',
      expect.stringContaining('explorerRunId=42')
    );
  });

  it('shows no triage batches recorded when a run has no shards', async () => {
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
              groupTitle: 'ValueError: something broke',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
          seerRuns: [],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand run'}));

    expect(
      screen.getByText('No triage batches recorded for this run.')
    ).toBeInTheDocument();
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
              groupTitle: null,
              action: 'a',
              seerRunId: 's1',
              pullRequests: [],
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
              groupTitle: null,
              action: 'a',
              seerRunId: 's2',
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
            {
              id: '3',
              groupId: '102',
              groupTitle: null,
              action: 'a',
              seerRunId: 's3',
              pullRequests: [],
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
              groupTitle: null,
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [],
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
              groupTitle: null,
              action: 'autofix_triggered',
              seerRunId: 's1',
              pullRequests: [],
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
              groupTitle: null,
              action: 'autofix_triggered',
              seerRunId: 's1',
              pullRequests: [],
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
              groupTitle: null,
              action: 'autofix_triggered',
              seerRunId: 's1',
              pullRequests: [],
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

  it('Strategy filter lists only strategies present in the data', async () => {
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
              groupTitle: null,
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: /Strategy/}));

    // Only the strategy that actually has runs is offered as a filter option.
    expect(screen.getByRole('option', {name: 'Agentic triage'})).toBeInTheDocument();
    // Catalog-only strategies with no runs are not offered.
    expect(
      screen.queryByRole('option', {name: 'Feedback summary'})
    ).not.toBeInTheDocument();
  });

  it('does not linkify the result for a failed run with an agent_run_id', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: 'No Seer quota available',
          extras: {agent_run_id: 42},
          issues: [],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByText('Run failed')).toBeInTheDocument();
    // Even with an agent_run_id present, a failed result must not become a link.
    expect(screen.queryByRole('link', {name: /Run failed/})).not.toBeInTheDocument();
  });

  it('Status filter offers only Succeeded and Failed', async () => {
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

    await userEvent.click(await screen.findByRole('button', {name: /Status/}));

    expect(screen.getByRole('option', {name: 'Succeeded'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Failed'})).toBeInTheDocument();
    // toWorkflowRow never produces these statuses, so they aren't offered.
    expect(screen.queryByRole('option', {name: 'Skipped'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Running'})).not.toBeInTheDocument();
  });

  it('expandLatest auto-expands the latest run visible under active filters', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        // Newest run overall, but failed — hidden by the status=succeeded filter.
        {
          id: 'newer-failed',
          dateAdded: '2026-04-21T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: 'No Seer quota available',
          extras: {},
          issues: [],
        },
        // Older, succeeded run — the latest *visible* one once failures are hidden.
        {
          id: 'older-succeeded',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {},
          issues: [
            {
              id: '10',
              groupId: '100',
              groupTitle: null,
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [],
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
          query: {expandLatest: 'agentic_triage', status: 'succeeded'},
        },
      },
    });

    // The newest run is filtered out, so the older succeeded run auto-expands
    // (rather than nothing) — its issue drill-down shows without a click.
    expect(await screen.findByText('Autofix queued')).toBeInTheDocument();
  });
});
