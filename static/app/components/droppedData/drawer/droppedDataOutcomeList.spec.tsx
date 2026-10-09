import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DroppedDataOutcomeList} from 'sentry/components/droppedData/drawer/droppedDataOutcomeList';
import {droppedEventsToOutcomeSections} from 'sentry/components/droppedData/drawer/outcomeSections';
import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';

function OutcomeList({
  droppedEvents,
  acceptedEvents,
  onInvestigate,
}: {
  acceptedEvents: DroppedEventsBucket[];
  droppedEvents: DroppedEventsBucket[];
  onInvestigate?: () => void;
}) {
  return (
    <DroppedDataOutcomeList
      sections={droppedEventsToOutcomeSections(droppedEvents, acceptedEvents)}
      colors={{}}
      onInvestigate={onInvestigate}
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

  it('renders the short description under the reason title', () => {
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

    expect(
      screen.getByText("User agent matched Sentry's known crawler list.")
    ).toBeInTheDocument();
  });

  it('fills the data type into the description from the event category', () => {
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

    expect(
      screen.getByText('Your log events exceeded the project abuse limit.')
    ).toBeInTheDocument();
  });

  it('collapses and expands a section when the header is clicked', async () => {
    render(
      <OutcomeList
        droppedEvents={[
          DroppedEventFixture({
            outcome: 'invalid',
            reason: 'invalid_json',
            start: 0,
            end: 60_000,
            count: 10,
          }),
        ]}
        acceptedEvents={[]}
      />
    );

    expect(screen.getByText('Malformed JSON payload')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Invalid or Malformed'));
    expect(screen.queryByText('Malformed JSON payload')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Invalid or Malformed'));
    expect(screen.getByText('Malformed JSON payload')).toBeInTheDocument();
  });

  it('toggles a section from the keyboard via its chevron button', async () => {
    render(
      <OutcomeList
        droppedEvents={[
          DroppedEventFixture({
            outcome: 'invalid',
            reason: 'invalid_json',
            start: 0,
            end: 60_000,
            count: 10,
          }),
        ]}
        acceptedEvents={[]}
      />
    );

    const toggle = screen.getByRole('button', {name: 'Toggle Invalid or Malformed'});
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('table')).toHaveAttribute(
      'id',
      toggle.getAttribute('aria-controls')
    );

    act(() => toggle.focus());
    await userEvent.keyboard('{Enter}');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('reveals the fix options under a reason row via its chevron', async () => {
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

    // The fix-this affordance is hidden until the reason chevron is clicked.
    expect(screen.queryByRole('button', {name: 'Fix this'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Toggle fix options'}));

    expect(screen.getByRole('button', {name: 'Fix this'})).toBeInTheDocument();

    // Collapsing hides it again.
    await userEvent.click(screen.getByRole('button', {name: 'Toggle fix options'}));
    expect(screen.queryByRole('button', {name: 'Fix this'})).not.toBeInTheDocument();

    // The toggle is reachable from the keyboard.
    act(() => screen.getByRole('button', {name: 'Toggle fix options'}).focus());
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', {name: 'Fix this'})).toBeInTheDocument();
  });

  it('opens the fix-this menu with investigate, settings, and docs entries', async () => {
    const onInvestigate = jest.fn();
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
        onInvestigate={onInvestigate}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Toggle fix options'}));
    await userEvent.click(screen.getByRole('button', {name: 'Fix this'}));

    // Project settings deep-links to the usage stats page scoped to the
    // reason's data category.
    expect(screen.getByRole('menuitemradio', {name: 'Project Settings'})).toHaveAttribute(
      'href',
      expect.stringContaining('/stats/?dataCategory=spans')
    );

    expect(screen.getByRole('menuitemradio', {name: 'Go to Docs'})).toHaveAttribute(
      'href',
      expect.stringContaining('docs.sentry.io')
    );

    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Investigate'}));
    expect(onInvestigate).toHaveBeenCalledTimes(1);
  });

  it('hides investigate when there is no Seer hand-off', async () => {
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

    await userEvent.click(screen.getByRole('button', {name: 'Toggle fix options'}));
    await userEvent.click(screen.getByRole('button', {name: 'Fix this'}));

    expect(
      screen.getByRole('menuitemradio', {name: 'Project Settings'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Investigate'})
    ).not.toBeInTheDocument();
  });
});
