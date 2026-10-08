import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  droppedEventsToCategorySections,
  DroppedDataCategoryList,
} from 'sentry/components/droppedData/droppedDataCategoryList';

describe('droppedEventsToCategorySections', () => {
  it('returns no sections for no dropped events', () => {
    expect(droppedEventsToCategorySections([], [])).toEqual([]);
  });

  it('groups by outcome then reason, labeling the outcome', () => {
    const sections = droppedEventsToCategorySections(
      [
        DroppedEventFixture({outcome: 'invalid', reason: 'cors', start: 0, count: 5}),
        DroppedEventFixture({
          outcome: 'invalid',
          reason: 'timestamp',
          start: 0,
          count: 3,
        }),
        DroppedEventFixture({
          outcome: 'filtered',
          reason: 'web-crawlers',
          start: 0,
          count: 1,
        }),
      ],
      []
    );

    expect(sections.map(s => s.label)).toEqual([
      'Invalid or malformed',
      'Inbound filter',
    ]);
    expect(sections[0]!.events).toBe(8);
    expect(sections[0]!.reasons.map(r => r.reason)).toEqual(['cors', 'timestamp']);
  });

  it('counts distinct buckets a reason appears in', () => {
    const sections = droppedEventsToCategorySections(
      [
        DroppedEventFixture({outcome: 'invalid', reason: 'cors', start: 0, count: 2}),
        DroppedEventFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 60_000,
          count: 4,
        }),
        DroppedEventFixture({outcome: 'invalid', reason: 'cors', start: 0, count: 1}),
      ],
      []
    );

    const cors = sections[0]!.reasons[0]!;
    expect(cors.droppedBuckets).toBe(2);
    expect(cors.events).toBe(7);
  });

  it('computes share against total events (accepted + dropped)', () => {
    const sections = droppedEventsToCategorySections(
      [DroppedEventFixture({outcome: 'invalid', reason: 'cors', start: 0, count: 25})],
      [
        DroppedEventFixture({
          outcome: 'accepted',
          reason: 'accepted',
          start: 0,
          count: 75,
        }),
      ]
    );

    expect(sections[0]!.shareRatio).toBe(0.25);
    expect(sections[0]!.reasons[0]!.shareRatio).toBe(0.25);
  });

  it('guards divide-by-zero when there are no events', () => {
    const sections = droppedEventsToCategorySections(
      [DroppedEventFixture({outcome: 'invalid', reason: 'cors', start: 0, count: 0})],
      []
    );

    expect(sections[0]!.shareRatio).toBe(0);
    expect(sections[0]!.reasons[0]!.shareRatio).toBe(0);
  });

  it('tracks the latest bucket end as lastSeen', () => {
    const sections = droppedEventsToCategorySections(
      [
        DroppedEventFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 0,
          end: 60_000,
          count: 1,
        }),
        DroppedEventFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 120_000,
          end: 180_000,
          count: 1,
        }),
      ],
      []
    );

    expect(sections[0]!.reasons[0]!.lastSeen).toBe(180_000);
  });

  it('clamps lastSeen to now for an in-progress bucket ending in the future', () => {
    const now = 100_000;
    const sections = droppedEventsToCategorySections(
      [
        DroppedEventFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 60_000,
          end: 120_000,
          count: 1,
        }),
      ],
      [],
      now
    );

    expect(sections[0]!.reasons[0]!.lastSeen).toBe(now);
  });
});

describe('DroppedDataCategoryList', () => {
  it('renders the outcome label and the human reason title', () => {
    render(
      <DroppedDataCategoryList
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

    expect(screen.getByText('Client discard')).toBeInTheDocument();
    expect(screen.getByText('Dropped by sample rate')).toBeInTheDocument();
  });

  it('renders the short description under the reason title', () => {
    render(
      <DroppedDataCategoryList
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
      <DroppedDataCategoryList
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

  it('shows the raw reason and outcome codes only when hovering the title', async () => {
    render(
      <DroppedDataCategoryList
        droppedEvents={[
          DroppedEventFixture({
            outcome: 'client_discard',
            reason: 'queue_overflow',
            start: 0,
            end: 60_000,
            count: 5,
          }),
        ]}
        acceptedEvents={[]}
      />
    );

    expect(screen.queryByText('queue_overflow')).not.toBeInTheDocument();
    expect(screen.queryByText('client_discard')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('SDK queue overflow'));

    expect(await screen.findByText('queue_overflow')).toBeInTheDocument();
    expect(screen.getByText('client_discard')).toBeInTheDocument();
  });

  it('collapses and expands a section when the header is clicked', async () => {
    render(
      <DroppedDataCategoryList
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

    await userEvent.click(screen.getByText('Invalid or malformed'));
    expect(screen.queryByText('Malformed JSON payload')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Invalid or malformed'));
    expect(screen.getByText('Malformed JSON payload')).toBeInTheDocument();
  });
});
