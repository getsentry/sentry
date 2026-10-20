import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DroppedDataOutcomeList} from 'sentry/components/droppedData/drawer/droppedDataOutcomeList';
import {droppedEventsToOutcomeSections} from 'sentry/components/droppedData/drawer/outcomeSections';
import type {ReasonRow} from 'sentry/components/droppedData/drawer/outcomeSections';
import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';

function OutcomeList({
  droppedEvents,
  acceptedEvents,
  onAskSeer,
}: {
  acceptedEvents: DroppedEventsBucket[];
  droppedEvents: DroppedEventsBucket[];
  onAskSeer?: (row: ReasonRow) => void;
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
          DroppedEventFixture({
            outcome: 'client_discard',
            reason: 'sample_rate',
            start: 0,
            end: 60_000,
            count: 40,
          }),
        ]}
        acceptedEvents={[
          DroppedEventFixture({
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
          DroppedEventFixture({
            outcome: 'client_discard',
            reason: 'sample_rate',
            start: 0,
            end: 60_000,
            count: 3000,
          }),
          DroppedEventFixture({
            outcome: 'client_discard',
            reason: 'before_send',
            start: 60_000,
            end: 120_000,
            count: 1000,
          }),
        ]}
        acceptedEvents={[
          DroppedEventFixture({
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
          DroppedEventFixture({
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
          DroppedEventFixture({
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
});
