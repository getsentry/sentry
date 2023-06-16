import {render, screen} from 'sentry-test/reactTestingLibrary';

import {JobTickTooltip} from 'sentry/views/monitors/components/overviewTimeline/jobTickTooltip';

type StatusCounts = [ok: number, missed: number, timeout: number, error: number];

export function generateEnvMapping(name: string, counts: StatusCounts) {
  const [ok, missed, timeout, error] = counts;
  return {
    [name]: {ok, timeout, error, missed},
  };
}

describe('JobTickTooltip', function () {
  it('renders tooltip representing single job run', function () {
    const startTs = new Date('2023-06-15T11:00:00Z').valueOf();
    const endTs = startTs;
    const envMapping = generateEnvMapping('prod', [0, 1, 0, 0]);
    const jobTick = {
      startTs,
      envMapping,
      roundedLeft: false,
      roundedRight: false,
      endTs,
      width: 4,
    };

    render(<JobTickTooltip jobTick={jobTick} timeWindow="1h" />);

    expect(screen.getByText('Missed')).toBeInTheDocument();
    expect(screen.getByText('prod')).toBeInTheDocument();

    expect(screen.getByText('1')).toBeInTheDocument();
    // Ensure we don't display "startTs - endTs"
    expect(screen.queryByText('-')).not.toBeInTheDocument();
  });

  it('renders tooltip representing multiple job runs 1 env', function () {
    const startTs = new Date('2023-06-15T11:00:00Z').valueOf();
    const endTs = startTs;
    const envMapping = generateEnvMapping('prod', [1, 1, 1, 1]);
    const jobTick = {
      startTs,
      envMapping,
      roundedLeft: false,
      roundedRight: false,
      endTs,
      width: 4,
    };

    render(<JobTickTooltip jobTick={jobTick} timeWindow="1h" />);

    expect(screen.getByText('Okay')).toBeInTheDocument();
    expect(screen.getByText('Missed')).toBeInTheDocument();
    expect(screen.getByText('Timed Out')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();

    expect(screen.getAllByText('prod')).toHaveLength(4);

    expect(screen.getAllByText('1')).toHaveLength(4);
    // Ensure we display "startTs - endTs"
    expect(screen.queryByText('-')).toBeInTheDocument();
  });

  it('renders tooltip representing multiple job runs multiple envs', function () {
    const startTs = new Date('2023-06-15T11:00:00Z').valueOf();
    const endTs = startTs;
    const prodEnvMapping = generateEnvMapping('prod', [0, 1, 0, 2]);
    const devEnvMapping = generateEnvMapping('dev', [1, 2, 1, 0]);
    const envMapping = {...prodEnvMapping, ...devEnvMapping};
    const jobTick = {
      startTs,
      envMapping,
      roundedLeft: false,
      roundedRight: false,
      endTs,
      width: 4,
    };

    render(<JobTickTooltip jobTick={jobTick} timeWindow="1h" />);

    expect(screen.getByText('Okay')).toBeInTheDocument();
    expect(screen.getAllByText('Missed')).toHaveLength(2);
    expect(screen.getByText('Timed Out')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();

    expect(screen.getAllByText('prod')).toHaveLength(2);
    expect(screen.getAllByText('dev')).toHaveLength(3);

    expect(screen.getAllByText('1')).toHaveLength(3);
    expect(screen.getAllByText('2')).toHaveLength(2);
    // Ensure we display "startTs - endTs"
    expect(screen.queryByText('-')).toBeInTheDocument();
  });
});
