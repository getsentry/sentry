import {AnnotationFixture} from 'sentry-fixture/annotation';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {DroppedDataTooltip} from 'sentry/views/explore/components/chart/droppedDataBand/droppedDataTooltip';
import {groupIntoBuckets} from 'sentry/views/explore/components/chart/droppedDataBand/utils';

const START = Date.UTC(2024, 0, 12, 15, 0);
const END = Date.UTC(2024, 0, 12, 15, 5);

function ExampleDroppedDataTooltip({
  dropped,
  accepted = [],
}: {
  dropped: Annotation[];
  accepted?: Annotation[];
}) {
  const [bucket] = groupIntoBuckets(dropped, accepted);

  return <DroppedDataTooltip bucket={bucket!} timezone="UTC" />;
}

describe('DroppedDataTooltip', () => {
  it('shows the drop ratio, a row per outcome, and the time range', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          AnnotationFixture({
            start: START,
            end: END,
            outcome: 'rate_limited',
            eventCount: 40_000,
          }),
          AnnotationFixture({
            start: START,
            end: END,
            outcome: 'invalid',
            eventCount: 20_000,
          }),
        ]}
        accepted={[
          AnnotationFixture({
            start: START,
            end: END,
            outcome: 'accepted',
            eventCount: 180_000,
          }),
        ]}
      />
    );

    expect(screen.getByText('Total Dropped')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();

    expect(screen.getByText('Rate Limit Rejected')).toBeInTheDocument();
    expect(screen.getByText('40K')).toBeInTheDocument();
    expect(screen.getByText('Invalid Data Rejected')).toBeInTheDocument();
    expect(screen.getByText('20K')).toBeInTheDocument();
    expect(screen.getAllByText('/240K')).toHaveLength(2);

    expect(screen.getByText('Jan 12, 2024 3:00 PM - 3:05 PM UTC')).toBeInTheDocument();
  });

  it('shows <0.01% for a drop ratio at or below 0.01%', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[AnnotationFixture({start: START, end: END, eventCount: 1})]}
        accepted={[AnnotationFixture({start: START, end: END, eventCount: 9_999})]}
      />
    );

    expect(screen.getByText('<0.01%')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('reads a drop with no accepted volume as the whole bucket', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[AnnotationFixture({start: START, end: END, eventCount: 10})]}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('/10')).toBeInTheDocument();
  });

  it('labels an unintentional client discard as an SDK drop', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          AnnotationFixture({
            start: START,
            end: END,
            outcome: 'client_discard',
            reason: 'queue_overflow',
            eventCount: 10,
          }),
        ]}
      />
    );

    expect(screen.getByText('SDK Data Dropped')).toBeInTheDocument();
  });

  it('shares one byte unit between the payload row numbers', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          AnnotationFixture({start: START, end: END, eventCount: 10, byteSize: 26e9}),
        ]}
        accepted={[
          AnnotationFixture({
            start: START,
            end: END,
            eventCount: 90,
            byteSize: 224e9,
          }),
        ]}
      />
    );

    expect(screen.getByText('Payloads Rejected')).toBeInTheDocument();
    expect(screen.getByText('26')).toBeInTheDocument();
    expect(screen.getByText('/250 GB')).toBeInTheDocument();
  });

  it('omits the payload row for datasets without a byte category', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[AnnotationFixture({start: START, end: END, eventCount: 10})]}
      />
    );

    expect(screen.queryByText('Payloads Rejected')).not.toBeInTheDocument();
  });

  it('falls back to a generic label for an unknown outcome', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          AnnotationFixture({
            start: START,
            end: END,
            outcome: 'something_new',
            eventCount: 10,
          }),
        ]}
      />
    );

    expect(screen.getByText('Other Rejected')).toBeInTheDocument();
  });
});
