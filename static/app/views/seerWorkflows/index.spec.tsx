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
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByText('Night Shift')).toBeInTheDocument();
    expect(screen.getByText('agentic')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Seer Workflows'})).toBeInTheDocument();
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

    expect(screen.getByText('autofix_triggered')).toBeInTheDocument();
    expect(screen.getByText('seer-1')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '100'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/100/`
    );
  });

  it('links to Seer Explorer when agent_run_id is present in extras', async () => {
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
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    const link = await screen.findByRole('button', {name: 'Explorer'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/seer/workflows/?explorerRunId=42`
    );
  });

  it('omits Explorer link when agent_run_id is missing', async () => {
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

    await screen.findByText('Night Shift');
    expect(screen.queryByRole('button', {name: 'Explorer'})).not.toBeInTheDocument();
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
});
