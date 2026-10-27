import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DroppedDataTooltip} from 'sentry/components/droppedData/band/droppedDataTooltip';
import {groupIntoBuckets} from 'sentry/components/droppedData/buckets';
import type {OutcomeRow} from 'sentry/components/droppedData/types';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

const START = Date.UTC(2024, 0, 12, 15, 0);
const END = Date.UTC(2024, 0, 12, 15, 5);

function ExampleDroppedDataTooltip({
  dropped,
  accepted = [],
  dataset = DiscoverDatasets.SPANS,
}: {
  dropped: OutcomeRow[];
  accepted?: OutcomeRow[];
  dataset?: DiscoverDatasets;
}) {
  const [bucket] = groupIntoBuckets(dropped, accepted);

  return <DroppedDataTooltip bucket={bucket!} dataset={dataset} timezone="UTC" />;
}

describe('DroppedDataTooltip', () => {
  it('shows the drop ratio, a row per outcome, and the time range', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          OutcomeRowFixture({
            start: START,
            end: END,
            outcome: 'rate_limited',
            count: 40_000,
          }),
          OutcomeRowFixture({
            start: START,
            end: END,
            outcome: 'invalid',
            count: 20_000,
          }),
        ]}
        accepted={[
          OutcomeRowFixture({
            start: START,
            end: END,
            outcome: 'accepted',
            count: 180_000,
          }),
        ]}
      />
    );

    expect(screen.getByText('Dropped Spans')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();

    expect(screen.getByText('Rate Limited')).toBeInTheDocument();
    expect(screen.getByText('40K')).toBeInTheDocument();
    expect(screen.getByText('Invalid or Malformed')).toBeInTheDocument();
    expect(screen.getByText('20K')).toBeInTheDocument();
    expect(screen.getAllByText('/240K')).toHaveLength(2);

    expect(screen.getByText('Jan 12, 2024 3:00 PM - 3:05 PM UTC')).toBeInTheDocument();
  });

  it('names the telemetry type in the header', () => {
    render(
      <ExampleDroppedDataTooltip
        dataset={DiscoverDatasets.OURLOGS}
        dropped={[OutcomeRowFixture({start: START, end: END, count: 10})]}
      />
    );

    expect(screen.getByText('Dropped Logs')).toBeInTheDocument();
  });

  it('shows <0.01% for a drop ratio at or below 0.01%', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[OutcomeRowFixture({start: START, end: END, count: 1})]}
        accepted={[OutcomeRowFixture({start: START, end: END, count: 9_999})]}
      />
    );

    expect(screen.getByText('<0.01%')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('reads a drop with no accepted volume as the whole bucket', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[OutcomeRowFixture({start: START, end: END, count: 10})]}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('/10')).toBeInTheDocument();
  });

  it('shows 0% and the time range for a bucket without drops', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[]}
        accepted={[
          OutcomeRowFixture({start: START, end: END, outcome: 'accepted', count: 500}),
        ]}
      />
    );

    expect(screen.getByText('Dropped Spans')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Jan 12, 2024 3:00 PM - 3:05 PM UTC')).toBeInTheDocument();
  });

  it('labels an unintentional client discard as a client discard', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          OutcomeRowFixture({
            start: START,
            end: END,
            outcome: 'client_discard',
            reason: 'queue_overflow',
            count: 10,
          }),
        ]}
      />
    );

    expect(screen.getByText('Client Discard')).toBeInTheDocument();
  });

  it('falls back to the outcome code for an unknown outcome', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          OutcomeRowFixture({
            start: START,
            end: END,
            outcome: 'something_new',
            count: 10,
          }),
        ]}
      />
    );

    expect(screen.getByText('something_new')).toBeInTheDocument();
  });

  it('labels a filtered outcome as inbound filters', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          OutcomeRowFixture({
            start: START,
            end: END,
            outcome: 'filtered',
            count: 10,
          }),
        ]}
      />
    );

    expect(screen.getByText('Inbound Filters')).toBeInTheDocument();
  });

  it('shows a separate row for each unknown outcome', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          OutcomeRowFixture({
            start: START,
            end: END,
            outcome: 'something_new',
            count: 10,
          }),
          OutcomeRowFixture({
            start: START,
            end: END,
            outcome: 'something_else',
            count: 20,
          }),
        ]}
      />
    );

    expect(screen.getByText('something_new')).toBeInTheDocument();
    expect(screen.getByText('something_else')).toBeInTheDocument();
  });
});
