import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FlamegraphWarnings} from 'sentry/components/profiling/flamegraph/flamegraphOverlays/FlamegraphWarnings';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

const noDataProfile: Profiling.SampledProfile = {
  name: 'profile',
  startValue: 0,
  endValue: 1000,
  unit: 'milliseconds',
  threadID: 0,
  type: 'sampled',
  weights: [],
  samples: [],
};

const noDataProfileGroup: Profiling.Schema = {
  activeProfileIndex: 0,
  profileID: '',
  profiles: [noDataProfile],
  projectID: 1,
  shared: {
    frames: [],
  },
  metadata: {} as Profiling.Schema['metadata'],
} as Profiling.Schema;

const noDataFlamegraph = new Flamegraph(
  importProfile(noDataProfileGroup, '', null, 'flamegraph').profiles[0]!,
  {inverted: false, sort: 'left heavy'}
);

const onlySystemFramesProfile = {
  ...noDataProfile,
  weights: [10, 10],
  samples: [[0], [0]],
};

const onlySystemFramesProfileGroup: Profiling.Schema = {
  ...noDataProfileGroup,
  profiles: [onlySystemFramesProfile],
  shared: {
    frames: [{name: 'system function', is_application: false}],
  },
  metadata: {} as Profiling.Schema['metadata'],
} as Profiling.Schema;

const onlySystemFramesFlamegraph = new Flamegraph(
  importProfile(onlySystemFramesProfileGroup, '', null, 'flamegraph', f => {
    return f.is_application;
  }).profiles[0]!,
  {inverted: false, sort: 'left heavy'}
);

const flamegraphWithData = new Flamegraph(
  importProfile(onlySystemFramesProfileGroup, '', null, 'flamegraph').profiles[0]!,
  {inverted: false, sort: 'left heavy'}
);

describe('FlamegraphWarnings', () => {
  it('renders nothing while loading', () => {
    render(
      <FlamegraphWarnings
        flamegraph={noDataFlamegraph}
        requestState={{type: 'loading'}}
      />
    );
    expect(screen.queryByTestId('flamegraph-warning-overlay')).not.toBeInTheDocument();
  });
  it('renders error', () => {
    render(
      <FlamegraphWarnings
        flamegraph={noDataFlamegraph}
        requestState={{type: 'errored', error: 'Failed to fetch profile'}}
      />
    );
    expect(screen.getByText('Failed to fetch profile')).toBeInTheDocument();
  });

  it('does not render when flamegraph has data', () => {
    render(
      <FlamegraphWarnings
        flamegraph={flamegraphWithData}
        requestState={{type: 'resolved', data: flamegraphWithData}}
      />
    );
    expect(screen.queryByTestId('flamegraph-warning-overlay')).not.toBeInTheDocument();
  });

  describe('when flamegraph has no data', () => {
    it('render empty flamegraph when filter is passed but flamegraph has no frames', () => {
      render(
        <FlamegraphWarnings
          flamegraph={noDataFlamegraph}
          requestState={{type: 'resolved', data: noDataFlamegraph}}
          filter="all"
        />
      );
      expect(screen.getByText('This flamegraph has no data.')).toBeInTheDocument();
      expect(screen.queryByText('Reset Filter')).not.toBeInTheDocument();
    });

    it('render flamegraph with filter reset button when filtering results in no frames', async () => {
      const onResetFilter = jest.fn();
      render(
        <FlamegraphWarnings
          flamegraph={onlySystemFramesFlamegraph}
          requestState={{type: 'resolved', data: onlySystemFramesFlamegraph}}
          filter={'application'}
          onResetFilter={onResetFilter}
        />
      );

      await userEvent.click(screen.getByText('Reset Filter'));
      expect(onResetFilter).toHaveBeenCalled();
    });
  });
});
