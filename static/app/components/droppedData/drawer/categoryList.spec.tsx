import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  droppedEventsToCategorySections,
  DroppedDataCategoryList,
} from 'sentry/components/droppedData/drawer/categoryList';

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

  it('reveals the fix options under a reason row via its chevron', async () => {
    render(
      <DroppedDataCategoryList
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
      <DroppedDataCategoryList
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
      <DroppedDataCategoryList
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
