import {createEvent, fireEvent} from 'sentry-test/reactTestingLibrary';

import {VideoReplayer} from './videoReplayer';

// XXX: Not quite sure the best way to mock RAF - here we use fake timers
// VideoReplayer uses `app/util/replays/timer` which uses RAF to count up. This
// is used to render the progress of the seeker bar and sync with video
// replays.
//
// advancing by 2000ms ~== 20000s in Timer, but this may depend on hardware, TBD
jest.useFakeTimers();
jest.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
jest
  .spyOn(window.HTMLMediaElement.prototype, 'play')
  .mockImplementation(() => Promise.resolve());
// jsdom doesn't implement load(); destroyVideo calls it to release the media
// resource on eviction.
jest.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});

describe('VideoReplayer - no starting gap', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  const attachments = [
    {
      id: 0,
      timestamp: 0,
      duration: 5000,
    },
    // no gap
    {
      id: 1,
      timestamp: 5000,
      duration: 5000,
    },
    {
      id: 2,
      timestamp: 10_001,
      duration: 5000,
    },
    // 5 second gap
    {
      id: 3,
      timestamp: 20_000,
      duration: 5000,
    },
    // 5 second gap
    {
      id: 4,
      timestamp: 30_000,
      duration: 5000,
    },
    {
      id: 5,
      timestamp: 35_002,
      duration: 5000,
    },
  ];

  const extra = [
    {
      id: 6,
      timestamp: 40_002,
      duration: 5000,
    },
    {
      id: 7,
      timestamp: 45_002,
      duration: 5000,
    },
  ];

  const skip = [
    {
      id: 7,
      timestamp: 45_002,
      duration: 5000,
    },
    {
      id: 8,
      timestamp: 50_002,
      duration: 5000,
    },
  ];

  it('plays and seeks inside of a segment', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 40000,
      config: {skipInactive: false, speed: 1},
    });
    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(0);

    const playPromise = inst.play(6500);
    jest.advanceTimersByTime(10000);

    await playPromise;

    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(1);
    // `currentTime` is in seconds
    // @ts-expect-error accessing a private field
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toBe(1.5);
  });

  it('seeks to a gap in a video', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 40000,
      config: {skipInactive: false, speed: 1},
    });
    const playPromise = inst.play(18100);
    // @ts-expect-error accessing a private field
    const video = inst.getVideo(2)!;
    // the replay is actually stopped right now to wait for loading
    fireEvent(video, createEvent.loadedData(video));
    // 15000 -> 20000 is a gap, so player should start playing @ index 3, from
    // the beginning.
    jest.advanceTimersByTime(2500);
    await playPromise;
    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(3);
    // `currentTime` is in seconds
    // @ts-expect-error accessing a private field
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toBe(0);
  });

  it('seeks past end of the replay', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      // Unfortunately, `video.play()` is not implemented in jsdom, so no events,
      // so can't check that onFinished is called
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 40000,
      config: {skipInactive: false, speed: 1},
    });
    const playPromise = inst.play(50000);
    // 15000 -> 20000 is a gap, so player should start playing @ index 3, from
    // the beginning.
    jest.advanceTimersByTime(5000);
    await playPromise;
    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(5);
    // `currentTime` is in seconds
    // @ts-expect-error accessing a private field
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toBe(5);
  });

  it('initially only loads videos from 0 to BUFFER', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 40000,
      config: {skipInactive: false, speed: 1},
    });
    const playPromise = inst.play(0);
    jest.advanceTimersByTime(2500);
    await playPromise;
    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(0);
    // @ts-expect-error accessing a private field
    expect(inst._videos.size).toBe(3);
  });

  it('should load the correct videos after playing at a timestamp', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments.concat(extra), {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 50000,
      config: {skipInactive: false, speed: 1},
    });
    // play at segment 7
    const playPromise = inst.play(45_003);
    jest.advanceTimersByTime(2500);
    await playPromise;
    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(7);

    // videos loaded should be [0, 1, 2, 4, 5, 6, 7]
    // since we have [0, 1, 2] preloaded initially
    // and only [4, 5, 6, 7] loaded when segment 7 is requested

    // @ts-expect-error accessing a private field
    const videos = inst._videos;
    // @ts-expect-error accessing a private field
    const getVideo = index => inst.getVideo(index);

    expect(videos.size).toBe(7);
    expect(videos.get(0)).toEqual(getVideo(0));
    expect(videos.get(2)).toEqual(getVideo(2));
    expect(videos.get(3)).toBeUndefined();
    expect(videos.get(4)).toEqual(getVideo(4));
    expect(videos.get(7)).toEqual(getVideo(7));
  });

  it('should work correctly if we have missing segments', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments.concat(skip), {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 55000,
      config: {skipInactive: false, speed: 1},
    });
    // play at segment 7
    const playPromise = inst.play(45_003);
    jest.advanceTimersByTime(2500);
    await playPromise;
    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(6);

    // @ts-expect-error accessing a private field
    const videos = inst._videos;
    // @ts-expect-error accessing a private field
    const getVideo = index => inst.getVideo(index);

    // videos loaded should be [0, 1, 2, 3, 4, 5, 7, 8]
    expect(videos.size).toBe(8);
    expect(videos.get(0)).toEqual(getVideo(0));
    expect(videos.get(2)).toEqual(getVideo(2));
    expect(videos.get(5)).toEqual(getVideo(5));
    expect(videos.get(6)).toEqual(getVideo(6));
    expect(videos.get(7)).toEqual(getVideo(7));
  });
});

describe('VideoReplayer - with starting gap', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  const attachments = [
    {
      id: 0,
      timestamp: 2500,
      duration: 5000,
    },
    // no gap
    {
      id: 1,
      timestamp: 5000,
      duration: 5000,
    },
    {
      id: 2,
      timestamp: 10_001,
      duration: 5000,
    },
    // 5 second gap
    {
      id: 3,
      timestamp: 20_000,
      duration: 5000,
    },
    // 5 second gap
    {
      id: 4,
      timestamp: 30_000,
      duration: 5000,
    },
    {
      id: 5,
      timestamp: 35_002,
      duration: 5000,
    },
  ];

  it('plays and seeks before replay starts', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 40000,
      config: {skipInactive: false, speed: 1},
    });
    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(0);
    const playPromise = inst.play(1500);
    jest.advanceTimersByTime(2000);
    await playPromise;

    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(0);
    // `currentTime` is in seconds
    // @ts-expect-error accessing a private field
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toBe(0);
  });

  it('seeks to a gap in a video', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 40000,
      config: {skipInactive: false, speed: 1},
    });
    const playPromise = inst.play(18100);
    // @ts-expect-error accessing a private field
    const video = inst.getVideo(2)!;
    // the replay is actually stopped right now to wait for loading
    fireEvent(video, createEvent.loadedData(video));
    // 15000 -> 20000 is a gap, so player should start playing @ index 3, from
    // the beginning.
    jest.advanceTimersByTime(2500);
    await playPromise;
    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(3);
    // `currentTime` is in seconds
    // @ts-expect-error accessing a private field
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toBe(0);
  });

  it('seeks past end of the replay', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      // Unfortunately, `video.play()` is not implemented in jsdom, so no events,
      // so can't check that onFinished is called
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 40000,
      config: {skipInactive: false, speed: 1},
    });
    const playPromise = inst.play(50000);
    // 15000 -> 20000 is a gap, so player should start playing @ index 3, from
    // the beginning.
    jest.advanceTimersByTime(5000);
    await playPromise;
    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(5);
    // `currentTime` is in seconds
    // @ts-expect-error accessing a private field
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toBe(5);
  });
});

describe('VideoReplayer - with ending gap', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  const attachments = [
    {
      id: 0,
      timestamp: 2500,
      duration: 5000,
    },
    // no gap
    {
      id: 1,
      timestamp: 5000,
      duration: 5000,
    },
    {
      id: 2,
      timestamp: 10_001,
      duration: 5000,
    },
    // 5 second gap
    {
      id: 3,
      timestamp: 20_000,
      duration: 5000,
    },
    // 5 second gap
    {
      id: 4,
      timestamp: 30_000,
      duration: 5000,
    },
    {
      id: 5,
      timestamp: 35_002,
      duration: 5000,
    },
  ];

  it('keeps playing until the end if there is an ending gap', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 50000,
      config: {skipInactive: false, speed: 1},
    });
    // actual length of the segments is 40s
    // 10s gap at the end

    // play at the last segment
    const playPromise = inst.play(36000);
    await playPromise;
    jest.advanceTimersByTime(4000);

    // we're still within the last segment (5)
    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(5);
    expect(inst.getCurrentTime()).toBe(40000);

    // now we are in the gap
    // timer should still be going since the duration is 50s
    jest.advanceTimersByTime(5000);
    // @ts-expect-error accessing a private field
    expect(inst._isPlaying).toBe(true);

    // a long time passes
    // ensure the timer stops at the end duration (50s)
    jest.advanceTimersByTime(60000);
    expect(inst.getCurrentTime()).toBe(50000);
    // @ts-expect-error accessing a private field
    expect(inst._isPlaying).toBe(false);
  });

  it('ends at the proper time if seeking into a gap at the end', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 50000,
      config: {skipInactive: false, speed: 1},
    });
    // actual length of the segments is 40s
    // 10s gap at the end

    // play at the gap
    const playPromise = inst.play(40002);
    await playPromise;
    jest.advanceTimersByTime(4000);

    // we should be still playing in the gap
    expect(inst.getCurrentTime()).toBe(44002);
    // @ts-expect-error accessing a private field
    expect(inst._isPlaying).toBe(true);

    // a long time passes
    // ensure the timer stops at the end duration (50s)
    jest.advanceTimersByTime(60000);
    expect(inst.getCurrentTime()).toBeLessThan(50100);
    // @ts-expect-error accessing a private field
    expect(inst._isPlaying).toBe(false);
  });
});

describe('VideoReplayer - maxVideoElements eviction', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  const makeAttachments = (count: number) =>
    Array.from({length: count}, (_, i) => ({
      id: i,
      timestamp: i * 5000,
      duration: 5000,
    }));

  it('caps _videos at maxVideoElements when seeking forward', async () => {
    const attachments = makeAttachments(50);
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 50 * 5000,
      config: {skipInactive: false, speed: 1},
      maxVideoElements: 8,
    });

    // Seek through many distant segments so preloadVideos keeps wanting to add
    // new entries.
    for (const offset of [0, 25_000, 50_000, 100_000, 150_000, 200_000, 230_000]) {
      const p = inst.play(offset);
      jest.advanceTimersByTime(100);
      await p;
      // @ts-expect-error accessing a private field
      expect(inst._videos.size).toBeLessThanOrEqual(8);
      // Pool size must equal the number of <video> children we left in the DOM.
      // @ts-expect-error accessing a private field
      expect(inst.wrapper.querySelectorAll('video')).toHaveLength(inst._videos.size);
    }
  });

  it('never evicts the current segment or its preload window', async () => {
    const attachments = makeAttachments(50);
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 50 * 5000,
      config: {skipInactive: false, speed: 1},
      maxVideoElements: 8,
    });

    for (const offset of [0, 30_000, 80_000, 130_000, 180_000]) {
      const p = inst.play(offset);
      jest.advanceTimersByTime(100);
      await p;

      // @ts-expect-error accessing a private field
      const currentIndex = inst._currentIndex!;
      // @ts-expect-error accessing a private field
      const videos = inst._videos as Map<number, HTMLVideoElement>;

      // Current segment is alive.
      expect(videos.has(currentIndex)).toBe(true);
      // Forward preload window is alive (loadSegment preloads [index, index+3)).
      expect(videos.has(currentIndex + 1)).toBe(true);
      expect(videos.has(currentIndex + 2)).toBe(true);
    }
  });

  it('re-creates an evicted segment when seeked back to', async () => {
    const attachments = makeAttachments(50);
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 50 * 5000,
      config: {skipInactive: false, speed: 1},
      maxVideoElements: 8,
    });

    // Step through many distant segments to force segment 0 out of the pool.
    for (const offset of [50_000, 100_000, 150_000, 200_000, 230_000]) {
      const p = inst.play(offset);
      jest.advanceTimersByTime(100);
      await p;
    }
    // @ts-expect-error accessing a private field
    expect(inst._videos.has(0)).toBe(false);

    const seekBack = inst.play(0);
    jest.advanceTimersByTime(100);
    await seekBack;
    // @ts-expect-error accessing a private field
    expect(inst._videos.has(0)).toBe(true);
    // @ts-expect-error accessing a private field
    expect(inst._currentIndex).toBe(0);
  });

  it('tears down every live video on destroy() mid-playback', async () => {
    const attachments = makeAttachments(50);
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
      onBuffer: jest.fn(),
      durationMs: 50 * 5000,
      config: {skipInactive: false, speed: 1},
      maxVideoElements: 8,
    });

    // Build up a pool by scrubbing through a few positions.
    for (const offset of [0, 25_000, 50_000, 100_000]) {
      const p = inst.play(offset);
      jest.advanceTimersByTime(100);
      await p;
    }
    // @ts-expect-error accessing a private field
    expect(inst._videos.size).toBeGreaterThan(0);

    inst.destroy();

    // @ts-expect-error accessing a private field
    expect(inst._videos.size).toBe(0);
    // @ts-expect-error accessing a private field
    expect(inst._videoListeners.size).toBe(0);
    // Wrapper has been removed from the root.
    expect(root.contains(inst.wrapper)).toBe(false);
    // No <video> elements remain inside the (now-detached) wrapper either.
    expect(inst.wrapper.querySelectorAll('video')).toHaveLength(0);
  });
});
