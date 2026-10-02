import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  InvestigationHypothesisFixture,
  InvestigationOrchestrationFixture,
  InvestigationVerificationStepFixture,
} from 'sentry/views/investigations/fixtures';
import {getSeerStatusBlock} from 'sentry/views/investigations/statusBlock/getSeerStatusBlock';
import {SeerStatusBlock} from 'sentry/views/investigations/statusBlock/seerStatusBlock';

describe('SeerStatusBlock', () => {
  it('omits the elapsed time when there is nothing to count from', () => {
    render(<SeerStatusBlock variant="running" title="Seer is investigating" />);

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

  it('lists tool calls when they are supplied', () => {
    const {rerender} = render(
      <SeerStatusBlock variant="running" title="Seer is gathering context" />
    );

    expect(screen.queryByRole('list', {name: 'Tool calls'})).not.toBeInTheDocument();

    rerender(
      <SeerStatusBlock
        variant="running"
        title="Seer is gathering context"
        toolActivity={[
          {id: 'a', kind: 'tool', status: 'completed', title: 'Query spans'},
          {id: 'b', kind: 'tool', status: 'running', title: 'Compare releases'},
        ]}
      />
    );

    const list = screen.getByRole('list', {name: 'Tool calls'});
    expect(list).toHaveTextContent('Query spans');
    expect(list).toHaveTextContent('Compare releases');
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

  describe('tool activity', () => {
    function activity(id: string, status = 'completed' as const) {
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

    it('keeps only the latest few calls', () => {
      const projection = InvestigationOrchestrationFixture({
        status: 'processing',
        phase: 'reporting',
      });
      projection.report.currentBlockToolActivity = ['1', '2', '3', '4'].map(id =>
        activity(id)
      );

      expect(getSeerStatusBlock(projection)?.toolActivity?.map(a => a.id)).toEqual([
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
