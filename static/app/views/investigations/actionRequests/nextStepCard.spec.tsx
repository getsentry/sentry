import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {NextStepCard} from 'sentry/views/investigations/actionRequests/nextStepCard';
import {InvestigationActionRequestFixture} from 'sentry/views/investigations/fixtures';

function getCard() {
  return screen.getByRole('region', {name: 'Recommended action'});
}

describe('NextStepCard', () => {
  it('renders the primary request', () => {
    render(
      <NextStepCard
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
        actionRequests={[InvestigationActionRequestFixture({state: 'withdrawn'})]}
      />
    );

    expect(getCard()).toHaveTextContent(
      'Seer no longer recommends “Widen the interval”.'
    );
  });
});
