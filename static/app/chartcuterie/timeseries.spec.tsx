import {ThemeFixture} from 'sentry-fixture/theme';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {DisplayType} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {makeTimeseriesCharts} from './timeseries';
import {ChartType} from './types';

const HOUR = 3_600_000;
const START = 1729796400000;

function getOption(data: {
  timeSeries: TimeSeries[];
  showConfidence?: boolean;
  type?: DisplayType;
}) {
  const descriptor = makeTimeseriesCharts(ThemeFixture()).find(
    ({key}) => key === ChartType.SLACK_TIMESERIES
  )!;
  return descriptor.getOption(data);
}

const timeSeries = TimeSeriesFixture({
  yAxis: 'count()',
  meta: {valueType: 'integer', valueUnit: null, interval: HOUR},
  values: [
    {timestamp: START, value: 1, confidence: 'low', sampleRate: 0.1},
    {timestamp: START + HOUR, value: 50, confidence: 'high', sampleRate: 0.1},
    {timestamp: START + 2 * HOUR, value: 60, confidence: 'high', sampleRate: 0.1},
    {timestamp: START + 3 * HOUR, value: 2, confidence: 'low', sampleRate: 0.1},
  ],
});

function getCustomSeries(option: ReturnType<typeof getOption>) {
  return (option.series as Array<{type: string}>).filter(
    series => series.type === 'custom'
  );
}

describe('SLACK_TIMESERIES', () => {
  it('hatches low confidence buckets within the data bounds', () => {
    const option = getOption({timeSeries: [timeSeries], showConfidence: true});

    const [hatchSeries, ...rest] = getCustomSeries(option);
    expect(rest).toHaveLength(0);
    expect(hatchSeries).toMatchObject({
      data: [
        [START, START + HOUR / 2],
        [START + 2.5 * HOUR, START + 3 * HOUR],
      ],
    });
  });

  it('hatches the full slot of edge bars', () => {
    const option = getOption({
      timeSeries: [timeSeries],
      showConfidence: true,
      type: DisplayType.BAR,
    });

    expect(getCustomSeries(option)[0]).toMatchObject({
      data: [
        [START - HOUR / 2, START + HOUR / 2],
        [START + 2.5 * HOUR, START + 3.5 * HOUR],
      ],
    });
  });

  it('keeps the hatching out of the legend', () => {
    const option = getOption({timeSeries: [timeSeries], showConfidence: true});

    expect(option.legend).toMatchObject({data: ['count()']});
  });

  it('does not hatch without showConfidence', () => {
    expect(getCustomSeries(getOption({timeSeries: [timeSeries]}))).toHaveLength(0);
  });

  it('does not hatch when no bucket is low confidence', () => {
    const highConfidence = TimeSeriesFixture({
      values: timeSeries.values.map(item => ({...item, confidence: 'high'})),
    });

    expect(
      getCustomSeries(getOption({timeSeries: [highConfidence], showConfidence: true}))
    ).toHaveLength(0);
  });
});
