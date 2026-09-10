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

  it('shows confidence once the agent has reached a verdict', () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          effectiveStatus: 'supported',
          confidence: 0.86,
        })}
      />
    );

    expect(screen.getByText('Supported · 86% Confidence')).toBeInTheDocument();
  });

  it('falls back to the verdict confidence when the hypothesis omits it', () => {
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

    expect(screen.getByText('Inconclusive · 34% Confidence')).toBeInTheDocument();
  });

  it('omits confidence while the hypothesis is still being investigated', () => {
    render(
      <HypothesisCard
        hypothesis={InvestigationHypothesisFixture({
          effectiveStatus: 'investigating',
          status: 'running',
          confidence: 0.4,
        })}
      />
    );

    expect(screen.getByText('Investigating')).toBeInTheDocument();
    expect(screen.queryByText(/Confidence/)).not.toBeInTheDocument();
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

    expect(screen.getByText('Checking…')).toBeInTheDocument();
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
    ['supported', 'accent'],
    ['accepted', 'accent'],
    ['inconclusive', 'dotted'],
    // Ruling a hypothesis out is a real outcome, so it gets an ordinary border
    // rather than one that reads as a fault.
    ['refuted', 'default'],
    ['rejected', 'default'],
    ['investigating', 'default'],
    ['failed', 'default'],
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
