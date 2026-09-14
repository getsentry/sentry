import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {InvestigationOrchestrationFixture} from 'sentry/views/investigations/fixtures';
import {
  InvestigationHypotheses,
  shouldPollInvestigationRun,
} from 'sentry/views/investigations/hypotheses/investigationHypotheses';
import type {InvestigationOrchestration} from 'sentry/views/investigations/types';

const organization = OrganizationFixture({features: ['investigations']});
const orchestrationUrl =
  '/organizations/org-slug/investigations/investigation-1/orchestration/';
const commandsUrl = `${orchestrationUrl}commands/`;

function renderHypotheses() {
  return render(<InvestigationHypotheses investigationId="investigation-1" />, {
    additionalWrapper: ({children}) => (
      <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
    ),
    organization,
  });
}

describe('shouldPollInvestigationRun', () => {
  it.each([
    ['pending', true],
    ['processing', true],
    [undefined, true],
    // Blocked on a person, not on the agent. Every investigation created
    // without a prompt starts here, so polling would never stop.
    ['awaiting_input', false],
    ['completed', false],
    ['failed', false],
    ['cancelled', false],
  ] as const)('%s polls: %s', (status, expected) => {
    expect(shouldPollInvestigationRun(status)).toBe(expected);
  });
});

describe('InvestigationHypotheses', () => {
  it('renders the hypotheses carried on the projection', async () => {
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture(),
    });

    renderHypotheses();

    expect(await screen.findAllByTestId('investigation-hypothesis')).toHaveLength(3);
    expect(
      screen.getByRole('heading', {
        name: 'Database or cache degradation delayed the response',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Supported · 86% Confidence')).toBeInTheDocument();
  });

  it('highlights the report primary hypothesis', async () => {
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture(),
    });

    renderHypotheses();

    const cards = await screen.findAllByTestId('investigation-hypothesis');
    expect(cards[0]).toHaveAttribute('data-primary', 'true');
    expect(cards[1]).toHaveAttribute('data-primary', 'false');
  });

  it('renders nothing when the projection carries no hypotheses', async () => {
    const request = MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({hypotheses: []}),
    });

    renderHypotheses();

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.queryByTestId('investigation-hypotheses')).not.toBeInTheDocument();
  });

  it('does not fetch when there is no agentic run behind the investigation', () => {
    const request = MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture(),
    });

    render(
      <InvestigationHypotheses investigationId="investigation-1" enabled={false} />,
      {
        additionalWrapper: ({children}) => (
          <QueryClientProvider client={makeTestQueryClient()}>
            {children}
          </QueryClientProvider>
        ),
        organization,
      }
    );

    expect(request).not.toHaveBeenCalled();
  });

  it('sends a disposition command fenced on the workflow version', async () => {
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({workflowVersion: 7}),
    });
    const commandRequest = MockApiClient.addMockResponse({
      url: commandsUrl,
      method: 'POST',
      body: {
        accepted: true,
        duplicate: false,
        requestId: 'request-1',
        workflowVersion: 8,
        commandStatus: 'accepted',
        commandError: null,
        runId: '9001',
        projection: InvestigationOrchestrationFixture({workflowVersion: 8}),
      },
    });

    renderHypotheses();

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Actions for Database or cache degradation delayed the response',
      })
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Accept'}));

    await waitFor(() =>
      expect(commandRequest).toHaveBeenCalledWith(
        commandsUrl,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            expectedWorkflowVersion: 7,
            command: {
              type: 'set_hypothesis_disposition',
              hypothesisId: 'hypothesis-1',
              disposition: 'accepted',
            },
          }),
        })
      )
    );
  });

  it('writes the returned projection straight into the cache', async () => {
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({workflowVersion: 7}),
    });
    const updated: InvestigationOrchestration = InvestigationOrchestrationFixture({
      workflowVersion: 8,
      hypotheses: InvestigationOrchestrationFixture().hypotheses!.map(hypothesis =>
        hypothesis.id === 'hypothesis-1'
          ? {
              ...hypothesis,
              effectiveStatus: 'accepted' as const,
              // A viewer decision, which the card credits to them by name.
              decisionSource: 'user' as const,
            }
          : hypothesis
      ),
    });
    MockApiClient.addMockResponse({
      url: commandsUrl,
      method: 'POST',
      body: {
        accepted: true,
        duplicate: false,
        requestId: 'request-1',
        workflowVersion: 8,
        commandStatus: 'accepted',
        commandError: null,
        runId: '9001',
        projection: updated,
      },
    });

    renderHypotheses();

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Actions for Database or cache degradation delayed the response',
      })
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Accept'}));

    // A response that does carry the decision lands without a refetch. The
    // server only does that once Seer has applied the command; see the settled
    // run below for what happens in between.
    expect(
      await screen.findByText('Accepted by you · 86% Confidence')
    ).toBeInTheDocument();
  });

  it('keeps re-reading a settled run until Seer applies an accepted command', async () => {
    // A finished run polls no more, which is the point of settling it. But
    // Sentry only queues a command: the response echoes the projection it
    // already had with nothing but `workflowVersion` moved on, and Seer
    // rewrites the real one later. Without the command reopening the polling,
    // the card would sit on its old disposition until someone reloaded.
    const orchestrationRequest = MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({
        status: 'completed',
        workflowVersion: 7,
      }),
    });
    const commandRequest = MockApiClient.addMockResponse({
      url: commandsUrl,
      method: 'POST',
      body: {
        accepted: true,
        duplicate: false,
        requestId: 'request-1',
        workflowVersion: 8,
        commandStatus: 'accepted',
        commandError: null,
        runId: '9001',
        // Unchanged apart from the version, exactly as the endpoint returns it.
        projection: InvestigationOrchestrationFixture({
          status: 'completed',
          workflowVersion: 8,
        }),
      },
    });

    renderHypotheses();
    await screen.findAllByTestId('investigation-hypothesis');
    const callsWhileSettled = orchestrationRequest.mock.calls.length;

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Actions for Database or cache degradation delayed the response',
      })
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Accept'}));
    await waitFor(() => expect(commandRequest).toHaveBeenCalled());

    // Nothing else would ask again: the run is completed, so this only grows
    // because the command put the query back on its interval.
    await waitFor(
      () =>
        expect(orchestrationRequest.mock.calls.length).toBeGreaterThan(callsWhileSettled),
      {timeout: 6000}
    );
  }, 15_000);

  it('renders hypotheses whose verification steps have not been planned yet', async () => {
    // `verificationSteps` is `required=False` with no default on the contract,
    // so a hypothesis the agent has only just formed arrives without the key at
    // all — not as an empty list.
    const hypotheses = InvestigationOrchestrationFixture().hypotheses.map(hypothesis => {
      const unplanned = {...hypothesis, effectiveStatus: 'pending' as const};
      delete unplanned.verificationSteps;
      return unplanned;
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({hypotheses}),
    });

    renderHypotheses();

    // Both the cards and the status block's tally read the steps, so rendering
    // at all is the assertion: either one throws on a missing list.
    expect(await screen.findAllByTestId('investigation-hypothesis')).toHaveLength(3);
    expect(screen.getAllByText('Formed')).toHaveLength(3);
  });
});
