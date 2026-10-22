import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {NextStepCard} from 'sentry/views/investigations/actionRequests/nextStepCard';
import {
  InvestigationActionRequestFixture,
  InvestigationOrchestrationFixture,
} from 'sentry/views/investigations/fixtures';
import type {InvestigationOrchestration} from 'sentry/views/investigations/types';

const completedRun = InvestigationOrchestrationFixture({
  phase: 'completed',
  status: 'completed',
});

function runWith(
  nextStep: NonNullable<InvestigationOrchestration['report']['nextStep']>,
  overrides: Partial<InvestigationOrchestration> = {},
  report: Partial<InvestigationOrchestration['report']> = {}
) {
  return InvestigationOrchestrationFixture({
    ...completedRun,
    ...overrides,
    report: {...completedRun.report, ...report, nextStep},
  });
}

function getCard() {
  return screen.getByRole('region', {name: 'Recommended action'});
}

describe('NextStepCard', () => {
  it('renders the primary request', () => {
    render(
      <NextStepCard
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            id: '313',
            key: 'instrument-retries',
            primary: false,
            title: 'Instrument checkout retries',
            action: null,
          }),
          InvestigationActionRequestFixture(),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent('Widen the interval.');
    expect(card).toHaveTextContent(
      'The 5 minute window fires on single deploy spikes that recover within a minute.'
    );
    expect(card).toHaveTextContent('Would have suppressed 4 of the last 5 alerts.');
    expect(card).not.toHaveTextContent('Instrument checkout retries');
  });

  it('renders advice without an action as text only', () => {
    render(
      <NextStepCard
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            title: 'Instrument checkout retries',
            impact: 'Confirms the timeout cause next time.',
            action: null,
          }),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent('Instrument checkout retries.');
    expect(getCard()).toHaveTextContent('Confirms the timeout cause next time.');
  });

  it('does not add a period after closing punctuation', () => {
    render(
      <NextStepCard
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            title: 'Widen the interval (to 15 minutes).',
          }),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent('Widen the interval (to 15 minutes). The 5');
  });

  it('renders nothing without a primary request', () => {
    render(
      <NextStepCard
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture({primary: false})]}
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('only shows a primary from the newest report', () => {
    render(
      <NextStepCard
        orchestration={runWith({status: 'completed', error: null}, {}, {revision: 3})}
        actionRequests={[
          InvestigationActionRequestFixture({
            id: '314',
            key: 'check-retries',
            reportRevision: 3,
            primary: false,
            anchor: {type: 'hypothesis', id: 'h-1', blockId: null},
          }),
          InvestigationActionRequestFixture({
            reportRevision: 2,
            state: 'withdrawn',
            reason: 'The spikes are real breaches.',
          }),
        ]}
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('renders nothing for a state it does not know', () => {
    render(
      <NextStepCard
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture({state: 'archived'})]}
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('renders text from Seer as plain text', () => {
    render(
      <NextStepCard
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            title: '**Widen** [the interval](https://example.com)',
            rationale: '<b>Spikes</b> recover _fast_',
            impact: '[Click here](https://example.com)',
          }),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent('**Widen** [the interval](https://example.com).');
    expect(card).toHaveTextContent('<b>Spikes</b> recover _fast_');
    expect(card).toHaveTextContent('[Click here](https://example.com)');
    expect(
      within(card).queryByRole('link', {name: /interval|Click here/})
    ).not.toBeInTheDocument();
  });

  it('collapses a request Seer withdrew to its reason', () => {
    render(
      <NextStepCard
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            state: 'withdrawn',
            reason: 'The spikes are real breaches.',
          }),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent(
      'Seer no longer recommends “Widen the interval”: The spikes are real breaches.'
    );
    expect(card).not.toHaveTextContent('The 5 minute window fires');
    expect(card).not.toHaveTextContent('Would have suppressed');
  });

  it('collapses a withdrawn request without a reason to its title', () => {
    render(
      <NextStepCard
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture({state: 'withdrawn'})]}
      />
    );

    expect(getCard()).toHaveTextContent(
      'Seer no longer recommends “Widen the interval”.'
    );
  });

  it('holds space while the next step generates', () => {
    render(
      <NextStepCard
        actionRequests={[]}
        orchestration={runWith(
          {status: 'generating', error: null},
          {phase: 'metadata', status: 'processing'}
        )}
      />
    );

    expect(getCard()).toHaveAttribute('aria-busy', 'true');
  });

  it('holds space before the next step starts', () => {
    render(
      <NextStepCard
        actionRequests={[]}
        orchestration={runWith(
          {status: 'not_started', error: null},
          {phase: 'metadata', status: 'processing'}
        )}
      />
    );

    expect(getCard()).toHaveAttribute('aria-busy', 'true');
  });

  it('renders nothing while the run is loading', () => {
    render(
      <NextStepCard
        actionRequests={[InvestigationActionRequestFixture()]}
        orchestration={undefined}
        orchestrationLoading
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('shows the newest primary over one Seer withdrew', () => {
    render(
      <NextStepCard
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            id: '311',
            key: 'old-primary',
            state: 'withdrawn',
            title: 'Raise the threshold',
            reason: 'The spikes are real breaches.',
          }),
          InvestigationActionRequestFixture(),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent('Widen the interval.');
    expect(getCard()).not.toHaveTextContent('no longer recommends');
  });

  it('holds space for a new next step over a withdrawn one', () => {
    render(
      <NextStepCard
        actionRequests={[
          InvestigationActionRequestFixture({
            reportRevision: 1,
            state: 'withdrawn',
            reason: 'The spikes are real breaches.',
          }),
        ]}
        orchestration={runWith(
          {status: 'generating', error: null},
          {phase: 'metadata', status: 'processing'}
        )}
      />
    );

    expect(getCard()).toHaveAttribute('aria-busy', 'true');
    expect(getCard()).not.toHaveTextContent('no longer recommends');
  });

  it('explains a next step that failed', () => {
    render(
      <NextStepCard
        actionRequests={[]}
        orchestration={runWith({status: 'failed', error: null})}
      />
    );

    expect(getCard()).toHaveTextContent(
      'Seer could not suggest a next step for this investigation.'
    );
  });

  it('hides an old primary while a new report is written', () => {
    render(
      <NextStepCard
        actionRequests={[
          InvestigationActionRequestFixture({
            reportRevision: 2,
            state: 'withdrawn',
            reason: 'The spikes are real breaches.',
          }),
        ]}
        orchestration={runWith(
          {status: 'not_started', error: null},
          {phase: 'reporting', status: 'processing'},
          {status: 'composing', revision: 3}
        )}
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });
});
