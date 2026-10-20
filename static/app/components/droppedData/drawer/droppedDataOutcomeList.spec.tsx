import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DroppedDataOutcomeList} from 'sentry/components/droppedData/drawer/droppedDataOutcomeList';
import {droppedEventsToOutcomeSections} from 'sentry/components/droppedData/drawer/outcomeSections';
import type {ReasonRow} from 'sentry/components/droppedData/drawer/outcomeSections';
import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';

function OutcomeList({
  droppedEvents,
  acceptedEvents,
  onTroubleshoot,
}: {
  acceptedEvents: DroppedEventsBucket[];
  droppedEvents: DroppedEventsBucket[];
  onTroubleshoot?: (row: ReasonRow) => void;
}) {
  return (
    <DroppedDataOutcomeList
      sections={droppedEventsToOutcomeSections(droppedEvents, acceptedEvents)}
      colors={{}}
      onTroubleshoot={onTroubleshoot}
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

    expect(screen.getByText('4,000')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('3,000')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
  });

  it('shows the short description when hovering the reason title', async () => {
    render(
      <OutcomeList
        droppedEvents={[
          DroppedEventFixture({
            outcome: 'filtered',
            reason: 'web-crawlers',
            start: 0,
            end: 60_000,
            count: 5,
          }),
        ]}
        acceptedEvents={[]}
      />
    );

    const description = "User agent matched Sentry's known crawler list.";
    expect(screen.queryByText(description)).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('Web crawler filter'));

    expect(await screen.findByText(description)).toBeInTheDocument();
  });

  it('fills the data type into the description from the event category', async () => {
    render(
      <OutcomeList
        droppedEvents={[
          DroppedEventFixture({
            category: 'log_item',
            outcome: 'abuse',
            reason: 'project_abuse_limit',
            start: 0,
            end: 60_000,
            count: 5,
          }),
        ]}
        acceptedEvents={[]}
      />
    );

    await userEvent.hover(screen.getByText('Project abuse limit'));

    expect(
      await screen.findByText('Your log events exceeded the project abuse limit.')
    ).toBeInTheDocument();
  });

  it('opens the reason actions menu with docs and troubleshoot entries', async () => {
    const onTroubleshoot = jest.fn();
    render(
      <OutcomeList
        droppedEvents={[
          DroppedEventFixture({
            category: 'span',
            outcome: 'rate_limited',
            reason: 'smart_rate_limit',
            start: 0,
            end: 60_000,
            count: 10,
          }),
        ]}
        acceptedEvents={[]}
        onTroubleshoot={onTroubleshoot}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Reason actions'}));

    expect(screen.getAllByRole('menuitemradio').map(item => item.textContent)).toEqual([
      'Troubleshoot',
      'Go to Docs',
    ]);
    expect(screen.getByRole('menuitemradio', {name: 'Go to Docs'})).toHaveAttribute(
      'href',
      expect.stringContaining('docs.sentry.io')
    );

    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Troubleshoot'}));
    expect(onTroubleshoot).toHaveBeenCalledWith(
      expect.objectContaining({outcome: 'rate_limited', reason: 'smart_rate_limit'})
    );
  });

  it('hides troubleshoot when there is no Seer hand-off', async () => {
    render(
      <OutcomeList
        droppedEvents={[
          DroppedEventFixture({
            category: 'span',
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

    await userEvent.click(screen.getByRole('button', {name: 'Reason actions'}));

    expect(screen.getByRole('menuitemradio', {name: 'Go to Docs'})).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Troubleshoot'})
    ).not.toBeInTheDocument();
  });
});
