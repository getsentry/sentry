import {render, screen} from 'sentry-test/reactTestingLibrary';

import {getFormat} from 'sentry/utils/dates';

import {generateTestStats, testStatusLabel, testStatusStyle} from './utils/testUtils';
import {CheckInTimeline} from './checkInTimeline';
import type {CheckInBucket, TimeWindowConfig} from './types';

const startTs = new Date('2023-06-15T11:00:00Z').valueOf() / 1000;
type TestStatus = 'error' | 'missed' | 'ok';

const timeWindowConfig: TimeWindowConfig = {
  start: new Date('2023-06-15T11:00:00Z'),
  periodStart: new Date('2023-06-15T11:00:00Z'),
  end: new Date('2023-06-15T12:00:00Z'),
  dateLabelFormat: getFormat({timeOnly: true, seconds: true}),
  elapsedMinutes: 60,
  intervals: {
    normalMarkerInterval: 10,
    referenceMarkerInterval: 20,
    minimumMarkerInterval: 5,
  },
  timelineWidth: 100,
  timezone: 'UTC',
  dateTimeProps: {timeOnly: true},
  rollupConfig: {
    bucketPixels: 10,
    interval: 60,
    timelineUnderscanWidth: 0,
    totalBuckets: 10,
    underscanBuckets: 0,
    underscanStartOffset: 0,
  },
};

describe('CheckInTimeline', () => {
  it('renders proportional stacked status segments by bucket', () => {
    const bucketedData: Array<CheckInBucket<TestStatus>> = [
      [startTs, generateTestStats([0, 8, 2, 0, 0])],
      [startTs + 60, generateTestStats([0, 0, 0, 0, 0])],
      [startTs + 120, generateTestStats([0, 2, 0, 0, 1])],
    ];

    render(
      <CheckInTimeline<TestStatus>
        bucketedData={bucketedData}
        displayMode="stacked"
        stackedStatusOrder={['ok', 'missed', 'error']}
        statusLabel={testStatusLabel}
        statusStyle={testStatusStyle}
        statusPrecedent={['error', 'missed', 'ok']}
        timeWindowConfig={timeWindowConfig}
      />
    );

    const ticks = screen.getAllByTestId('monitor-checkin-tick');
    expect(ticks).toHaveLength(2);
    expect(ticks[0]).toHaveStyle({left: '0px', width: '10px'});
    expect(ticks[1]).toHaveStyle({left: '20px', width: '10px'});

    const segments = screen.getAllByTestId('monitor-checkin-tick-segment');
    expect(segments).toHaveLength(4);
    expect(segments[0]).toHaveStyle({height: '80%'});
    expect(segments[1]).toHaveStyle({height: '20%'});
    expect(segments[2]).toHaveStyle({height: '66.66666666666666%'});
    expect(segments[3]).toHaveStyle({height: '33.33333333333333%'});
  });
});
