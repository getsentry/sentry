import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import SeerRunsDemo from 'sentry/views/seerRunsDemo';

describe('SeerRunsDemo', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  function mockRuns(body: any[], headers?: Record<string, string>) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body,
      headers,
    });
  }

  it('renders one grid row per run with answers stacked in one column', async () => {
    mockRuns([
      {
        id: 'run-1',
        type: 'explorer',
        userId: null,
        lastTriggeredAt: '2026-06-25T10:00:00Z',
        dateCreated: '2026-06-25T09:00:00Z',
        title: 'Fix login bug',
        source: 'autofix',
        projectId: '1',
        groupId: '2',
        outputs: [
          {
            key: 'user_0',
            question: 'What is the root cause?',
            answer: 'A null was dereferenced.',
          },
          {key: 'user_1', question: 'What is the fix?', answer: ''},
        ],
      },
    ]);

    // Render with a non-default query so the default search doesn't put matching
    // tokens (explorer/autofix) in the search bar as well as the grid.
    render(<SeerRunsDemo />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/autofix/runs/`,
          query: {query: 'is:mine'},
        },
      },
    });

    // Run fields.
    expect(await screen.findByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('explorer')).toBeInTheDocument();
    expect(screen.getByText('autofix')).toBeInTheDocument();

    // A single "Outputs" column holds the answers, stacked one after another.
    expect(screen.getByRole('columnheader', {name: 'Outputs'})).toBeInTheDocument();

    // Answered questions render the question text as the heading, with the
    // markdown answer beneath it.
    expect(screen.getByText('What is the root cause?')).toBeInTheDocument();
    expect(screen.getByText('A null was dereferenced.')).toBeInTheDocument();
    // A question with an empty answer is skipped.
    expect(screen.queryByText('What is the fix?')).not.toBeInTheDocument();
  });

  it('sends the demo questions to the runs endpoint', async () => {
    const request = mockRuns([]);

    render(<SeerRunsDemo />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/autofix/runs/`,
          query: {query: 'is:mine'},
        },
      },
    });

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({question: expect.arrayContaining([])}),
        })
      )
    );
    const {question} = request.mock.calls[0][1].query;
    expect(question.length).toBeGreaterThan(0);
  });

  it('reflects the query from the URL in the search bar', async () => {
    mockRuns([]);

    render(<SeerRunsDemo />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/autofix/runs/`,
          query: {query: 'is:mine'},
        },
      },
    });

    expect(await screen.findByText('is')).toBeInTheDocument();
    expect(screen.getByText('mine')).toBeInTheDocument();
  });

  it('shows an empty state when there are no runs', async () => {
    mockRuns([]);

    render(<SeerRunsDemo />, {organization});

    expect(
      await screen.findByText('No Seer runs found for this organization.')
    ).toBeInTheDocument();
  });

  it('renders an error state and can retry', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      statusCode: 500,
      body: {detail: 'boom'},
    });

    render(<SeerRunsDemo />, {organization});

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();

    mockRuns([]);
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(
      await screen.findByText('No Seer runs found for this organization.')
    ).toBeInTheDocument();
    expect(request).toHaveBeenCalled();
  });
});
