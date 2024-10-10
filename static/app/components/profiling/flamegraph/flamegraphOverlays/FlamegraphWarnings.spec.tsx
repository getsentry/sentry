import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FlamegraphWarnings} from 'sentry/components/profiling/flamegraph/flamegraphOverlays/FlamegraphWarnings';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

const trace: Profiling.SampledProfile = {
  name: 'profile',
  startValue: 0,
  endValue: 1000,
  unit: 'milliseconds',
  threadID: 0,
  type: 'sampled',
  weights: [],
  samples: [],
};

const emptyProfile = SampledProfile.FromProfile(
  trace,
  createFrameIndex('mobile', [{name: 'function'}]),
  {
    type: 'flamegraph',
  }
);

const emptyFlamegraph = new Flamegraph(emptyProfile, {
  inverted: false,
  sort: 'left heavy',
});

const traceWithSamples: Profiling.SampledProfile = {
  name: 'profile',
  startValue: 0,
  endValue: 1000,
  unit: 'milliseconds',
  threadID: 0,
  type: 'sampled',
  weights: [10, 20],
  samples: [[0], [0]],
};

const profileWithSamples = SampledProfile.FromProfile(
  traceWithSamples,
  createFrameIndex('mobile', [{name: 'application function'}]),
  {
    type: 'flamegraph',
  }
);

const flamegraph = new Flamegraph(profileWithSamples, {
  inverted: false,
  sort: 'left heavy',
});

describe('FlamegraphWarnings', () => {
  it('renders nothing while loading', () => {
    render(
      <FlamegraphWarnings flamegraph={emptyFlamegraph} requestState={{type: 'loading'}} />
    );
    expect(screen.queryByTestId('flamegraph-warning-overlay')).not.toBeInTheDocument();
  });

  it('renders error', () => {
    render(
      <FlamegraphWarnings
        flamegraph={emptyFlamegraph}
        requestState={{type: 'errored', error: 'Failed to fetch profile'}}
      />
    );
    expect(screen.getByText('Failed to fetch profile')).toBeInTheDocument();
  });
  it('render empty flamegraph when filter is passed', () => {
    render(
      <FlamegraphWarnings
        flamegraph={emptyFlamegraph}
        requestState={{type: 'resolved', data: emptyFlamegraph}}
        filter="all"
      />
    );
    expect(screen.getByText('This flamegraph has no data.')).toBeInTheDocument();
  });

  it('render flamegraph filter warning when filtering results in no frames', () => {
    render(
      <FlamegraphWarnings
        flamegraph={flamegraph}
        requestState={{type: 'resolved', data: flamegraph}}
        filter={'application'}
      />
    );

    expect(
      screen.getByText(/No frames match the application frame filter/gm)
    ).toBeInTheDocument();
  });

  it('render flamegraph with filter reset button when filtering results in no frames', async () => {
    const onResetFilter = jest.fn();
    render(
      <FlamegraphWarnings
        flamegraph={flamegraph}
        requestState={{type: 'resolved', data: flamegraph}}
        filter={'application'}
        onResetFilter={onResetFilter}
      />
    );

    await userEvent.click(screen.getByText('Reset Filter'));
    expect(onResetFilter).toHaveBeenCalled();
  });
});
