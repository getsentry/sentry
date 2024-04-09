import {vec2} from 'gl-matrix';

import {makeCanvasMock, makeContextMock} from 'sentry-test/profiling/utils';

import {UIFramesRendererWebGL} from 'sentry/utils/profiling/renderers/uiFramesRendererWebGL';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {UIFrames} from 'sentry/utils/profiling/uiFrames';

import {LightFlamegraphTheme} from '../flamegraph/flamegraphTheme';

describe('UIFramesRenderer', () => {
  const canvas = makeCanvasMock({
    getContext: jest.fn().mockReturnValue(makeContextMock()),
  });
  const uiFrames = new UIFrames(
    {
      frozen: {
        unit: 'nanoseconds',
        values: [
          {
            elapsed_since_start_ns: 1,
            value: 1,
          },
          {
            elapsed_since_start_ns: 3,
            value: 1,
          },
          {
            elapsed_since_start_ns: 5.5,
            value: 1,
          },
        ],
      },
      slow: {
        unit: 'nanoseconds',
        values: [
          {
            elapsed_since_start_ns: 3,
            value: 1,
          },
          {
            elapsed_since_start_ns: 5,
            value: 1,
          },
        ],
      },
    },
    {unit: 'nanoseconds'},
    new Rect(0, 0, 10, 1)
  );
  const renderer = new UIFramesRendererWebGL(canvas, uiFrames, LightFlamegraphTheme);

  it.each([
    [vec2.fromValues(-1, 0), null],
    [vec2.fromValues(11, 0), null],
    [vec2.fromValues(0.1, 0), [uiFrames.frames[0]]],
    [vec2.fromValues(2.5, 0), [uiFrames.frames[1], uiFrames.frames[2]]],
    [vec2.fromValues(4.5, 0), [uiFrames.frames[3], uiFrames.frames[4]]],
  ])('finds hovered node', (cursor, expected) => {
    const results = renderer.findHoveredNode(cursor, uiFrames.configSpace);

    if (Array.isArray(expected) && Array.isArray(results)) {
      for (let i = 0; i < results?.length; i++) {
        expect(results[i]).toBe(expected[i]);
      }
    } else {
      expect(results).toEqual(expected);
    }
  });
});
