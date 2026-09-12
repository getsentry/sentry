import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {DataFidelityAnnotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {
  DroppedDataTooltip,
  type DroppedDataTooltipData,
  getDroppedDataTooltipData,
} from 'sentry/views/explore/components/chart/droppedDataBand/droppedDataTooltip';
import type {Bucket} from 'sentry/views/explore/components/chart/droppedDataBand/utils';

const RANGE = 'Jul 7 2:00 AM — Jul 8 2:00 AM (UTC)';
const GIB = 1024 ** 3;

function makeData(
  overrides: Partial<DroppedDataTooltipData> = {}
): DroppedDataTooltipData {
  return {categoryLabel: 'Spans', droppedCount: 40, ...overrides};
}

describe('DroppedDataTooltip', () => {
  it('shows a raw dropped count when accepted volume is unavailable', () => {
    render(<DroppedDataTooltip data={makeData()} range={RANGE} />);

    expect(screen.getByText('Total Dropped')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.queryByText(/Rejected/)).not.toBeInTheDocument();
    expect(screen.getByText(RANGE)).toBeInTheDocument();
    expect(screen.getByText('Click for Details')).toBeInTheDocument();
  });

  it('shows a percentage and count ratio when accepted count is present', () => {
    render(<DroppedDataTooltip data={makeData({acceptedCount: 200})} range={RANGE} />);
    // 40 / (40 + 200) = 17%.
    expect(screen.getByText('17%')).toBeInTheDocument();
    expect(screen.getByText('Spans Rejected')).toBeInTheDocument();
    expect(screen.getByText('40/240')).toBeInTheDocument();
  });

  it('shows the payloads row when byte totals are present', () => {
    render(
      <DroppedDataTooltip
        data={makeData({droppedBytes: 26 * GIB, acceptedBytes: 224 * GIB})}
        range={RANGE}
      />
    );

    expect(screen.getByText('Payloads Rejected')).toBeInTheDocument();
    expect(screen.getByText('26.0 GiB/250.0 GiB')).toBeInTheDocument();
  });

  it('does not render reason breakdowns', () => {
    render(<DroppedDataTooltip data={makeData()} range={RANGE} />);

    expect(screen.queryByText('Quota exceeded')).not.toBeInTheDocument();
  });
});

describe('getDroppedDataTooltipData', () => {
  function makeBucket(category: string): Bucket {
    const annotation: DataFidelityAnnotation = {
      category,
      droppedCount: 40,
      start: 0,
      end: 1000,
      label: 'Quota exceeded',
      reason: 'over_quota',
      type: 'system',
    };
    return {annotations: [annotation], start: 0, end: 1000, severity: 4, total: 40};
  }

  it('maps known categories to friendly labels', () => {
    expect(getDroppedDataTooltipData(makeBucket('span')).categoryLabel).toBe('Spans');
    expect(getDroppedDataTooltipData(makeBucket('log_item')).categoryLabel).toBe('Logs');
    expect(getDroppedDataTooltipData(makeBucket('trace_metric')).categoryLabel).toBe(
      'Metrics'
    );
  });

  it('falls back to the raw category for unknown categories', () => {
    expect(getDroppedDataTooltipData(makeBucket('unknown_thing')).categoryLabel).toBe(
      'unknown_thing'
    );
  });

  it('uses the bucket total as the dropped count and omits fields the API does not send yet', () => {
    const data = getDroppedDataTooltipData(makeBucket('span'));

    expect(data.droppedCount).toBe(40);
    expect(data.acceptedCount).toBeUndefined();
    expect(data.droppedBytes).toBeUndefined();
    expect(data.acceptedBytes).toBeUndefined();
  });
});
