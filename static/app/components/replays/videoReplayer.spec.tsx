import {VideoReplayer} from './videoReplayer';

// XXX: Not quite sure the best way to mock RAF - here we use fake timers
// VideoReplayer uses `app/util/replays/timer` which uses RAF to count up. This
// is used to render the progress of the seeker bar and sync with video
// replays.
//
// advancing by 2000ms ~== 20000s in Timer, but this may depend on hardware, TBD
jest.useFakeTimers();

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
    });
    // @ts-expect-error private
    expect(inst._currentIndex).toEqual(0);

    const playPromise = inst.play(6500);
    jest.advanceTimersByTime(10000);

    await playPromise;

    // @ts-expect-error private
    expect(inst._currentIndex).toEqual(1);
    // `currentTime` is in seconds
    // @ts-expect-error private
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toEqual(1.5);
  });

  it('seeks to a gap in a video', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
    });
    const playPromise = inst.play(18100);
    // 15000 -> 20000 is a gap, so player should start playing @ index 3, from
    // the beginning.
    jest.advanceTimersByTime(2500);
    await playPromise;
    // @ts-expect-error private
    expect(inst._currentIndex).toEqual(3);
    // `currentTime` is in seconds
    // @ts-expect-error private
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toEqual(0);
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
    });
    const playPromise = inst.play(50000);
    // 15000 -> 20000 is a gap, so player should start playing @ index 3, from
    // the beginning.
    jest.advanceTimersByTime(5000);
    await playPromise;
    // @ts-expect-error private
    expect(inst._currentIndex).toEqual(5);
    // `currentTime` is in seconds
    // @ts-expect-error private
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toEqual(5);
  });

  it('initially only loads videos from 0 to BUFFER', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
    });
    const playPromise = inst.play(0);
    jest.advanceTimersByTime(2500);
    await playPromise;
    // @ts-expect-error private
    expect(inst._currentIndex).toEqual(0);
    // @ts-expect-error private
    expect(Object.keys(inst._videos).length).toEqual(3);
  });

  it('should load the correct videos after playing at a timestamp', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments.concat(extra), {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
    });
    // play at segment 7
    const playPromise = inst.play(45_003);
    jest.advanceTimersByTime(2500);
    await playPromise;
    // @ts-expect-error private
    expect(inst._currentIndex).toEqual(7);

    // videos loaded should be [0, 1, 2, 4, 5, 6, 7]
    // since we have [0, 1, 2] preloaded initially
    // and only [4, 5, 6, 7] loaded when segment 7 is requested

    // @ts-expect-error private
    const videos = inst._videos;
    // @ts-expect-error private
    const getVideo = index => inst.getVideo(index);

    expect(Object.keys(videos).length).toEqual(7);
    expect(videos[0]).toEqual(getVideo(0));
    expect(videos[2]).toEqual(getVideo(2));
    expect(videos[3]).toEqual(undefined);
    expect(videos[4]).toEqual(getVideo(4));
    expect(videos[7]).toEqual(getVideo(7));
  });

  it('should work correctly if we have missing segments', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments.concat(skip), {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
    });
    // play at segment 7
    const playPromise = inst.play(45_003);
    jest.advanceTimersByTime(2500);
    await playPromise;
    // @ts-expect-error private
    expect(inst._currentIndex).toEqual(6);

    // @ts-expect-error private
    const videos = inst._videos;
    // @ts-expect-error private
    const getVideo = index => inst.getVideo(index);

    // videos loaded should be [0, 1, 2, 3, 4, 5, 7, 8]
    expect(Object.keys(videos).length).toEqual(8);
    expect(videos[0]).toEqual(getVideo(0));
    expect(videos[2]).toEqual(getVideo(2));
    expect(videos[5]).toEqual(getVideo(5));
    expect(videos[6]).toEqual(getVideo(6));
    expect(videos[7]).toEqual(getVideo(7));
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
    });
    // @ts-expect-error private
    expect(inst._currentIndex).toEqual(undefined);
    const playPromise = inst.play(1500);
    jest.advanceTimersByTime(2000);
    await playPromise;

    // @ts-expect-error private
    expect(inst._currentIndex).toEqual(0);
    // `currentTime` is in seconds
    // @ts-expect-error private
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toEqual(0);
  });

  it('seeks to a gap in a video', async () => {
    const root = document.createElement('div');
    const inst = new VideoReplayer(attachments, {
      videoApiPrefix: '/foo/',
      root,
      start: 0,
      onFinished: jest.fn(),
      onLoaded: jest.fn(),
    });
    const playPromise = inst.play(18100);
    // 15000 -> 20000 is a gap, so player should start playing @ index 3, from
    // the beginning.
    jest.advanceTimersByTime(2500);
    await playPromise;
    // @ts-expect-error private
    expect(inst._currentIndex).toEqual(3);
    // `currentTime` is in seconds
    // @ts-expect-error private
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toEqual(0);
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
    });
    const playPromise = inst.play(50000);
    // 15000 -> 20000 is a gap, so player should start playing @ index 3, from
    // the beginning.
    jest.advanceTimersByTime(5000);
    await playPromise;
    // @ts-expect-error private
    expect(inst._currentIndex).toEqual(5);
    // `currentTime` is in seconds
    // @ts-expect-error private
    expect(inst.getVideo(inst._currentIndex)?.currentTime).toEqual(5);
  });
});
