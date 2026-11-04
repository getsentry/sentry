import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DroppedDataOutcomeList} from 'sentry/components/droppedData/drawer/droppedDataOutcomeList';
import {droppedEventsToOutcomeSections} from 'sentry/components/droppedData/outcomeSections';
import type {AskSeerHandler} from 'sentry/components/droppedData/outcomeSections';
import type {OutcomeRow} from 'sentry/components/droppedData/types';

function OutcomeList({
  droppedEvents,
  acceptedEvents,
  onAskSeer,
}: {
  acceptedEvents: OutcomeRow[];
  droppedEvents: OutcomeRow[];
  onAskSeer?: AskSeerHandler;
}) {
  return (
    <DroppedDataOutcomeList
      sections={droppedEventsToOutcomeSections(droppedEvents, acceptedEvents)}
      onAskSeer={onAskSeer}
    />
  );
}

describe('DroppedDataOutcomeList', () => {
  it('renders the outcome label and the human reason title', () => {
    render(
      <OutcomeList
        droppedEvents={[
          OutcomeRowFixture({
            outcome: 'client_discard',
            reason: 'sample_rate',
            start: 0,
            end: 60_000,
            count: 40,
          }),
        ]}
        acceptedEvents={[
          OutcomeRowFixture({
            outcome: 'accepted',
            reason: 'accepted',
            start: 0,
            end: 60_000,
            count: 60,
          }),
        ]}
      />
    );

    expect(screen.getByText('Client Discard')).toBeInTheDocument();
    expect(screen.getByText('Dropped by sample rate')).toBeInTheDocument();
  });

  it('renders dropped totals and shares for the outcome and each reason', () => {
    render(
      <OutcomeList
        droppedEvents={[
          OutcomeRowFixture({
            outcome: 'client_discard',
            reason: 'sample_rate',
            start: 0,
            end: 60_000,
            count: 3000,
          }),
          OutcomeRowFixture({
            outcome: 'client_discard',
            reason: 'before_send',
            start: 60_000,
            end: 120_000,
            count: 1000,
          }),
        ]}
        acceptedEvents={[
          OutcomeRowFixture({
            outcome: 'accepted',
            reason: 'accepted',
            start: 0,
            end: 60_000,
            count: 6000,
          }),
        ]}
      />
    );

    expect(screen.getByText('4K')).toHaveAttribute('title', '4,000');
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('3K')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('1K')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
  });

  it('asks Seer about a reason', async () => {
    const onAskSeer = jest.fn();
    render(
      <OutcomeList
        droppedEvents={[
          OutcomeRowFixture({
            outcome: 'rate_limited',
            reason: 'smart_rate_limit',
            start: 0,
            end: 60_000,
            count: 10,
          }),
        ]}
        acceptedEvents={[]}
        onAskSeer={onAskSeer}
      />
    );

    const button = screen.getByRole('button', {name: 'Ask Seer'});
    await userEvent.hover(button);
    expect(await screen.findByText('Ask Seer')).toBeInTheDocument();

    await userEvent.click(button);
    expect(onAskSeer).toHaveBeenCalledWith(
      expect.objectContaining({outcome: 'rate_limited', reason: 'smart_rate_limit'})
    );
  });

  it('hides Ask Seer when there is no Seer hand-off', () => {
    render(
      <OutcomeList
        droppedEvents={[
          OutcomeRowFixture({
            outcome: 'rate_limited',
            reason: 'smart_rate_limit',
            start: 0,
            end: 60_000,
            count: 10,
          }),
        ]}
        acceptedEvents={[]}
      />
    );

    expect(screen.queryByRole('button', {name: 'Ask Seer'})).not.toBeInTheDocument();
  });

  it("links each reason to its docs section, or the docs page if it's unknown", () => {
    render(
      <OutcomeList
        droppedEvents={[
          OutcomeRowFixture({
            outcome: 'rate_limited',
            reason: 'smart_rate_limit',
            start: 0,
            end: 60_000,
            count: 10,
          }),
          OutcomeRowFixture({
            outcome: 'rate_limited',
            reason: 'some_new_reason',
            start: 0,
            end: 60_000,
            count: 5,
          }),
        ]}
        acceptedEvents={[]}
      />
    );

    const hrefs = screen
      .getAllByRole('button', {name: 'Go to docs'})
      .map(link => link.getAttribute('href'));
    expect(hrefs).toHaveLength(2);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        'https://docs.sentry.io/product/explore/dropped-data/#spike-protection',
        'https://docs.sentry.io/product/explore/dropped-data/',
      ])
    );
  });
});
