import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {
  InvestigationHypothesisFixture,
  InvestigationVerificationStepFixture,
} from 'sentry/views/investigations/fixtures';
import {HypothesisCard} from 'sentry/views/investigations/hypotheses/hypothesisCard';

describe('HypothesisCard', () => {
  it('renders the statement, rationale, and one-based ordinal', () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          order: 1,
          statement: 'An external SSO provider slowed the response',
          rationale: 'SSO and non-SSO organizations slowed together.',
        })}
      />
    );

    expect(
      screen.getByRole('heading', {name: 'An external SSO provider slowed the response'})
    ).toBeInTheDocument();
    expect(
      screen.getByText('SSO and non-SSO organizations slowed together.')
    ).toBeInTheDocument();
    // `order` is zero-based on the wire, so the second hypothesis reads as 2.
    expect(screen.getByText('Hypothesis 2')).toBeInTheDocument();
  });

  it('shows the verdict as a tag without confidence', () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          effectiveStatus: 'supported',
          confidence: 0.86,
        })}
      />
    );

    expect(screen.getByTestId('hypothesis-status')).toHaveTextContent('Supported');
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });

  it('omits confidence stored on the agent verdict', () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          effectiveStatus: 'inconclusive',
          confidence: undefined,
          agentVerdict: {
            verdict: 'inconclusive',
            confidence: 0.34,
            rationale: 'Span coverage is incomplete.',
            supportingEvidenceIds: [],
            refutingEvidenceIds: [],
            remainingGaps: [],
          },
        })}
      />
    );

    expect(screen.getByTestId('hypothesis-status')).toHaveTextContent('Inconclusive');
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });

  it('omits confidence while the hypothesis is still in flight', () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          effectiveStatus: 'investigating',
          status: 'running',
          confidence: 0.4,
          verificationSteps: [
            InvestigationVerificationStepFixture({status: 'running', result: null}),
          ],
        })}
      />
    );

    expect(screen.getByText('Verifying…')).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });

  // A hypothesis in flight is one `effectiveStatus`, but it passes through
  // several states worth naming. They are read off the verification steps,
  // since that is the only place the distinction exists.
  it.each([
    ['no steps planned yet', 'Formed', [], 'queued'],
    [
      'steps planned but not started',
      'Preparing checks',
      [InvestigationVerificationStepFixture({status: 'queued', result: null})],
      'queued',
    ],
    [
      'steps running',
      'Verifying…',
      [InvestigationVerificationStepFixture({status: 'running', result: null})],
      'running',
    ],
    [
      'every step finished, no verdict',
      'Evidence checked',
      [InvestigationVerificationStepFixture({status: 'completed', result: 'Done.'})],
      'running',
    ],
  ] as const)('reads %s as "%s"', (_name, label, verificationSteps, status) => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          effectiveStatus: 'investigating',
          status,
          verificationSteps: [...verificationSteps],
        })}
      />
    );

    // Scoped, because "Evidence checked" is also the heading over the steps.
    expect(
      within(screen.getByTestId('hypothesis-status')).getByText(label)
    ).toBeInTheDocument();
  });

  it('lists verification steps in order with their results', () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          verificationSteps: [
            InvestigationVerificationStepFixture({
              id: 'second',
              order: 1,
              title: 'Second check',
              result: 'Ran second.',
            }),
            InvestigationVerificationStepFixture({
              id: 'first',
              order: 0,
              title: 'First check',
              result: 'Ran first.',
            }),
          ],
        })}
      />
    );

    expect(screen.getByText('Evidence checked')).toBeInTheDocument();
    // The only list inside a card is the evidence list; the card itself is an
    // `li` belonging to the surrounding hypothesis row.
    const steps = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(steps[0]).toHaveTextContent('First check');
    expect(steps[1]).toHaveTextContent('Second check');
  });

  // The summary is the toggle's children rather than a label sitting beside a
  // chevron-only button, so the whole row opens the step.
  it('makes the whole row of a step that has run the toggle', async () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          verificationSteps: [
            InvestigationVerificationStepFixture({
              title: 'Compare FCP with server response time',
              result: 'The delay begins before the document reaches the browser.',
              objective: 'Establish where the delay starts.',
            }),
          ],
        })}
      />
    );

    const toggle = screen.getByRole('button', {
      name: /Compare FCP with server response time/,
    });
    expect(toggle).toHaveTextContent(
      'The delay begins before the document reaches the browser.'
    );
    expect(screen.getByText('Establish where the delay starts.')).not.toBeVisible();

    // Clicking the result line — the far side of the row from the chevron —
    // still toggles, because it is inside the button.
    await userEvent.click(
      screen.getByText('The delay begins before the document reaches the browser.')
    );

    expect(screen.getByText('Establish where the delay starts.')).toBeVisible();
  });

  it('leaves a step with nothing to unpack unopenable', () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          verificationSteps: [
            InvestigationVerificationStepFixture({
              title: 'Compare FCP with server response time',
              status: 'running',
              result: null,
            }),
          ],
        })}
      />
    );

    expect(
      screen.queryByRole('button', {name: /Compare FCP with server response time/})
    ).not.toBeInTheDocument();
  });

  it('describes a step that has not produced a result yet', () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          verificationSteps: [
            InvestigationVerificationStepFixture({status: 'running', result: null}),
          ],
        })}
      />
    );

    expect(screen.getByText('Awaiting evidence')).toBeInTheDocument();
  });

  it("prefers a failed step's error message over the generic failure label", () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          verificationSteps: [
            InvestigationVerificationStepFixture({
              status: 'failed',
              result: null,
              error: {
                code: 'timeout',
                message: 'The query timed out.',
                retryable: true,
              },
            }),
          ],
        })}
      />
    );

    expect(screen.getByText('The query timed out.')).toBeInTheDocument();
    expect(screen.queryByText('This check failed.')).not.toBeInTheDocument();
  });

  it('surfaces a hypothesis-level error', () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          effectiveStatus: 'failed',
          error: {
            code: 'no_data',
            message: 'No traces covered the incident window.',
            retryable: false,
          },
        })}
      />
    );

    expect(
      screen.getByText('No traces covered the incident window.')
    ).toBeInTheDocument();
  });

  it.each([
    // Only an explanation that stands gets the solid accent edge.
    ['supported', 'accent'],
    ['accepted', 'accent'],
    // Checked, and not the answer. These read the same to someone scanning the
    // row, so one broken edge covers all of them.
    ['inconclusive', 'dashed'],
    ['refuted', 'dashed'],
    ['rejected', 'dashed'],
    ['failed', 'dashed'],
    ['cancelled', 'dashed'],
    // Still being investigated. An ordinary edge, because dashing it would
    // announce a verdict the agent has not reached.
    ['investigating', 'solid'],
    ['pending', 'solid'],
  ] as const)('draws a %s hypothesis with a %s border', (effectiveStatus, border) => {
    render(
      <HypothesisCard hypothesis={InvestigationHypothesisFixture({effectiveStatus})} />
    );

    expect(screen.getByTestId('investigation-hypothesis')).toHaveAttribute(
      'data-border',
      border
    );
  });

  it('hides the evidence section when there are no steps', () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({verificationSteps: []})}
      />
    );

    expect(screen.queryByText('Evidence checked')).not.toBeInTheDocument();
  });

  it('renders no overflow menu without actions', () => {
    render(<HypothesisCard hypothesis={InvestigationHypothesisFixture()} />);

    expect(screen.queryByRole('button', {name: /Actions for/})).not.toBeInTheDocument();
  });

  it('opens the overflow menu and runs an action', async () => {
    const onAction = jest.fn();
    const hypothesis = InvestigationHypothesisFixture();
    render(
      <HypothesisCard
        hypothesis={hypothesis}
        actions={[{key: 'accept', label: 'Accept', onAction}]}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {name: `Actions for ${hypothesis.statement}`})
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Accept'}));

    expect(onAction).toHaveBeenCalled();
  });
});
