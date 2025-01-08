import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {getFormat} from 'sentry/utils/dates';

import {generateTestStats, testStatusLabel, testStatusStyle} from './utils/testUtils';
import {CheckInTooltip} from './checkInTooltip';
import type {TimeWindowConfig} from './types';

const tickConfig: TimeWindowConfig = {
  start: new Date('2023-06-15T11:00:00Z'),
  end: new Date('2023-06-15T12:00:00Z'),
  dateLabelFormat: getFormat({timeOnly: true, seconds: true}),
  elapsedMinutes: 60,
  intervals: {
    normalMarkerInterval: 10,
    referenceMarkerInterval: 20,
    minimumMarkerInterval: 5,
  },
  timelineWidth: 1000,
  dateTimeProps: {timeOnly: true},
};

describe('CheckInTooltip', function () {
  it('renders tooltip representing single job run', async function () {
    const startTs = new Date('2023-06-15T11:00:00Z').valueOf();
    const endTs = startTs;
    const stats = generateTestStats([0, 0, 1, 0, 0]);
    const jobTick = {
      startTs,
      stats,
      roundedLeft: false,
      roundedRight: false,
      endTs,
      width: 4,
    };

    render(
      <CheckInTooltip
        jobTick={jobTick}
        timeWindowConfig={tickConfig}
        statusLabel={testStatusLabel}
        statusStyle={testStatusStyle}
        forceVisible
      />
    );

    // Skip the header row
    const statusRow = (await screen.findAllByRole('row'))[1]!;

    expect(within(statusRow).getByText('Missed')).toBeInTheDocument();
    expect(within(statusRow).getByText('1')).toBeInTheDocument();
  });

  it('renders tooltip representing multiple job runs 1 env', async function () {
    const startTs = new Date('2023-06-15T11:00:00Z').valueOf();
    const endTs = startTs;
    const stats = generateTestStats([0, 1, 1, 1, 1]);
    const jobTick = {
      startTs,
      stats,
      roundedLeft: false,
      roundedRight: false,
      endTs,
      width: 4,
    };

    render(
      <CheckInTooltip
        jobTick={jobTick}
        timeWindowConfig={tickConfig}
        statusLabel={testStatusLabel}
        statusStyle={testStatusStyle}
        forceVisible
      />
    );

    const okayRow = (await screen.findAllByRole('row'))[1]!;
    expect(within(okayRow).getByText('Okay')).toBeInTheDocument();
    expect(within(okayRow).getByText('1')).toBeInTheDocument();

    const missedRow = screen.getAllByRole('row')[2]!;
    expect(within(missedRow).getByText('Missed')).toBeInTheDocument();
    expect(within(missedRow).getByText('1')).toBeInTheDocument();

    const timeoutRow = screen.getAllByRole('row')[3]!;
    expect(within(timeoutRow).getByText('Timed Out')).toBeInTheDocument();
    expect(within(timeoutRow).getByText('1')).toBeInTheDocument();

    const errorRow = screen.getAllByRole('row')[4]!;
    expect(within(errorRow).getByText('Failed')).toBeInTheDocument();
    expect(within(errorRow).getByText('1')).toBeInTheDocument();
  });
});
