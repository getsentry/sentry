import type {Frame} from 'sentry/types/event';

import {
  createInitialHiddenFrameToggleMap,
  getFrameCountMap,
  getLastFrameIndex,
  getRows,
} from './getRows';

let frameSerial = 0;

function makeFrame(overrides: Partial<Frame> = {}): Frame {
  frameSerial += 1;

  return {
    absPath: null,
    colNo: null,
    context: [],
    filename: 'frame.py',
    function: `fn-${frameSerial}`,
    inApp: false,
    instructionAddr: `0x${frameSerial}`,
    lineNo: frameSerial,
    module: `mod-${frameSerial}`,
    package: `pkg-${frameSerial}`,
    platform: null,
    rawFunction: null,
    symbol: null,
    symbolAddr: null,
    trust: null,
    vars: null,
    ...overrides,
  };
}

describe('stackTrace rows utils', () => {
  it('returns last in-app frame index and falls back to last frame', () => {
    expect(
      getLastFrameIndex([
        makeFrame({inApp: false}),
        makeFrame({inApp: true}),
        makeFrame({inApp: false}),
      ])
    ).toBe(1);

    expect(
      getLastFrameIndex([makeFrame({inApp: false}), makeFrame({inApp: false})])
    ).toBe(1);
  });

  it('builds hidden toggle and count maps for app-frame view', () => {
    const frames = [
      makeFrame({inApp: false, filename: 'hidden.py'}),
      makeFrame({inApp: false, filename: 'lead.py'}),
      makeFrame({inApp: true, filename: 'app.py'}),
      makeFrame({inApp: false, filename: 'tail.py'}),
    ];

    expect(createInitialHiddenFrameToggleMap(frames, false)).toEqual({
      1: false,
      3: false,
    });
    expect(getFrameCountMap(frames, false)).toEqual({
      1: 1,
      3: 0,
    });
  });

  it('expands hidden system frames when toggle is enabled', () => {
    const frames = [
      makeFrame({inApp: false, filename: 'hidden.py'}),
      makeFrame({inApp: false, filename: 'lead.py'}),
      makeFrame({inApp: true, filename: 'app.py'}),
      makeFrame({inApp: false, filename: 'tail.py'}),
    ];
    const frameCountMap = getFrameCountMap(frames, false);

    const rows = getRows({
      frames,
      includeSystemFrames: false,
      hiddenFrameToggleMap: {1: true, 3: false},
      frameCountMap,
      newestFirst: false,
      framesOmitted: null,
      maxDepth: undefined,
    });

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({kind: 'frame', frameIndex: 0, isSubFrame: true});
    expect(rows[1]).toMatchObject({kind: 'frame', frameIndex: 1, hiddenFrameCount: 1});
  });

  it('collapses repeated frames and carries repeat count to the visible frame', () => {
    const repeatedFrameBase = {
      inApp: false,
      lineNo: 112,
      instructionAddr: '0x1',
      package: 'pkg',
      module: 'mod',
      function: 'fn',
    };
    const frames = [
      makeFrame(repeatedFrameBase),
      makeFrame(repeatedFrameBase),
      makeFrame({inApp: true, lineNo: 113, instructionAddr: '0x2', function: 'next'}),
    ];

    const rows = getRows({
      frames,
      includeSystemFrames: true,
      hiddenFrameToggleMap: {},
      frameCountMap: getFrameCountMap(frames, true),
      newestFirst: false,
      framesOmitted: null,
      maxDepth: undefined,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({kind: 'frame', frameIndex: 1, timesRepeated: 1});
  });

  it('inserts omitted rows and respects maxDepth and newestFirst', () => {
    const frames = [
      makeFrame({inApp: true, filename: '0.py'}),
      makeFrame({inApp: true, filename: '1.py'}),
      makeFrame({inApp: true, filename: '2.py'}),
      makeFrame({inApp: true, filename: '3.py'}),
    ];

    const rowsWithOmitted = getRows({
      frames,
      includeSystemFrames: true,
      hiddenFrameToggleMap: {},
      frameCountMap: getFrameCountMap(frames, true),
      newestFirst: false,
      framesOmitted: [1, 3],
      maxDepth: undefined,
    });

    expect(rowsWithOmitted.some(row => row.kind === 'omitted')).toBe(true);

    const newestRows = getRows({
      frames,
      includeSystemFrames: true,
      hiddenFrameToggleMap: {},
      frameCountMap: getFrameCountMap(frames, true),
      newestFirst: true,
      framesOmitted: null,
      maxDepth: 2,
    });

    expect(newestRows).toHaveLength(2);
    expect(newestRows[0]).toMatchObject({kind: 'frame', frameIndex: 3});
    expect(newestRows[1]).toMatchObject({kind: 'frame', frameIndex: 2});
  });
});
