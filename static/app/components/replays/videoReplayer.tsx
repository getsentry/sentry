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
  private _startTimestamp: number;
  private _timer = new Timer();
  private _trackList: [ts: number, index: number][];
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
    {root, start, videoApiPrefix, onFinished, onLoaded}: VideoReplayerOptions
  ) {
    this._attachments = attachments;
    this._startTimestamp = start;
    this._trackList = [];
    this._videoApiPrefix = videoApiPrefix;
    this._callbacks = {
      onFinished,
      onLoaded,
    };
    this._videos = {};

    this.wrapper = document.createElement('div');
    if (root) {
      root.appendChild(this.wrapper);
    }

    // Initially, only load some videos
    this.createVideoForRange({low: 0, high: PRELOAD_BUFFER});

    this._trackList = this._attachments.map(({timestamp}, i) => [timestamp, i]);
    this.loadSegment(0);
  }

  private createVideo(segmentData: VideoEvent, index: number) {
    const el = document.createElement('video');
    el.src = `${this._videoApiPrefix}${segmentData.id}/`;
    el.style.display = 'none';

    // TODO: only attach these when needed
    el.addEventListener('ended', () => this.handleSegmentEnd(index));
    el.addEventListener('play', event => {
      if (index === this._currentIndex) {
        this._callbacks.onLoaded(event);
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

  private handleSegmentEnd(index: number) {
    const nextIndex = index + 1;

    // No more segments
    if (nextIndex >= this._attachments.length) {
      this._timer.stop();
      this._callbacks.onFinished();
      return;
    }

    this.playSegmentAtIndex(nextIndex);
  }

  /**
   * Create videos from a slice of _attachments, given the start and end index.
   */
  protected createVideoForRange({low, high}: {high: number; low: number}) {
    return this._attachments.slice(low, high).forEach((attachment, index) => {
      const dictIndex = index + low;

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
   * Fetches the video if it exists, otherwise creates the video and adds to the _videos dictionary.
   */
  protected getOrCreateVideo(index: number | undefined): HTMLVideoElement | undefined {
    const video = this.getVideo(index);

    if (video) {
      return video;
    }

    if (index === undefined) {
      return undefined;
    }

    // If we haven't loaded the current video yet, we should load videos on either side too
    const low = Math.max(0, index - PRELOAD_BUFFER);
    const high = Math.min(index + PRELOAD_BUFFER, this._attachments.length + 1);
    this.createVideoForRange({low, high});

    return this._videos[index];
  }

  protected hideVideo(index: number | undefined): void {
    const video = this.getVideo(index);

    if (!video) {
      return;
    }

    video.style.display = 'none';
  }

  protected showVideo(video: HTMLVideoElement | undefined): void {
    if (!video) {
      return;
    }

    video.style.display = 'block';
  }

  protected playVideo(video: HTMLVideoElement | undefined): Promise<void> {
    if (!video) {
      return Promise.resolve();
    }
    video.playbackRate = this.config.speed;
    return video.play();
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
    // in between videos
    if (now < currentSegmentOffset) {
      // There should not be the case where this is called and we need to
      // display the previous segment. `loadSegmentAtTime` handles showing the
      // previous segment when you seek.
      await new Promise(resolve =>
        this._timer.addNotificationAtTime(currentSegmentOffset, () => resolve(true))
      );
    }

    // TODO: This shouldn't be needed? previous video shouldn't be displayed?
    const previousIndex = index - 1;
    if (previousIndex >= 0) {
      // Hide the previous video
      this.hideVideo(previousIndex);
    }

    // Hide current video
    this.hideVideo(this._currentIndex);

    const nextVideo = this.getOrCreateVideo(index);
    // Show the next video
    this.showVideo(nextVideo);

    // Preload the next few videos
    if (index < this._attachments.length) {
      this.getOrCreateVideo(index + 1);
    }

    // Set video to proper offset
    if (nextVideo) {
      this.setVideoTime(nextVideo, segmentOffsetMs);
      this._currentIndex = index;
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
    const loadedSegmentIndex = await this.loadSegment(index, {segmentOffsetMs: 0});

    if (loadedSegmentIndex !== undefined) {
      this.playVideo(this.getOrCreateVideo(loadedSegmentIndex));
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
   * Plays the video segment at a time (offset), e.g. starting at 20 seconds
   */
  protected async playSegmentAtTime(videoOffsetMs: number = 0): Promise<void> {
    const loadedSegmentIndex = await this.loadSegmentAtTime(videoOffsetMs);

    if (loadedSegmentIndex === undefined) {
      // TODO: this shouldn't happen, loadSegment should load the previous
      // segment until it's time to start the next segment
      return Promise.resolve();
    }

    return this.playVideo(this.getOrCreateVideo(loadedSegmentIndex));
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
   * @param videoOffsetMs The time within the entire video, to start playing at
   */
  public play(videoOffsetMs: number): Promise<void> {
    this._timer.start(videoOffsetMs);
    return this.playSegmentAtTime(videoOffsetMs);
  }

  /**
   * Pause at a specific time in the replay. Note that this gets called when seeking.
   */
  public pause(videoOffsetMs: number) {
    // Pause the current video
    const currentVideo = this.getOrCreateVideo(this._currentIndex);
    currentVideo?.pause();
    this._timer.stop(videoOffsetMs);

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
