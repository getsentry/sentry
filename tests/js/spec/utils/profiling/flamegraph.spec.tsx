import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

const makeEmptyEventedTrace = (): EventedProfile => {
  return EventedProfile.FromProfile(
    {
      name: 'profile',
      startValue: 0,
      endValue: 0,
      unit: 'microseconds',
      type: 'evented',
      events: [],
    },
    createFrameIndex([])
  );
};

describe('flamegraph', () => {
  it('sets default timeline for empty flamegraph', () => {
    const flamegraph = new Flamegraph(makeEmptyEventedTrace(), 0, {
      inverted: false,
      leftHeavy: false,
    });

    expect(flamegraph.configSpace.equals(new Rect(0, 0, 1_000_000, 0))).toBe(true);
    expect(flamegraph.inverted).toBe(false);
    expect(flamegraph.leftHeavy).toBe(false);
  });

  it('initializes formatter', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 500, frame: 1},
        {type: 'C', at: 600, frame: 1},
        {type: 'C', at: 1000, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(trace, createFrameIndex([{name: 'f0'}, {name: 'f1'}])),
      10,
      {
        inverted: true,
        leftHeavy: true,
      }
    );
    expect(flamegraph.formatter(1000)).toBe('1.00s');
    expect(flamegraph.formatter(500)).toBe('500.00ms');
  });

  it('stores profile properties', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 2, frame: 1},
        {type: 'C', at: 3, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(trace, createFrameIndex([{name: 'f0'}, {name: 'f1'}])),
      10,
      {
        inverted: true,
        leftHeavy: true,
      }
    );

    expect(flamegraph.inverted).toBe(true);
    expect(flamegraph.leftHeavy).toBe(true);

    expect(flamegraph.duration).toBe(1000);
    expect(flamegraph.profileIndex).toBe(10);
    expect(flamegraph.name).toBe('profile');

    expect(flamegraph.startedAt).toBe(0);
    expect(flamegraph.endedAt).toBe(1000);
  });

  it('creates a call order graph', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'O', at: 2, frame: 2},
        {type: 'C', at: 3, frame: 2},
        {type: 'C', at: 4, frame: 1},
        {type: 'C', at: 5, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(
        trace,
        createFrameIndex([{name: 'f0'}, {name: 'f1'}, {name: 'f2'}])
      ),
      10,
      {
        inverted: false,
        leftHeavy: false,
      }
    );

    const order = ['f0', 'f1', 'f2'];
    for (let i = 0; i < order.length; i++) {
      expect(flamegraph.frames[i].frame.name).toBe(order[i]);
      expect(flamegraph.frames[i].depth).toBe(i);
    }
  });

  it('omits 0 width frames', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 1, frame: 1},
        {type: 'C', at: 3, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(trace, createFrameIndex([{name: 'f0'}, {name: 'f1'}])),
      10,
      {
        inverted: false,
        leftHeavy: false,
      }
    );
    expect(flamegraph.frames.length).toBe(1);
    expect(flamegraph.frames.every(f => f.frame.name !== 'f1')).toBe(true);
  });

  it('tracks max stack depth', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'O', at: 2, frame: 1},
        {type: 'C', at: 3, frame: 1},
        {type: 'C', at: 4, frame: 1},
        {type: 'C', at: 5, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(trace, createFrameIndex([{name: 'f0'}, {name: 'f1'}])),
      10,
      {
        inverted: false,
        leftHeavy: false,
      }
    );

    expect(flamegraph.depth).toBe(2);
  });

  it('throws on unbalanced stack', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 1, frame: 1},
      ],
    };

    expect(
      () =>
        new Flamegraph(
          EventedProfile.FromProfile(
            trace,
            createFrameIndex([{name: 'f0'}, {name: 'f1'}])
          ),
          10,
          {
            inverted: false,
            leftHeavy: false,
          }
        )
    ).toThrow('Unbalanced append order stack');
  });

  it('creates leftHeavy graph', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'C', at: 1, frame: 0},
        {type: 'O', at: 2, frame: 1},
        {type: 'C', at: 4, frame: 1},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(trace, createFrameIndex([{name: 'f0'}, {name: 'f1'}])),
      10,
      {
        inverted: false,
        leftHeavy: true,
      }
    );

    expect(flamegraph.frames[0].frame.name).toBe('f0');
    expect(flamegraph.frames[0].frame.totalWeight).toBe(1);
    expect(flamegraph.frames[0].start).toBe(2);
    expect(flamegraph.frames[0].end).toBe(3);

    expect(flamegraph.frames[1].frame.name).toBe('f1');
    expect(flamegraph.frames[1].frame.totalWeight).toBe(2);
    expect(flamegraph.frames[1].start).toBe(0);
    expect(flamegraph.frames[1].end).toBe(2);
  });

  it('updates startTime and endTime of left heavy children graph', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 2, frame: 1},
        {type: 'O', at: 2, frame: 2},
        {type: 'C', at: 4, frame: 2},
        {type: 'C', at: 6, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(
        trace,
        createFrameIndex([{name: 'f0'}, {name: 'f1'}, {name: 'f2'}])
      ),
      10,
      {
        inverted: false,
        leftHeavy: true,
      }
    );

    expect(flamegraph.frames[0].frame.name).toBe('f0');
  });

  it('From', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 1, frame: 1},
        {type: 'C', at: 2, frame: 1},
        {type: 'O', at: 2, frame: 2},
        {type: 'C', at: 4, frame: 2},
        {type: 'C', at: 6, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(
        trace,
        createFrameIndex([{name: 'f0'}, {name: 'f1'}, {name: 'f2'}])
      ),
      10,
      {
        inverted: false,
        leftHeavy: true,
      }
    );

    expect(
      Flamegraph.From(flamegraph, {
        inverted: false,
        leftHeavy: false,
      }).configSpace.equals(flamegraph.configSpace)
    ).toBe(true);
  });

  it('Empty', () => {
    expect(Flamegraph.Empty().configSpace.equals(new Rect(0, 0, 1_000_000, 0))).toBe(
      true
    );
  });

  it('withOffset', () => {
    const trace: Profiling.EventedProfile = {
      name: 'profile',
      startValue: 0,
      endValue: 1000,
      unit: 'milliseconds',
      type: 'evented',
      events: [
        {type: 'O', at: 0, frame: 0},
        {type: 'O', at: 0, frame: 1},
        {type: 'C', at: 2, frame: 1},
        {type: 'C', at: 3, frame: 0},
      ],
    };

    const flamegraph = new Flamegraph(
      EventedProfile.FromProfile(trace, createFrameIndex([{name: 'f0'}, {name: 'f1'}])),
      10,
      {
        inverted: false,
        leftHeavy: false,
      }
    );
    flamegraph.withOffset(500);

    expect(flamegraph.frames[0].start).toBe(500);
    expect(flamegraph.frames[1].start).toBe(500);
    expect(flamegraph.frames[1].end).toBe(502);
    expect(flamegraph.frames[0].end).toBe(503);
  });

  it('setConfigSpace', () => {
    expect(
      Flamegraph.Empty()
        .setConfigSpace(new Rect(0, 0, 10, 5))
        .configSpace.equals(new Rect(0, 0, 10, 5))
    ).toBe(true);
  });
});
