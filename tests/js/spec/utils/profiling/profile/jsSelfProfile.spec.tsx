import {JSSelfProfile} from 'sentry/utils/profiling/profile/jsSelfProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

import {firstCallee, makeTestingBoilerplate, nthCallee} from './profile.spec';

describe('jsSelfProfile', () => {
  it('imports the base properties', () => {
    const trace: JSSelfProfiling.Trace = {
      resources: ['app.js', 'vendor.js'],
      frames: [{name: 'ReactDOM.render', line: 1, column: 1, resourceId: 0}],
      samples: [
        {
          timestamp: 0,
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
      createFrameIndex(trace.frames, trace)
    );

    expect(profile.duration).toBe(1000);
    expect(profile.startedAt).toBe(0);
    expect(profile.endedAt).toBe(1000);
    expect(profile.appendOrderTree.children[0].frame.name).toBe('ReactDOM.render');
    expect(profile.appendOrderTree.children[0].frame.resource).toBe('app.js');
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
      createFrameIndex(trace.frames, trace)
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

    const root = firstCallee(profile.appendOrderTree);

    expect(root.totalWeight).toEqual(1000);
    expect(root.selfWeight).toEqual(0);

    expect(nthCallee(root, 0).selfWeight).toEqual(0);
    expect(nthCallee(root, 0).totalWeight).toEqual(0);

    expect(nthCallee(root, 1).selfWeight).toEqual(1000);
    expect(nthCallee(root, 1).totalWeight).toEqual(1000);
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
      createFrameIndex(trace.frames, trace)
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

    const root = firstCallee(profile.appendOrderTree);

    expect(root.totalWeight).toEqual(1000);
    expect(firstCallee(root).totalWeight).toEqual(1000);

    expect(root.selfWeight).toEqual(0);
    expect(firstCallee(root).selfWeight).toEqual(1000);
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
      createFrameIndex(trace.frames, trace)
    );

    expect(firstCallee(firstCallee(profile.appendOrderTree)).isRecursive()).toBe(true);
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
      createFrameIndex(trace.frames, trace)
    );

    expect(
      firstCallee(firstCallee(firstCallee(profile.appendOrderTree))).isRecursive()
    ).toBe(true);
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
      createFrameIndex(trace.frames, trace)
    );

    expect(profile.minFrameDuration).toBe(10);
  });
});
