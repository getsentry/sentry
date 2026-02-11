import {
  canvasMutation,
  EventType,
  IncrementalSource,
  Replayer,
} from '@sentry-internal/rrweb';

import {CanvasReplayerPlugin} from 'sentry/components/replays/canvasReplayerPlugin';

// Mock rrweb pieces used by the plugin
jest.mock('@sentry-internal/rrweb', () => {
  return {
    // Keep enums minimal; values only need to be comparable
    EventType: {IncrementalSnapshot: 3},
    IncrementalSource: {CanvasMutation: 6},
    canvasMutation: jest.fn(() => Promise.resolve()),
  };
});

// debounce doesn't work with fake timers
jest.mock('lodash/debounce', () =>
  jest.fn().mockImplementation((callback, timeout) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const debounced = jest.fn((...args) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback(...args), timeout);
    });

    const cancel = jest.fn(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    const flush = jest.fn(() => {
      if (timeoutId) clearTimeout(timeoutId);
      callback();
    });

    // @ts-expect-error mock lodash debounce
    debounced.cancel = cancel;
    // @ts-expect-error mock lodash debounce
    debounced.flush = flush;
    return debounced;
  })
);

type EventWithTime = {
  data: any;
  timestamp: number;
  type: number;
};

jest.useFakeTimers();

// Ensure canvas.toDataURL exists under JSDOM
beforeAll(() => {
  jest
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/png;base64,TEST');
});

afterAll(() => {
  jest.restoreAllMocks();
});

function createCanvasNode(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  // Give it size to avoid edge cases
  canvas.width = 10;
  canvas.height = 10;
  return canvas;
}

function createCanvasEvent(id: number, timestamp: number): EventWithTime {
  return {
    type: EventType.IncrementalSnapshot,
    timestamp,
    data: {
      id,
      source: IncrementalSource.CanvasMutation,
      // Minimal shape; the plugin defers to mocked canvasMutation
      commands: [],
    },
  };
}

function createReplayer(getNodeImpl: (id: number) => Node | null) {
  return {
    getMirror() {
      return {
        getNode: getNodeImpl,
      };
    },
  } as Replayer;
}

describe('CanvasReplayerPlugin', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    (canvasMutation as jest.Mock).mockClear();
  });

  it('does not clear current canvas snapshot when flushing queued sync events before processing a canvas event', async () => {
    const id = 1;
    const canvasNode = createCanvasNode();

    // Replayer mirror returns our canvas node for this id
    const replayer = createReplayer(requestedId =>
      requestedId === id ? canvasNode : null
    );

    // Create plugin instance; the initial events list can be empty for this test
    const plugin = CanvasReplayerPlugin([]);

    // Build the node and ensure an <img> container is appended
    plugin.onBuild!(canvasNode, {id, replayer});
    const img = canvasNode.querySelector('img')!;
    expect(img).toBeTruthy();
    expect(img.src).toBe('');

    // First, process a normal canvas event to seed the snapshot and canvases map
    const e0 = createCanvasEvent(id, 1000);
    plugin.handler!(e0, false, {replayer});

    // Allow async microtasks to run for processEvent
    jest.runAllTimers();
    await Promise.resolve();

    expect(canvasMutation).toHaveBeenCalledTimes(1);
    expect(img.src).toContain('data:image/png;base64');

    // Now simulate a seek: queue two sync events for the same canvas id
    const e1 = createCanvasEvent(id, 2000);
    const e2 = createCanvasEvent(id, 3000);
    plugin.handler!(e1, true, {replayer});
    plugin.handler!(e2, true, {replayer});

    // While debounced queue has not auto-flushed yet, a new canvas event arrives
    const e3 = createCanvasEvent(id, 3100);
    plugin.handler!(e3, false, {replayer});

    // processEvent flushes the debounced queue; wait for async processing
    jest.runAllTimers();
    await Promise.resolve();

    // We should have processed the queued latest sync event and the realtime event
    expect((canvasMutation as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);

    // Critically, the current canvas snapshot should not be cleared
    expect(img.src).toContain('data:image/png;base64');
  });

  it('does not clear sync canvas snapshots when loading a replay at specific timestamp', async () => {
    const id1 = 1;
    const id2 = 2;
    const id3 = 3;
    const canvasNode1 = createCanvasNode();
    const canvasNode2 = createCanvasNode();
    const canvasNode3 = createCanvasNode();

    // Replayer mirror returns our canvas node for this id
    const replayer = createReplayer(requestedId =>
      requestedId === id1
        ? canvasNode1
        : requestedId === id2
          ? canvasNode2
          : requestedId === id3
            ? canvasNode3
            : null
    );

    // Create plugin instance; the initial events list can be empty for this test
    const plugin = CanvasReplayerPlugin([]);

    // player first processes sync events
    const e0 = createCanvasEvent(1, 1000);
    const e1 = createCanvasEvent(2, 2000);
    const e2 = createCanvasEvent(3, 3000);
    plugin.handler!(e0, true, {replayer});
    plugin.handler!(e1, true, {replayer});
    plugin.handler!(e2, true, {replayer});

    // Then build
    plugin.onBuild!(canvasNode3, {id: id3, replayer});
    // Note, onBuild clears the event from `handleQueue`, so canvas mutation only gets called once, via onBuild -> processEvent

    expect(canvasMutation).toHaveBeenCalledTimes(3);
    jest.runAllTimers();
    await Promise.resolve();
    const img = canvasNode3.querySelector('img')!;
    expect(img.src).toContain('data:image/png;base64');
  });

  it('clears snapshots for canvases that are not queued when seeking', async () => {
    const id1 = 10;
    const id2 = 11;
    const canvas1 = createCanvasNode();
    const canvas2 = createCanvasNode();

    const replayer = createReplayer(requestedId => {
      if (requestedId === id1) return canvas1;
      if (requestedId === id2) return canvas2;
      return null;
    });

    const plugin = CanvasReplayerPlugin([]);

    // Build both canvases and create snapshots for both
    plugin.onBuild!(canvas1, {id: id1, replayer});
    plugin.onBuild!(canvas2, {id: id2, replayer});
    const img1 = canvas1.querySelector('img')!;
    const img2 = canvas2.querySelector('img')!;

    const e1 = createCanvasEvent(id1, 1000);
    const e2 = createCanvasEvent(id2, 1100);
    plugin.handler!(e1, false, {replayer});
    plugin.handler!(e2, false, {replayer});

    jest.runAllTimers();
    await Promise.resolve();
    expect(img1.src).toContain('data:image/png;base64');
    expect(img2.src).toContain('data:image/png;base64');

    // Seek to a point where only id1 has a queued canvas event
    const e1Seek = createCanvasEvent(id1, 2000);
    plugin.handler!(e1Seek, true, {replayer});

    // Trigger processing by a new realtime canvas event (could be id1 again)
    const e1Realtime = createCanvasEvent(id1, 2100);
    plugin.handler!(e1Realtime, false, {replayer});

    jest.runAllTimers();
    await Promise.resolve();

    // Since id2 was not queued during the seek, its snapshot should be cleared by the plugin
    expect(img1.src).toContain('data:image/png;base64');
    // it should be empty but it's
    expect(img2.src).toBe('data:,');
  });
});
