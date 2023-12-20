import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {getFormat} from 'sentry/utils/dates';
import {JobTickTooltip} from 'sentry/views/monitors/components/overviewTimeline/jobTickTooltip';
import {TimeWindowOptions} from 'sentry/views/monitors/components/overviewTimeline/types';

type StatusCounts = [
  in_progress: number,
  ok: number,
  missed: number,
  timeout: number,
  error: number,
];

export function generateEnvMapping(name: string, counts: StatusCounts) {
  const [in_progress, ok, missed, timeout, error] = counts;
  return {
    [name]: {in_progress, ok, missed, timeout, error},
  };
}

const tickConfig: TimeWindowOptions = {
  dateLabelFormat: getFormat({timeOnly: true, seconds: true}),
  elapsedMinutes: 60,
  timeMarkerInterval: 10,
  dateTimeProps: {timeOnly: true},
};

describe('JobTickTooltip', function () {
  it('renders tooltip representing single job run', function () {
    const startTs = new Date('2023-06-15T11:00:00Z').valueOf();
    const endTs = startTs;
    const envMapping = generateEnvMapping('prod', [0, 0, 1, 0, 0]);
    const jobTick = {
      startTs,
      envMapping,
      roundedLeft: false,
      roundedRight: false,
      endTs,
      width: 4,
    };

    render(
      <JobTickTooltip jobTick={jobTick} timeWindowConfig={tickConfig} forceVisible />
    );

    // Skip the header row
    const statusRow = screen.getAllByRole('row')[1];

    expect(within(statusRow).getByText('Missed')).toBeInTheDocument();
    expect(within(statusRow).getByText('prod')).toBeInTheDocument();
    expect(within(statusRow).getByText('1')).toBeInTheDocument();
  });

  it('renders tooltip representing multiple job runs 1 env', function () {
    const startTs = new Date('2023-06-15T11:00:00Z').valueOf();
    const endTs = startTs;
    const envMapping = generateEnvMapping('prod', [0, 1, 1, 1, 1]);
    const jobTick = {
      startTs,
      envMapping,
      roundedLeft: false,
      roundedRight: false,
      endTs,
      width: 4,
    };

    render(
      <JobTickTooltip jobTick={jobTick} timeWindowConfig={tickConfig} forceVisible />
    );

    const okayRow = screen.getAllByRole('row')[1];
    expect(within(okayRow).getByText('Okay')).toBeInTheDocument();
    expect(within(okayRow).getByText('prod')).toBeInTheDocument();
    expect(within(okayRow).getByText('1')).toBeInTheDocument();

    const missedRow = screen.getAllByRole('row')[2];
    expect(within(missedRow).getByText('Missed')).toBeInTheDocument();
    expect(within(missedRow).getByText('prod')).toBeInTheDocument();
    expect(within(missedRow).getByText('1')).toBeInTheDocument();

    const timeoutRow = screen.getAllByRole('row')[3];
    expect(within(timeoutRow).getByText('Timed Out')).toBeInTheDocument();
    expect(within(timeoutRow).getByText('prod')).toBeInTheDocument();
    expect(within(timeoutRow).getByText('1')).toBeInTheDocument();

    const errorRow = screen.getAllByRole('row')[4];
    expect(within(errorRow).getByText('Failed')).toBeInTheDocument();
    expect(within(errorRow).getByText('prod')).toBeInTheDocument();
    expect(within(errorRow).getByText('1')).toBeInTheDocument();
  });

  it('renders tooltip representing multiple job runs multiple envs', function () {
    const startTs = new Date('2023-06-15T11:00:00Z').valueOf();
    const endTs = startTs;
    const prodEnvMapping = generateEnvMapping('prod', [0, 0, 1, 0, 0]);
    const devEnvMapping = generateEnvMapping('dev', [0, 1, 2, 1, 0]);
    const envMapping = {...prodEnvMapping, ...devEnvMapping};
    const jobTick = {
      startTs,
      envMapping,
      roundedLeft: false,
      roundedRight: false,
      endTs,
      width: 4,
    };

    render(
      <JobTickTooltip jobTick={jobTick} timeWindowConfig={tickConfig} forceVisible />
    );

    const missedProdRow = screen.getAllByRole('row')[1];
    expect(within(missedProdRow).getByText('Missed')).toBeInTheDocument();
    expect(within(missedProdRow).getByText('prod')).toBeInTheDocument();
    expect(within(missedProdRow).getByText('1')).toBeInTheDocument();

    const okDevRow = screen.getAllByRole('row')[2];
    expect(within(okDevRow).getByText('Okay')).toBeInTheDocument();
    expect(within(okDevRow).getByText('dev')).toBeInTheDocument();
    expect(within(okDevRow).getByText('1')).toBeInTheDocument();

    const missedDevRow = screen.getAllByRole('row')[3];
    expect(within(missedDevRow).getByText('Missed')).toBeInTheDocument();
    expect(within(missedDevRow).getByText('dev')).toBeInTheDocument();
    expect(within(missedDevRow).getByText('2')).toBeInTheDocument();

    const timeoutDevRow = screen.getAllByRole('row')[4];
    expect(within(timeoutDevRow).getByText('Timed Out')).toBeInTheDocument();
    expect(within(timeoutDevRow).getByText('dev')).toBeInTheDocument();
    expect(within(timeoutDevRow).getByText('1')).toBeInTheDocument();
  });
});
