import {resolveJSSelfProfilingStack} from 'sentry/utils/profiling/jsSelfProfiling';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

const toStackNames = (stack: readonly JSSelfProfiling.Frame[]): string[] => {
  return stack.map(f => f.name);
};

describe('jsSelfProfiling', () => {
  describe('resolveJSSelfProfilingStack', () => {
    it('when thread is idle and sample has no associated stackId', () => {
      const trace: JSSelfProfiling.Trace = {
        frames: [],
        resources: [],
        samples: [{stackId: 0, timestamp: 0}],
        stacks: [{frameId: 0, parentId: undefined}],
      };
      expect(resolveJSSelfProfilingStack(trace, 0, {})).toEqual([]);
    });

    it('when stackId is set', () => {
      const trace: JSSelfProfiling.Trace = {
        frames: [
          {name: 'foo', line: 0, column: 0},
          {name: 'bar', line: 0, column: 0},
          {name: 'baz', line: 0, column: 0},
          {name: 'foobar', line: 0, column: 0},
          {name: 'foobarbaz', line: 0, column: 0},
          {name: 'foobarbazfoo', line: 0, column: 0},
        ],
        resources: [],
        samples: [{stackId: 5, timestamp: 0}],
        stacks: [
          {frameId: 0, parentId: undefined},
          {frameId: 1, parentId: undefined},
          {frameId: 2, parentId: undefined},
          {frameId: 3, parentId: 2},
          {frameId: 4, parentId: 3},
          {frameId: 5, parentId: 4},
        ],
      };
      expect(
        toStackNames(
          resolveJSSelfProfilingStack(
            trace,
            5,
            createFrameIndex('javascript', trace.frames)
          )
        )
      ).toEqual(['baz', 'foobar', 'foobarbaz', 'foobarbazfoo']);
    });

    it('when marker is present on the stack', () => {
      const trace: JSSelfProfiling.Trace = {
        frames: [
          {name: 'foo', line: 0, column: 0},
          {name: 'bar', line: 0, column: 0},
          {name: 'baz', line: 0, column: 0},
          {name: 'foobar', line: 0, column: 0},
          {name: 'foobarbaz', line: 0, column: 0},
          {name: 'foobarbazfoo', line: 0, column: 0},
        ],
        resources: [],
        samples: [{stackId: 5, timestamp: 0, marker: 'gc'}],
        stacks: [
          {frameId: 0, parentId: undefined},
          {frameId: 1, parentId: undefined},
          {frameId: 2, parentId: undefined},
          {frameId: 3, parentId: 2},
          {frameId: 4, parentId: 3},
          {frameId: 5, parentId: 4},
        ],
      };

      // I'm not sure I like passing the marker, the reason it's like this is that we usually loop through the samples and have the marker as
      // we execute resolveJSSelfProfilingStack, but I'm not sure we should do that and instead augment the resolved stack outside of the loop.
      // The nice thing about it is that it centralizes the stack logic and makes it easier to test.
      expect(
        toStackNames(
          resolveJSSelfProfilingStack(
            trace,
            5,
            createFrameIndex('javascript', trace.frames),
            'gc'
          )
        )
      ).toEqual(['baz', 'foobar', 'foobarbaz', 'foobarbazfoo', 'Garbage Collection']);
    });

    it('when stack is empty, but browser was performing other operations', () => {
      const trace: JSSelfProfiling.Trace = {
        frames: [],
        resources: [],
        samples: [{stackId: 0, timestamp: 0, marker: 'paint'}],
        stacks: [{frameId: 0, parentId: undefined}],
      };

      expect(
        toStackNames(
          resolveJSSelfProfilingStack(
            trace,
            0,
            createFrameIndex('javascript', trace.frames),
            'paint'
          )
        )
      ).toEqual(['Paint']);
    });
  });
});
