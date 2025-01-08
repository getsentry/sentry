import {JSSelfProfile} from 'sentry/utils/profiling/profile/jsSelfProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

import {firstCallee, makeTestingBoilerplate, nthCallee} from './testUtils';

describe('jsSelfProfile', () => {
  it('imports the base properties', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js', 'vendor.js'],
      frames: [{name: 'ReactDOM.render', line: 1, column: 1, resourceId: 0}],
      samples: [
        {
          timestamp: 0,
          stackId: 0,
        },
        {
          timestamp: 1000,
          stackId: 0,
        },
      ],
      stacks: [
        {
          frameId: 0,
        },
      ],
    };

    const profile = JSSelfProfile.FromProfile(
      trace,
      createFrameIndex('javascript', trace.frames, trace),
      {type: 'flamechart'}
    );

    expect(profile.duration).toBe(1000);
    expect(profile.startedAt).toBe(0);
    expect(profile.endedAt).toBe(1000);
    expect(profile.callTree.children[0]!.frame.name).toBe('ReactDOM.render');
    expect(profile.callTree.children[0]!.frame.resource).toBe('app.js');
  });

  it('tracks discarded samples', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js', 'vendor.js'],
      frames: [{name: 'ReactDOM.render', line: 1, column: 1, resourceId: 0}],
      samples: [
        {
          timestamp: 0,
          stackId: 0,
        },
      ],
      stacks: [
        {
          frameId: 0,
        },
      ],
    };

    const profile = JSSelfProfile.FromProfile(
      trace,
      createFrameIndex('javascript', [{name: 'f0'}]),
      {type: 'flamechart'}
    );
    expect(profile.stats.discardedSamplesCount).toBe(1);
  });

  it('tracks negative samples', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js', 'vendor.js'],
      frames: [{name: 'ReactDOM.render', line: 1, column: 1, resourceId: 0}],
      samples: [
        {
          timestamp: 0,
          stackId: 0,
        },
        {
          timestamp: -1,
          stackId: 0,
        },
      ],
      stacks: [
        {
          frameId: 0,
        },
      ],
    };

    const profile = JSSelfProfile.FromProfile(
      trace,
      createFrameIndex('javascript', [{name: 'f0'}]),
      {type: 'flamechart'}
    );
    expect(profile.stats.negativeSamplesCount).toBe(1);
  });

  it('tracks raw weights', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js', 'vendor.js'],
      frames: [{name: 'ReactDOM.render', line: 1, column: 1, resourceId: 0}],
      samples: [
        {
          timestamp: 5,
          stackId: 0,
        },
        {
          timestamp: 10,
          stackId: 0,
        },
        {
          timestamp: 15,
          stackId: 0,
        },
      ],
      stacks: [
        {
          frameId: 0,
        },
      ],
    };

    const profile = JSSelfProfile.FromProfile(
      trace,
      createFrameIndex('javascript', [{name: 'f0'}]),
      {type: 'flamechart'}
    );
    // For JsSelfProfile, first sample is appended with 0 weight because it
    // contains the stack sample of when startProfile was called
    expect(profile.rawWeights).toHaveLength(2);
  });

  it('handles the first stack sample differently', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js'],
      frames: [
        {name: 'main', line: 1, column: 1, resourceId: 0},
        {name: 'new Profiler', line: 1, column: 1, resourceId: 0},
        {name: 'afterProfiler.init', line: 1, column: 1, resourceId: 0},
      ],
      samples: [
        {
          stackId: 1,
          timestamp: 500,
        },
        {
          stackId: 2,
          timestamp: 1500,
        },
      ],
      stacks: [
        {frameId: 0, parentId: undefined},
        {frameId: 1, parentId: 0},
        {frameId: 2, parentId: 0},
      ],
    };

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();

    const profile = JSSelfProfile.FromProfile(
      trace,
      createFrameIndex('javascript', trace.frames, trace),
      {type: 'flamechart'}
    );

    profile.forEach(open, close);

    expect(timings).toEqual([
      ['main', 'open'],
      ['new Profiler', 'open'],
      ['new Profiler', 'close'],
      ['afterProfiler.init', 'open'],
      ['afterProfiler.init', 'close'],
      ['main', 'close'],
    ]);
    expect(openSpy).toHaveBeenCalledTimes(3);
    expect(closeSpy).toHaveBeenCalledTimes(3);

    const root = firstCallee(profile.callTree);

    if (!root) {
      throw new Error('root is null');
    }

    expect(root.totalWeight).toBe(1000);
    expect(root.selfWeight).toBe(0);

    expect(nthCallee(root, 0).selfWeight).toBe(0);
    expect(nthCallee(root, 0).totalWeight).toBe(0);

    expect(nthCallee(root, 1).selfWeight).toBe(1000);
    expect(nthCallee(root, 1).totalWeight).toBe(1000);
  });

  it('rebuilds the stack', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js'],
      frames: [
        {name: 'f0', line: 1, column: 1, resourceId: 0},
        {name: 'f1', line: 1, column: 1, resourceId: 0},
      ],
      samples: [
        {
          stackId: 0,
          timestamp: 0,
        },
        {
          timestamp: 1000,
          stackId: 0,
        },
      ],
      stacks: [{frameId: 1, parentId: 1}, {frameId: 0}],
    };

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();

    const profile = JSSelfProfile.FromProfile(
      trace,
      createFrameIndex('javascript', trace.frames, trace),
      {type: 'flamechart'}
    );

    profile.forEach(open, close);

    expect(timings).toEqual([
      ['f0', 'open'],
      ['f1', 'open'],
      ['f1', 'close'],
      ['f0', 'close'],
    ]);
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(closeSpy).toHaveBeenCalledTimes(2);

    const root = firstCallee(profile.callTree)!;

    expect(root.totalWeight).toBe(1000);
    expect(firstCallee(root)!.totalWeight).toBe(1000);

    expect(root.selfWeight).toBe(0);
    expect(firstCallee(root)!.selfWeight).toBe(1000);
  });

  it('marks direct recursion', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js'],
      frames: [{name: 'f0', line: 1, column: 1, resourceId: 0}],
      samples: [
        {
          stackId: 0,
          timestamp: 0,
        },
        {
          stackId: 0,
          timestamp: 0,
        },
      ],
      stacks: [{frameId: 0, parentId: 1}, {frameId: 0}],
    };

    const profile = JSSelfProfile.FromProfile(
      trace,
      createFrameIndex('javascript', trace.frames, trace),
      {type: 'flamechart'}
    );

    expect(!!firstCallee(firstCallee(profile.callTree)!)!.recursive).toBe(true);
  });

  it('marks indirect recursion', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js'],
      frames: [
        {name: 'f0', line: 1, column: 1, resourceId: 0},
        {name: 'f1', line: 1, column: 1, resourceId: 0},
      ],
      samples: [
        {
          stackId: 0,
          timestamp: 0,
        },
        {
          stackId: 2,
          timestamp: 100,
        },
      ],
      stacks: [
        {frameId: 0, parentId: undefined},
        {frameId: 1, parentId: 0},
        {frameId: 0, parentId: 1},
      ],
    };

    const profile = JSSelfProfile.FromProfile(
      trace,
      createFrameIndex('javascript', trace.frames, trace),
      {type: 'flamechart'}
    );

    expect(!!firstCallee(firstCallee(firstCallee(profile.callTree)!)!)!.recursive).toBe(
      true
    );
  });

  it('tracks minFrameDuration', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js'],
      frames: [
        {name: 'f0', line: 1, column: 1, resourceId: 0},
        {name: 'f1', line: 1, column: 1, resourceId: 0},
        {name: 'f2', line: 1, column: 1, resourceId: 0},
      ],
      samples: [
        {
          stackId: 0,
          timestamp: 0,
        },
        {
          stackId: 2,
          timestamp: 10,
        },
        {
          stackId: 3,
          timestamp: 100,
        },
      ],
      stacks: [
        {frameId: 0, parentId: undefined},
        {frameId: 1, parentId: 0},
        {frameId: 0, parentId: 1},
        {frameId: 2},
      ],
    };

    const profile = JSSelfProfile.FromProfile(
      trace,
      createFrameIndex('javascript', trace.frames, trace),
      {type: 'flamechart'}
    );

    expect(profile.minFrameDuration).toBe(10);
  });

  it('appends gc to previous stack', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js'],
      frames: [
        {name: 'f1', line: 1, column: 1, resourceId: 0},
        {name: 'f0', line: 1, column: 1, resourceId: 0},
      ],
      samples: [
        {
          stackId: 0,
          timestamp: 0,
        },
        {
          timestamp: 10,
          marker: 'gc',
          stackId: 0,
        },
      ],
      stacks: [
        {frameId: 0, parentId: 1},
        {frameId: 1, parentId: undefined},
      ],
    };

    const profile = JSSelfProfile.FromProfile(
      trace,
      createFrameIndex('javascript', trace.frames, trace),
      {type: 'flamechart'}
    );

    const {open, close, openSpy, closeSpy, timings} = makeTestingBoilerplate();

    profile.forEach(open, close);

    expect(openSpy).toHaveBeenCalledTimes(3);
    expect(closeSpy).toHaveBeenCalledTimes(3);

    expect(timings).toEqual([
      ['f0', 'open'],
      ['f1', 'open'],
      ['Garbage Collection', 'open'],
      ['Garbage Collection', 'close'],
      ['f1', 'close'],
      ['f0', 'close'],
    ]);
  });

  it('flamegraph tracks node occurrences', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js'],
      frames: [
        {name: 'f1', line: 1, column: 1, resourceId: 0},
        {name: 'f0', line: 1, column: 1, resourceId: 0},
      ],
      samples: [
        {
          stackId: 0,
          timestamp: 0,
        },
        {
          timestamp: 10,
          stackId: 1,
        },
        {
          timestamp: 20,
          stackId: 0,
        },
      ],
      stacks: [
        {frameId: 0, parentId: undefined},
        {frameId: 1, parentId: 0},
      ],
    };
    const profile = JSSelfProfile.FromProfile(
      trace,
      createFrameIndex('javascript', trace.frames, trace),
      {type: 'flamechart'}
    );

    expect(profile.callTree.children[0]!.count).toBe(3);
    expect(profile.callTree.children[0]!.children[0]!.count).toBe(1);
  });
});
