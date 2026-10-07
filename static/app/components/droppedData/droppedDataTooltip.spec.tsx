import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DroppedDataTooltip} from 'sentry/components/droppedData/droppedDataTooltip';
import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';
import {groupIntoBuckets} from 'sentry/components/droppedData/utils';

const START = Date.UTC(2024, 0, 12, 15, 0);
const END = Date.UTC(2024, 0, 12, 15, 5);

function ExampleDroppedDataTooltip({
  dropped,
  accepted = [],
}: {
  dropped: DroppedEventsBucket[];
  accepted?: DroppedEventsBucket[];
}) {
  const [bucket] = groupIntoBuckets(dropped, accepted);

  return <DroppedDataTooltip bucket={bucket!} timezone="UTC" />;
}

describe('DroppedDataTooltip', () => {
  it('shows the drop ratio, a row per outcome, and the time range', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          DroppedEventFixture({
            start: START,
            end: END,
            outcome: 'rate_limited',
            count: 40_000,
          }),
          DroppedEventFixture({
            start: START,
            end: END,
            outcome: 'invalid',
            count: 20_000,
          }),
        ]}
        accepted={[
          DroppedEventFixture({
            start: START,
            end: END,
            outcome: 'accepted',
            count: 180_000,
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
        dropped={[DroppedEventFixture({start: START, end: END, count: 1})]}
        accepted={[DroppedEventFixture({start: START, end: END, count: 9_999})]}
      />
    );

    expect(screen.getByText('<0.01%')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('reads a drop with no accepted volume as the whole bucket', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[DroppedEventFixture({start: START, end: END, count: 10})]}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('/10')).toBeInTheDocument();
  });

  it('labels an unintentional client discard as an SDK drop', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          DroppedEventFixture({
            start: START,
            end: END,
            outcome: 'client_discard',
            reason: 'queue_overflow',
            count: 10,
          }),
        ]}
      />
    );

    expect(screen.getByText('SDK Data Dropped')).toBeInTheDocument();
  });

  it('falls back to a generic label for an unknown outcome', () => {
    render(
      <ExampleDroppedDataTooltip
        dropped={[
          DroppedEventFixture({
            start: START,
            end: END,
            outcome: 'something_new',
            count: 10,
          }),
        ]}
      />
    );

    expect(screen.getByText('Other Rejected')).toBeInTheDocument();
  });
});
