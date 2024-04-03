import {Timer} from 'sentry/utils/replays/timer';
import type {VideoEvent} from 'sentry/utils/replays/types';

import {findVideoSegmentIndex} from './utils';

type RootElem = HTMLDivElement | null;

// The number of segments to load on either side of the requested segment (around 15 seconds)
// Also the number of segments we load initially
const PRELOAD_BUFFER = 3;

interface OffsetOptions {
  segmentOffsetMs?: number;
}

interface VideoReplayerOptions {
  onBuffer: (isBuffering: boolean) => void;
  onFinished: () => void;
  onLoaded: (event: any) => void;
  root: RootElem;
  start: number;
  videoApiPrefix: string;
}

interface VideoReplayerConfig {
  /**
   * Not supported, only here to maintain compat w/ rrweb player
   */
  skipInactive: false;
  /**
   * Video playback speed
   */
  speed: number;
}

/**
 * A special replayer that is specific to mobile replays. Should replicate rrweb's player interface.
 */
export class VideoReplayer {
  private _attachments: VideoEvent[];
  private _callbacks: Record<string, (args?: any) => unknown>;
  private _currentIndex: number | undefined;
  private _currentVideo: HTMLVideoElement | undefined;
  private _startTimestamp: number;
  private _timer = new Timer();
  private _trackList: [ts: number, index: number][];
  private _isPlaying: boolean = false;
  /**
   * _videos is a dict that maps attachment index to the video element.
   * Video elements in this dict are preloaded and ready to be played.
   */
  private _videos: Record<number, HTMLVideoElement>;
  private _videoApiPrefix: string;
  public config: VideoReplayerConfig = {
    skipInactive: false,
    speed: 1.0,
  };
  public wrapper: HTMLElement;
  public iframe = {};

  constructor(
    attachments: VideoEvent[],
    {root, start, videoApiPrefix, onBuffer, onFinished, onLoaded}: VideoReplayerOptions
  ) {
    this._attachments = attachments;
    this._startTimestamp = start;
    this._trackList = [];
    this._videoApiPrefix = videoApiPrefix;
    this._callbacks = {
      onFinished,
      onLoaded,
      onBuffer,
    };
    this._videos = {};

    this.wrapper = document.createElement('div');
    if (root) {
      root.appendChild(this.wrapper);
    }

    // Initially, only load some videos
    this.preloadVideos({low: 0, high: PRELOAD_BUFFER});
    this.loadSegment(0);

    this._trackList = this._attachments.map(({timestamp}, i) => [timestamp, i]);
  }

  private createVideo(segmentData: VideoEvent, index: number) {
    const el = document.createElement('video');
    el.src = `${this._videoApiPrefix}${segmentData.id}/`;
    el.style.display = 'none';
    el.setAttribute('muted', '');
    el.setAttribute('playinline', '');

    // TODO: only attach these when needed
    el.addEventListener('ended', () => this.handleSegmentEnd(index));
    el.addEventListener('play', event => {
      if (index === this._currentIndex) {
        this._callbacks.onLoaded(event);
      }
    });

    // Finished loading data, ready to play
    el.addEventListener('loadeddata', () => {
      // Only call this for current segment as we preload multiple
      // segments simultaneously
      if (index === this._currentIndex) {
        this.setBuffering(false);

        // We want to display the previous segment until next video
        // is loaded and ready to play and since video is loaded
        // and ready here, we can show next video and hide the
        // previous video
        this.showVideo(el);
      }
    });

    el.addEventListener('loadedmetadata', event => {
      // Only call this for current segment?
      if (index === this._currentIndex) {
        this._callbacks.onLoaded(event);
      }
    });

    el.preload = 'auto';
    // TODO: Timer needs to also account for playback speed
    el.playbackRate = this.config.speed;

    // Append the video element to the mobile player wrapper element
    this.wrapper.appendChild(el);

    return el;
  }

  /**
   * Resume timer only if replay is running. This accounts for
   * playing through "dead air".
   */
  private resumeTimer() {
    if (!this._isPlaying) {
      return;
    }
    this._timer.resume();
  }

  /**
   * Pause timer only if replay is running. Otherwise, no need to
   * pause if timer is not already running.
   */
  private pauseTimer() {
    if (!this._isPlaying) {
      return;
    }
    this._timer.stop();
  }

  private startReplay(videoOffsetMs: number) {
    this._isPlaying = true;
    this._timer.start(videoOffsetMs);
  }

  private pauseReplay() {
    this.pauseTimer();
    this._isPlaying = false;
  }

  /**
   * Sets the current buffering state by:
   *
   * - calling `onBuffer` callback to propagate up
   * - control timers as they should not run while buffering
   */
  private setBuffering(isBuffering: boolean) {
    if (isBuffering) {
      this.pauseTimer();
    } else {
      this.resumeTimer();
    }

    this._callbacks.onBuffer(isBuffering);
  }

  private stopReplay() {
    this._timer.stop();
    this._callbacks.onFinished();
    this._isPlaying = false;
  }

  /**
   * Called when a video finishes playing, so that it can proceed
   * to the next video
   */
  private handleSegmentEnd(index: number) {
    const nextIndex = index + 1;

    // No more segments
    if (nextIndex >= this._attachments.length) {
      this.stopReplay();
      return;
    }

    // Final check in case replay was stopped immediately after a video
    if (!this._isPlaying) {
      return;
    }

    this.playSegmentAtIndex(nextIndex);
  }

  /**
   * Create videos from a slice of _attachments, given the start and end index.
   */
  protected preloadVideos({low, high}: {high: number; low: number}) {
    // Make sure we don't go out of bounds
    const l = Math.max(0, low);
    const h = Math.min(high, this._attachments.length + 1);

    return this._attachments.slice(l, h).forEach((attachment, index) => {
      const dictIndex = index + l;

      // Might be some videos we've already loaded before
      if (!this._videos[dictIndex]) {
        this._videos[dictIndex] = this.createVideo(attachment, dictIndex);
      }
    });
  }

  /**
   * Given a relative time offset, get the segment number where the time offset would be contained in
   */
  protected getSegmentIndexForTime(relativeOffsetMs: number): {
    previousSegment: number | undefined;
    segment: number | undefined;
  } {
    const timestamp = this._startTimestamp + relativeOffsetMs;

    // This function will return the prior segment index if no valid segments
    // were found, so we will need to double check if the result was an exact
    // match or not
    const result = findVideoSegmentIndex(this._trackList, this._attachments, timestamp);
    const resultSegment = this.getSegment(result)!;
    const isExactSegment =
      resultSegment &&
      timestamp >= resultSegment.timestamp &&
      timestamp <= resultSegment.timestamp + resultSegment.duration;

    // TODO: Handle the case where relativeOffsetMs > length of the replay/seekbar (shouldn't happen)
    return {
      segment: isExactSegment ? result : undefined,
      previousSegment: !isExactSegment ? result : undefined,
    };
  }

  protected getSegment(index?: number | undefined): VideoEvent | undefined {
    if (index === undefined) {
      return undefined;
    }

    return this._attachments[index];
  }

  /**
   * Returns the video in the dictionary at the requested index.
   */
  protected getVideo(index: number | undefined): HTMLVideoElement | undefined {
    if (index === undefined || index < 0 || index >= this._attachments.length) {
      return undefined;
    }

    return this._videos[index];
  }

  /**
   * Shows the video -- it is assumed that it is preloaded. Also
   * hides the previous video, there should not be a reason we show
   * a video and not hide the previous video, otherwise there will
   * be multiple video elements stacked on top of each other.
   */
  protected showVideo(nextVideo: HTMLVideoElement | undefined): void {
    if (!nextVideo) {
      return;
    }

    // This is the soon-to-be previous video that needs to be hidden
    if (this._currentVideo) {
      this._currentVideo.style.display = 'none';
    }

    nextVideo.style.display = 'block';

    // Update current video so that we can hide it when showing the
    // next video
    this._currentVideo = nextVideo;
  }

  protected async playVideo(video: HTMLVideoElement | undefined): Promise<void> {
    if (!video) {
      return Promise.resolve();
    }
    video.playbackRate = this.config.speed;

    // If video is not playable, then update buffering state,
    // otherwise, proceed to hide the previous video and play
    if (video.readyState === 0) {
      // Note that we do not handle when the load finishes here, it
      // is handled via the `loadeddata` event handler
      this.setBuffering(true);
    }

    const playPromise = video.play();
    await playPromise;

    // Buffering is over after play promise is resolved
    this.setBuffering(false);

    return playPromise;
  }

  protected setVideoTime(video: HTMLVideoElement, timeMs: number) {
    // Needs to be in seconds
    video.currentTime = timeMs / 1000;
  }

  /**
   * Loads a segment at a specified index. Handles hiding/showing the video
   * segment, and ensures that the videos are synced with the timer. That is,
   * do not show videos before the timer has reached the segment's current
   * starting timestamp.
   */
  protected async loadSegment(
    index: number | undefined,
    {segmentOffsetMs = 0}: OffsetOptions = {}
  ): Promise<number> {
    // Check if index is valid
    if (index === undefined || index < 0 || index >= this._attachments.length) {
      return -1;
    }

    // Check if video at index should be played (e.g. if scrubber time is
    // within bounds of video time constraints)
    const currentSegment = this.getSegment(index);
    const now = this._timer.getTime();

    if (!currentSegment) {
      // Error if segment isn't found
      return -1;
    }

    const currentSegmentOffset = currentSegment.timestamp - this._startTimestamp;

    // `handleEnd()` dumbly gives the next video, we need to make sure that the
    // current seek time is inside of the video timestamp, as there can be gaps
    // in between videos.
    if (now < currentSegmentOffset && this._isPlaying) {
      // There should not be the case where this is called and we need to
      // display the previous segment. `loadSegmentAtTime` handles showing the
      // previous segment when you seek.
      await new Promise(resolve =>
        this._timer.addNotificationAtTime(currentSegmentOffset, () => resolve(true))
      );
    }

    // Preload the next few videos
    if (index < this._attachments.length) {
      this.preloadVideos({low: index, high: index + PRELOAD_BUFFER});
    }

    const nextVideo = this.getVideo(index);

    if (nextVideo) {
      // Will need to hide previous video if next video is ready to
      // be played immediately
      // const previousVideoIndex = this._currentIndex;
      // Set video to proper offset
      this.setVideoTime(nextVideo, segmentOffsetMs);
      this._currentIndex = index;

      if (nextVideo.readyState === 0) {
        // Video is not ready to be played, show buffering state
        this.setBuffering(true);
      } else {
        // Video is ready to be played, show the next video
        this.showVideo(nextVideo);
      }
    } else {
      // eslint-disable-next-line no-console
      console.error(new Error('Loading invalid video'));
      return -1;
    }

    return this._currentIndex;
  }

  /**
   * Plays a segment at the segment index
   */
  protected async playSegmentAtIndex(index: number | undefined) {
    this._isPlaying = true;
    const loadedSegmentIndex = await this.loadSegment(index, {segmentOffsetMs: 0});

    // Preload videos before and after this index
    this.preloadVideos({
      low: loadedSegmentIndex - PRELOAD_BUFFER,
      high: loadedSegmentIndex + PRELOAD_BUFFER,
    });

    if (loadedSegmentIndex !== undefined) {
      this.playVideo(this.getVideo(loadedSegmentIndex));
    }
  }

  /**
   * Loads a segment based on the video offset (all of the segments
   * concatenated together). Finds the proper segment to load based on each
   * segment's timestamp and duration. Displays the closest prior segment if
   * offset exists in a gap where there is no recorded segment.
   */
  protected async loadSegmentAtTime(
    videoOffsetMs: number = 0
  ): Promise<number | undefined> {
    const {segment: segmentIndex, previousSegment: previousSegmentIndex} =
      this.getSegmentIndexForTime(videoOffsetMs);

    // segmentIndex can be undefined because user has seeked into a gap where
    // there is no segment, because we have the previous index, we know what
    // the next index will be since segments are expected to be sorted
    const nextSegmentIndex =
      segmentIndex !== undefined
        ? segmentIndex
        : previousSegmentIndex !== undefined
          ? previousSegmentIndex + 1
          : undefined;

    // edge case where we have a gap between start of replay and first segment
    // wait until timer reaches the first segment before starting
    if (segmentIndex === undefined && previousSegmentIndex === -1) {
      await this.loadSegment(nextSegmentIndex, {
        segmentOffsetMs: 0,
      });
    }
    // It's possible video and segment don't exist, e.g. if we seek to a gap
    // between two replays. In this case, we load the previous segment index
    // and wait until the timer reaches the next video segment's starting
    // timestamp before playing.
    else if (segmentIndex === undefined && previousSegmentIndex !== undefined) {
      const previousSegment = this.getSegment(previousSegmentIndex)!;
      // Load the last frame of the previous segment
      await this.loadSegment(previousSegmentIndex, {
        segmentOffsetMs: previousSegment.duration,
      });
    }

    const segment = this.getSegment(nextSegmentIndex);
    if (!segment) {
      // There could be an edge case where we have a gap at the end of the
      // video (due to bad data maybe?), and there is no next segment
      return undefined;
    }

    // We are given an offset based on all videos combined, so we have to
    // calculate the individual video segment's offset
    //
    // This can be negative if videoOffsetMs is in a gap because `segment` will
    // represent the next video to be played
    const segmentOffsetMs = Math.max(
      this._startTimestamp + videoOffsetMs - segment.timestamp,
      0
    );

    return this.loadSegment(nextSegmentIndex, {segmentOffsetMs});
  }

  /**
   * Returns the current time of our timer
   *
   * We keep a separate timer because there can be cases where we have "gaps"
   * between videos. In this case we will need the seek bar to continue running
   * until the next video starts.
   */
  public getCurrentTime() {
    // Note that timer can be running while there is no `_currentIndex`
    // e.g. if first segment's start timestamp does not match replay's starting timestamp
    return this._timer.getTime();
  }

  /**
   * Plays the replay at a time (offset), e.g. starting at 20 seconds
   *
   * @param videoOffsetMs The time within the entire video, to start playing at
   */
  public async play(videoOffsetMs: number): Promise<void> {
    this.startReplay(videoOffsetMs);

    // When we seek to a new spot in the replay, pause the old video
    const previousVideo = this.getVideo(this._currentIndex);

    if (previousVideo) {
      previousVideo.pause();
    }

    const loadedSegmentIndex = await this.loadSegmentAtTime(videoOffsetMs);

    if (loadedSegmentIndex === undefined) {
      // TODO: this shouldn't happen, loadSegment should load the previous
      // segment until it's time to start the next segment
      return Promise.resolve();
    }

    // Preload videos before and after this index
    this.preloadVideos({
      low: loadedSegmentIndex - PRELOAD_BUFFER,
      high: loadedSegmentIndex + PRELOAD_BUFFER,
    });

    return this.playVideo(this.getVideo(loadedSegmentIndex));
  }

  /**
   * Pause at a specific time in the replay. Note that this gets called when seeking.
   */
  public pause(videoOffsetMs: number) {
    const index = this._currentIndex ?? 0;
    this.pauseReplay();

    // Preload videos before and after this index
    this.preloadVideos({
      low: index - PRELOAD_BUFFER,
      high: index + PRELOAD_BUFFER,
    });

    // Pause the current video
    const currentVideo = this.getVideo(index);
    currentVideo?.pause();

    // Load the current segment and set to correct time
    this.loadSegmentAtTime(videoOffsetMs);
  }

  /**
   * Equivalent to rrweb's `setConfig()`, but here we only support the `speed` configuration
   */
  public setConfig(config: Partial<VideoReplayerConfig>): void {
    Object.entries(config)
      .filter(([, value]) => value !== undefined)
      .forEach(([key, value]) => {
        this.config[key] = value;
      });

    if (config.speed !== undefined) {
      const currentVideo = this.getVideo(this._currentIndex);

      if (!currentVideo) {
        return;
      }
      currentVideo.playbackRate = this.config.speed;
    }
  }
}
