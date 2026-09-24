import {AnnotationFixture} from 'sentry-fixture/annotation';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  annotationsToCategorySections,
  DroppedDataCategoryList,
} from 'sentry/components/droppedData/droppedDataCategoryList';

describe('annotationsToCategorySections', () => {
  it('returns no sections for no dropped annotations', () => {
    expect(annotationsToCategorySections([], [])).toEqual([]);
  });

  it('groups by outcome then reason, labeling the outcome', () => {
    const sections = annotationsToCategorySections(
      [
        AnnotationFixture({outcome: 'invalid', reason: 'cors', start: 0, eventCount: 5}),
        AnnotationFixture({
          outcome: 'invalid',
          reason: 'timestamp',
          start: 0,
          eventCount: 3,
        }),
        AnnotationFixture({
          outcome: 'filtered',
          reason: 'web-crawlers',
          start: 0,
          eventCount: 1,
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
    const sections = annotationsToCategorySections(
      [
        AnnotationFixture({outcome: 'invalid', reason: 'cors', start: 0, eventCount: 2}),
        AnnotationFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 60_000,
          eventCount: 4,
        }),
        AnnotationFixture({outcome: 'invalid', reason: 'cors', start: 0, eventCount: 1}),
      ],
      []
    );

    const cors = sections[0]!.reasons[0]!;
    expect(cors.droppedBuckets).toBe(2);
    expect(cors.events).toBe(7);
  });

  it('computes share against total events (accepted + dropped)', () => {
    const sections = annotationsToCategorySections(
      [AnnotationFixture({outcome: 'invalid', reason: 'cors', start: 0, eventCount: 25})],
      [
        AnnotationFixture({
          outcome: 'accepted',
          reason: 'accepted',
          start: 0,
          eventCount: 75,
        }),
      ]
    );

    expect(sections[0]!.shareRatio).toBe(0.25);
    expect(sections[0]!.reasons[0]!.shareRatio).toBe(0.25);
  });

  it('guards divide-by-zero when there are no events', () => {
    const sections = annotationsToCategorySections(
      [AnnotationFixture({outcome: 'invalid', reason: 'cors', start: 0, eventCount: 0})],
      []
    );

    expect(sections[0]!.shareRatio).toBe(0);
    expect(sections[0]!.reasons[0]!.shareRatio).toBe(0);
  });

  it('tracks the latest bucket end as lastSeen', () => {
    const sections = annotationsToCategorySections(
      [
        AnnotationFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 0,
          end: 60_000,
          eventCount: 1,
        }),
        AnnotationFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 120_000,
          end: 180_000,
          eventCount: 1,
        }),
      ],
      []
    );

    expect(sections[0]!.reasons[0]!.lastSeen).toBe(180_000);
  });

  it('clamps lastSeen to now for an in-progress bucket ending in the future', () => {
    const now = 100_000;
    const sections = annotationsToCategorySections(
      [
        AnnotationFixture({
          outcome: 'invalid',
          reason: 'cors',
          start: 60_000,
          end: 120_000,
          eventCount: 1,
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
        droppedDataAnnotations={[
          AnnotationFixture({
            outcome: 'client_discard',
            reason: 'sample_rate',
            start: 0,
            end: 60_000,
            eventCount: 40,
          }),
        ]}
        acceptedDataAnnotations={[
          AnnotationFixture({
            outcome: 'accepted',
            reason: 'accepted',
            start: 0,
            end: 60_000,
            eventCount: 60,
          }),
        ]}
      />
    );

    expect(screen.getByText('Client discard')).toBeInTheDocument();
    expect(screen.getByText('Dropped by sample rate')).toBeInTheDocument();
  });

  it('collapses and expands a section when the header is clicked', async () => {
    render(
      <DroppedDataCategoryList
        droppedDataAnnotations={[
          AnnotationFixture({
            outcome: 'invalid',
            reason: 'invalid_json',
            start: 0,
            end: 60_000,
            eventCount: 10,
          }),
        ]}
        acceptedDataAnnotations={[]}
      />
    );

    expect(screen.getByText('Malformed JSON payload')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Invalid or malformed'));
    expect(screen.queryByText('Malformed JSON payload')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Invalid or malformed'));
    expect(screen.getByText('Malformed JSON payload')).toBeInTheDocument();
  });
});
