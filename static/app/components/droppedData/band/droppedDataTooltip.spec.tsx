import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {groupIntoBuckets} from 'sentry/components/droppedData/buckets';
import type {OutcomeRow} from 'sentry/components/droppedData/types';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {DroppedDataTooltipSection} from './droppedDataTooltip';

const START = Date.UTC(2024, 0, 12, 15, 0);
const END = Date.UTC(2024, 0, 12, 15, 5);

function ExampleDroppedDataTooltipSection({
  dropped,
  accepted = [],
  dataset = DiscoverDatasets.SPANS,
}: {
  dropped: OutcomeRow[];
  accepted?: OutcomeRow[];
  dataset?: DiscoverDatasets;
}) {
  const [bucket] = groupIntoBuckets(dropped, accepted);

  return <DroppedDataTooltipSection bucket={bucket!} dataset={dataset} />;
}

describe('DroppedDataTooltipSection', () => {
  it('shows the drop ratio and a row per outcome', () => {
    render(
      <ExampleDroppedDataTooltipSection
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
  });

  it('names the telemetry type in the header', () => {
    render(
      <ExampleDroppedDataTooltipSection
        dataset={DiscoverDatasets.OURLOGS}
        dropped={[OutcomeRowFixture({start: START, end: END, count: 10})]}
      />
    );

    expect(screen.getByText('Dropped Logs')).toBeInTheDocument();
  });

  it('shows <0.01% for a drop ratio at or below 0.01%', () => {
    render(
      <ExampleDroppedDataTooltipSection
        dropped={[OutcomeRowFixture({start: START, end: END, count: 1})]}
        accepted={[OutcomeRowFixture({start: START, end: END, count: 9_999})]}
      />
    );

    expect(screen.getByText('<0.01%')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('reads a drop with no accepted volume as the whole bucket', () => {
    render(
      <ExampleDroppedDataTooltipSection
        dropped={[OutcomeRowFixture({start: START, end: END, count: 10})]}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('/10')).toBeInTheDocument();
  });

  it('shows 0% for a bucket without drops', () => {
    render(
      <ExampleDroppedDataTooltipSection
        dropped={[]}
        accepted={[
          OutcomeRowFixture({start: START, end: END, outcome: 'accepted', count: 500}),
        ]}
      />
    );

    expect(screen.getByText('Dropped Spans')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('labels an unintentional client discard as a client discard', () => {
    render(
      <ExampleDroppedDataTooltipSection
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
      <ExampleDroppedDataTooltipSection
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
      <ExampleDroppedDataTooltipSection
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
      <ExampleDroppedDataTooltipSection
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
