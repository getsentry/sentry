import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {
  InvestigationHypothesisFixture,
  InvestigationOrchestrationFixture,
  InvestigationVerificationStepFixture,
} from 'sentry/views/investigations/fixtures';
import {getSeerStatusBlock} from 'sentry/views/investigations/statusBlock/getSeerStatusBlock';
import {SeerStatusBlock} from 'sentry/views/investigations/statusBlock/seerStatusBlock';
import type {InvestigationToolActivity} from 'sentry/views/investigations/types';

describe('SeerStatusBlock', () => {
  it('omits the elapsed time when there is nothing to count from', () => {
    render(<SeerStatusBlock variant="failed" title="Seer couldn't finish" />);

    expect(screen.queryByText(/\ds$/)).not.toBeInTheDocument();
  });

  it('renders an action only when one is supplied', () => {
    const {rerender} = render(
      <SeerStatusBlock variant="complete" title="Your investigation is ready" />
    );

    expect(screen.queryByTestId('seer-status-block-action')).not.toBeInTheDocument();

    rerender(
      <SeerStatusBlock
        variant="awaitingInput"
        title="Seer needs infrastructure metrics to continue"
        action={<button type="button">Connect Datadog</button>}
      />
    );

    expect(screen.getByTestId('seer-status-block-action')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Connect Datadog'})).toBeInTheDocument();
  });

  it('lists every tool call in an open thinking block, in the order they ran', async () => {
    render(
      <SeerStatusBlock
        variant="running"
        title="Seer is gathering context"
        toolActivity={[
          {id: 'a', kind: 'tool', status: 'completed', title: 'Query spans'},
          {id: 'b', kind: 'tool', status: 'failed', title: 'Fetch traces'},
          {id: 'c', kind: 'tool', status: 'running', title: 'Compare releases'},
        ]}
      />
    );

    const thinking = screen.getByTestId('seer-status-block-thinking');
    // The latest call is the title, as the agent's current tool is in its own
    // thinking block.
    const toggle = within(thinking).getByRole('button', {name: /Compare releases/});
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(thinking)
        .getAllByText(/^(Query spans|Fetch traces|Compare releases)$/)
        .map(node => node.textContent)
    ).toEqual(['Compare releases', 'Query spans', 'Fetch traces', 'Compare releases']);
    expect(within(thinking).getByRole('status', {name: 'Running'})).toBeVisible();

    // Open while the run works, but the viewer can fold it away.
    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Query spans')).not.toBeVisible();
  });

  it('announces a queued call as waiting, not as awaiting approval', () => {
    render(
      <SeerStatusBlock
        variant="running"
        title="Seer is gathering context"
        toolActivity={[
          {id: 'a', kind: 'tool', status: 'completed', title: 'Query spans'},
          {id: 'b', kind: 'tool', status: 'queued', title: 'Fetch traces'},
        ]}
      />
    );

    expect(screen.getByRole('status', {name: 'Waiting'})).toBeInTheDocument();
    expect(screen.queryByLabelText('Waiting for approval')).not.toBeInTheDocument();
  });

  it('shows a thinking block before any call has landed', () => {
    render(<SeerStatusBlock variant="running" title="Seer is looking for causes" />);

    expect(
      within(screen.getByTestId('seer-status-block-thinking')).getByRole('button', {
        name: /Thinking/,
      })
    ).toBeInTheDocument();
  });

  describe('clock', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    });

    afterEach(() => {
      try {
        act(() => jest.runOnlyPendingTimers());
      } finally {
        jest.useRealTimers();
      }
    });

    it("counts up from the run's own start", () => {
      render(
        <SeerStatusBlock
          variant="running"
          title="Seer is gathering context"
          startTime={new Date('2029-12-31T23:59:18Z')}
        />
      );

      expect(screen.getByText('42.0s')).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(1500));
      expect(screen.getByText('43.5s')).toBeInTheDocument();
    });

    it('counts from when the block appeared without one', () => {
      render(<SeerStatusBlock variant="running" title="Seer is gathering context" />);

      expect(screen.getByText('0.0s')).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(1500));
      expect(screen.getByText('1.5s')).toBeInTheDocument();
    });
  });

  // A stopped run's last calls are history: a thinking block would read as
  // though the agent were still working.
  it('draws no thinking block once the run has stopped', () => {
    render(
      <SeerStatusBlock
        variant="failed"
        title="Seer couldn't finish this investigation"
        toolActivity={[
          {id: 'a', kind: 'tool', status: 'completed', title: 'Query spans'},
        ]}
      />
    );

    expect(screen.queryByTestId('seer-status-block-thinking')).not.toBeInTheDocument();
    expect(screen.queryByText('Query spans')).not.toBeInTheDocument();
  });
});

describe('getSeerStatusBlock', () => {
  it.each([
    ['awaiting_input', 'awaitingInput', 'Awaiting input'],
    ['failed', 'failed', 'Failed'],
    ['cancelled', 'cancelled', 'Cancelled'],
    ['completed', 'complete', 'Completed'],
  ] as const)(
    'maps the %s run status to the %s variant',
    (status, variant, statusLabel) => {
      const block = getSeerStatusBlock(
        InvestigationOrchestrationFixture({status, errors: []})
      );

      expect(block).toMatchObject({variant, statusLabel});
    }
  );

  // Every in-flight phase shares one `processing` status, so the phase is the
  // only thing that can tell them apart.
  it.each([
    ['intake', 'Seer is gathering context', 'Running…'],
    ['broad_scan', 'Seer is gathering context', 'Running…'],
    ['planning', 'Seer is looking for likely causes', 'Running…'],
    ['reporting', 'Seer is bringing the findings together', 'Synthesizing…'],
    ['metadata', 'Seer is bringing the findings together', 'Synthesizing…'],
  ] as const)('reads the %s phase as "%s"', (phase, title, statusLabel) => {
    const block = getSeerStatusBlock(
      InvestigationOrchestrationFixture({status: 'processing', phase})
    );

    expect(block).toMatchObject({variant: 'running', title, statusLabel});
  });

  it('counts the hypotheses it is checking', () => {
    const block = getSeerStatusBlock(
      InvestigationOrchestrationFixture({status: 'processing', phase: 'investigating'})
    );

    expect(block?.title).toBe(
      'Seer found 3 possible causes and is checking for evidence'
    );
  });

  it('does not quote a count before any hypothesis has landed', () => {
    const block = getSeerStatusBlock(
      InvestigationOrchestrationFixture({
        status: 'processing',
        phase: 'investigating',
        hypotheses: [],
      })
    );

    expect(block?.title).toBe('Seer is checking for evidence');
  });

  // A check that broke still ran: the tally is how much work stands behind the
  // report, not how much of it succeeded.
  it('tallies checks that errored alongside those that produced a result', () => {
    const block = getSeerStatusBlock(
      InvestigationOrchestrationFixture({
        status: 'completed',
        hypotheses: [
          InvestigationHypothesisFixture({
            verificationSteps: [
              InvestigationVerificationStepFixture({id: 'a', result: 'Found it.'}),
              InvestigationVerificationStepFixture({
                id: 'b',
                result: null,
                error: {code: 'timeout', message: 'Timed out.', retryable: true},
              }),
              InvestigationVerificationStepFixture({id: 'c', result: null, error: null}),
            ],
          }),
        ],
      })
    );

    expect(block?.meta).toBe('1 possible cause • 2 checks completed');
  });

  it('prefers the run error over the report error', () => {
    const block = getSeerStatusBlock(
      InvestigationOrchestrationFixture({
        status: 'failed',
        errors: [
          {code: 'timeout', message: 'The trace request timed out.', retryable: true},
        ],
      })
    );

    expect(block?.description).toBe('The trace request timed out.');
  });

  // Seer can introduce a status before this code knows the name. A missing
  // block would read as "nothing is happening", which is worse than a generic
  // one.
  it('still renders a block for an unrecognized status', () => {
    const block = getSeerStatusBlock(
      InvestigationOrchestrationFixture({status: 'regrouping', phase: 'planning'})
    );

    expect(block).toMatchObject({variant: 'running'});
  });

  // The server's and the browser's clocks need not agree, so the run's start is
  // its active time counted back from when the browser received the snapshot.
  it("starts the clock at the run's start on the browser's clock", () => {
    const block = getSeerStatusBlock(
      InvestigationOrchestrationFixture({
        status: 'processing',
        phase: 'broad_scan',
        startedAt: '2025-01-01T00:00:00Z',
        finishedAt: null,
        activeTimeElapsedSeconds: 24.5,
        activeSince: '2025-01-01T00:05:00Z',
        serverTime: '2025-01-01T00:05:10Z',
      }),
      Date.parse('2030-01-01T00:00:00Z')
    );

    expect(block?.startTime).toEqual(new Date('2029-12-31T23:59:25.500Z'));
  });

  it('leaves the clock unanchored without a receipt time', () => {
    const block = getSeerStatusBlock(
      InvestigationOrchestrationFixture({status: 'processing', phase: 'broad_scan'})
    );

    expect(block?.startTime).toBeUndefined();
  });

  describe('tool activity', () => {
    function activity(
      id: string,
      status: InvestigationToolActivity['status'] = 'completed'
    ) {
      return {id, kind: 'tool' as const, status, title: `Call ${id}`};
    }

    it('shows the broad scan calls while gathering context', () => {
      const projection = InvestigationOrchestrationFixture({
        status: 'processing',
        phase: 'broad_scan',
      });
      projection.broadScan.toolActivity = [activity('scan')];

      expect(getSeerStatusBlock(projection)?.toolActivity).toEqual([activity('scan')]);
    });

    it('shows only the calls of hypotheses still being investigated', () => {
      const block = getSeerStatusBlock(
        InvestigationOrchestrationFixture({
          status: 'processing',
          phase: 'investigating',
          hypotheses: [
            InvestigationHypothesisFixture({
              id: 'settled',
              effectiveStatus: 'supported',
              toolActivity: [activity('old')],
            }),
            InvestigationHypothesisFixture({
              id: 'active',
              effectiveStatus: 'investigating',
              toolActivity: [activity('new')],
            }),
          ],
        })
      );

      expect(block?.toolActivity).toEqual([activity('new')]);
    });

    // Parallel hypotheses keep their own latest-last lists with no timestamps,
    // so one hypothesis's finished call must not be shown as "now" over another's
    // running one.
    it('puts calls still in flight last across parallel hypotheses', () => {
      const block = getSeerStatusBlock(
        InvestigationOrchestrationFixture({
          status: 'processing',
          phase: 'investigating',
          hypotheses: [
            InvestigationHypothesisFixture({
              id: 'first',
              effectiveStatus: 'investigating',
              toolActivity: [activity('a-done'), activity('a-running', 'running')],
            }),
            InvestigationHypothesisFixture({
              id: 'second',
              effectiveStatus: 'investigating',
              toolActivity: [activity('b-queued', 'queued'), activity('b-done')],
            }),
          ],
        })
      );

      expect(block?.toolActivity?.map(a => a.id)).toEqual([
        'a-done',
        'b-done',
        'b-queued',
        'a-running',
      ]);
    });

    // The thinking block lists every call for the phase, not just the latest,
    // so all of them have to reach it.
    it('passes every call for the phase, latest last', () => {
      const projection = InvestigationOrchestrationFixture({
        status: 'processing',
        phase: 'reporting',
      });
      projection.report.currentBlockToolActivity = ['1', '2', '3', '4'].map(id =>
        activity(id)
      );

      expect(getSeerStatusBlock(projection)?.toolActivity?.map(a => a.id)).toEqual([
        '1',
        '2',
        '3',
        '4',
      ]);
    });

    // Once a run stops, its last calls are history: listing them would read as
    // though the agent were still working.
    it('omits tool calls once the run has stopped', () => {
      const projection = InvestigationOrchestrationFixture({status: 'failed'});
      projection.report.currentBlockToolActivity = [activity('last')];

      expect(getSeerStatusBlock(projection)?.toolActivity).toBeUndefined();
    });

    it('omits the list when there are no calls', () => {
      const block = getSeerStatusBlock(
        InvestigationOrchestrationFixture({status: 'processing', phase: 'planning'})
      );

      expect(block?.toolActivity).toBeUndefined();
    });
  });
});
