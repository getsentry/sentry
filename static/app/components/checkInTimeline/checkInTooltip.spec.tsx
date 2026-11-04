import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {DateTimeProvider} from '@sentry/scraps/dateTime';

import {getConfigFromTimeRange} from './utils/getConfigFromTimeRange';
import {generateTestStats, testStatusLabel, testStatusStyle} from './utils/testUtils';
import {CheckInTooltip} from './checkInTooltip';
import type {JobTickData, TimeWindowConfig} from './types';

const tickConfig: TimeWindowConfig = {
  start: new Date('2023-06-15T11:00:00Z'),
  periodStart: new Date('2023-06-15T11:00:00Z'),
  end: new Date('2023-06-15T12:00:00Z'),
  dateLabelOptions: {
    mode: 'time',
    precision: 'second',
    showTimezone: false,
    timezone: 'UTC',
  },
  elapsedMinutes: 60,
  intervals: {
    normalMarkerInterval: 10,
    referenceMarkerInterval: 20,
    minimumMarkerInterval: 5,
  },
  timelineWidth: 1000,
  timezone: 'UTC',
  dateTimeProps: {mode: 'time', showTimezone: false, timezone: 'UTC'},
  rollupConfig: {
    bucketPixels: 0,
    interval: 0,
    timelineUnderscanWidth: 0,
    totalBuckets: 0,
    underscanBuckets: 0,
    underscanStartOffset: 0,
  },
};

function getBodyRowCells(table: HTMLElement) {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map(row =>
      within(row)
        .getAllByRole('cell')
        .map(cell => cell.textContent)
    );
}

describe('CheckInTooltip', () => {
  it('uses the schedule timezone when the viewer has selected UTC', async () => {
    const start = new Date('2023-06-15T11:00:00Z');
    const end = new Date('2023-06-15T12:00:00Z');
    const config = getConfigFromTimeRange(start, end, 800, 'America/New_York');
    const jobTick: JobTickData<any> = {
      startTs: start.valueOf() / 1000,
      endTs: start.valueOf() / 1000,
      stats: generateTestStats([0, 0, 1, 0, 0]),
      isStarting: false,
      isEnding: false,
      width: 4,
      left: 0,
    };
    render(
      <DateTimeProvider value={{timezone: 'UTC', clock: '12'}}>
        <CheckInTooltip
          jobTick={jobTick}
          timeWindowConfig={config}
          statusLabel={testStatusLabel}
          statusStyle={testStatusStyle}
          forceVisible
          makeUnit={() => 'some unit'}
        />
      </DateTimeProvider>
    );
    expect(await screen.findByText('7:00:00 AM')).toBeInTheDocument();
  });

  it('renders tooltip representing single job run', async () => {
    const startTs = new Date('2023-06-15T11:00:00Z').valueOf();
    const endTs = startTs;
    const stats = generateTestStats([0, 0, 1, 0, 0]);
    const jobTick: JobTickData<any> = {
      startTs,
      stats,
      isStarting: false,
      isEnding: false,
      endTs,
      width: 4,
      left: 0,
    };

    render(
      <CheckInTooltip
        jobTick={jobTick}
        timeWindowConfig={tickConfig}
        statusLabel={testStatusLabel}
        statusStyle={testStatusStyle}
        forceVisible
        makeUnit={() => 'some unit'}
      />
    );

    const table = await screen.findByRole('table');

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Status', 'Count', 'Unit']);
    expect(getBodyRowCells(table)).toEqual([['Missed', '1', 'some unit']]);
  });

  it('renders tooltip representing multiple job runs 1 env', async () => {
    const startTs = new Date('2023-06-15T11:00:00Z').valueOf();
    const endTs = startTs;
    const stats = generateTestStats([0, 1, 1, 1, 1]);
    const jobTick: JobTickData<any> = {
      startTs,
      stats,
      isStarting: false,
      isEnding: false,
      endTs,
      width: 4,
      left: 0,
    };

    render(
      <CheckInTooltip
        jobTick={jobTick}
        timeWindowConfig={tickConfig}
        statusLabel={testStatusLabel}
        statusStyle={testStatusStyle}
        forceVisible
        makeUnit={() => 'some unit'}
      />
    );

    const table = await screen.findByRole('table');

    expect(getBodyRowCells(table)).toEqual([
      ['Okay', '1', 'some unit'],
      ['Missed', '1', 'some unit'],
      ['Timed Out', '1', 'some unit'],
      ['Failed', '1', 'some unit'],
    ]);
  });
});
