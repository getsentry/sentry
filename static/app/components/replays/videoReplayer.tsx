import {Timer} from 'sentry/utils/replays/timer';
import type {ClipWindow, VideoEvent} from 'sentry/utils/replays/types';

import {findVideoSegmentIndex} from './utils';

// The number of segments to load on either side of the requested segment (around 15 seconds)
// Also the number of segments we load initially
const PRELOAD_BUFFER = 3;

interface OffsetOptions {
  segmentOffsetMs?: number;
}

interface VideoReplayerOptions {
  config: VideoReplayerConfig;
  durationMs: number;
  onBuffer: (isBuffering: boolean) => void;
  onFinished: () => void;
  onLoaded: (event: any) => void;
  root: HTMLDivElement;
  start: number;
  videoApiPrefix: string;
  clipWindow?: ClipWindow;
}

export interface VideoReplayerConfig {
  /**
   * Not supported, only here to maintain compat w/ rrweb player
   */
  skipInactive: false;
  /**
   * Video playback speed
   */
  speed: number;
}

type RemoveListener = () => void;

/**
 * A special replayer that is specific to mobile replays. Should replicate rrweb's player interface.
 */
export class VideoReplayer {
  private _attachments: VideoEvent[];
  private _callbacks: Record<string, (args?: any) => unknown>;
  private _currentIndex: number | undefined;
  private _startTimestamp: number;
  private _timer = new Timer();
  private _trackList: Array<[ts: number, index: number]>;
  private _isPlaying: boolean = false;
  private _listeners: RemoveListener[] = [];
  /**
   * Maps attachment index to the video element.
   * Video elements in this dict are preloaded and ready to be played.
   */
  private _videos: Map<any, HTMLVideoElement>;
  private _videoApiPrefix: string;
  private _clipDuration: number | undefined;
  private _durationMs: number;
  public config: VideoReplayerConfig;
  public wrapper: HTMLElement;
  public iframe = {};

  constructor(
    attachments: VideoEvent[],
    {
      root,
      start,
      videoApiPrefix,
      onBuffer,
      onFinished,
      onLoaded,
      clipWindow,
      durationMs,
      config,
    }: VideoReplayerOptions
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
    this._videos = new Map<any, HTMLVideoElement>();
    this._clipDuration = undefined;
    this._durationMs = durationMs;
    this.config = config;

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'video-replayer-wrapper';
    root.appendChild(this.wrapper);

    this._trackList = this._attachments.map(({timestamp}, i) => [timestamp, i]);

    if (clipWindow) {
      // Set max duration on the timer
      this._clipDuration = clipWindow.endTimestampMs - clipWindow.startTimestampMs;

      // If there's a clip window set, load the segment at the clip start
      const clipStartOffset = clipWindow.startTimestampMs - start;
      this.loadSegmentAtTime(clipStartOffset);

      // Some logic in `loadSegmentAtTime` depends on the real video start time
      // So only set the new startTimestamp here
      this._startTimestamp = clipWindow.startTimestampMs;

      // Tell the timer to stop at the clip end
      this._timer.addNotificationAtTime(this._clipDuration, () => {
        this.stopReplay();
      });
    } else {
      // Tell the timer to stop at the replay end
      this._timer.addNotificationAtTime(this._durationMs, () => {
        this.stopReplay();
      });
      // If there's no clip window set, we should
      // load the first segment by default so that users are not staring at a
      // blank replay. This initially caused some issues
      // (https://github.com/getsentry/sentry/pull/67911), but the problem was
      // due to the logic around our timers and the assumption that we were
      // always hiding the video at the previous index, and not the video that
      // was previously displayed, e.g. when you "restart" a replay.
      this.loadSegment(0);
    }
  }

  public destroy() {
    this._listeners.forEach(listener => listener());
    this._trackList = [];
    this._videos = new Map<any, HTMLVideoElement>();
    this._timer.stop();
    this.wrapper.remove();
  }

  private addListeners(el: HTMLVideoElement, index: number): void {
    const handleEnded = () => this.handleSegmentEnd(index);

    const handleLoadedData = (event: any) => {
      // Used to correctly set the dimensions of the first frame
      if (index === 0) {
        this._callbacks.onLoaded!(event);
      }

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
    };

    const handlePlay = (event: any) => {
      if (index === this._currentIndex) {
        this._callbacks.onLoaded!(event);
      }
    };

    const handleLoadedMetaData = (event: any) => {
      // Only call this for current segment?
      if (index === this._currentIndex) {
        // Theoretically we could have different orientations and they should
        // only happen in different segments
        this._callbacks.onLoaded!(event);
      }
    };

    const handleSeeking = (event: any) => {
      // Centers the video when seeking (and video is not playing)
      // Only call this for the segment that's being seeked to
      if (index === this._currentIndex) {
        this._callbacks.onLoaded!(event);
      }
    };

    el.addEventListener('ended', handleEnded);
    el.addEventListener('loadeddata', handleLoadedData);
    el.addEventListener('play', handlePlay);
    el.addEventListener('loadedmetadata', handleLoadedMetaData);
    el.addEventListener('seeking', handleSeeking);

    this._listeners.push(() => {
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('loadeddata', handleLoadedData);
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('loadedmetadata', handleLoadedMetaData);
      el.removeEventListener('seeking', handleSeeking);
    });
  }

  private createVideo(segmentData: VideoEvent, index: number) {
    const el = document.createElement('video');
    const sourceEl = document.createElement('source');
    el.style.display = 'none';
    el.style.zIndex = index.toString();
    el.style.position = 'absolute';
    sourceEl.setAttribute('type', 'video/mp4');
    sourceEl.setAttribute('src', `${this._videoApiPrefix}${segmentData.id}/`);
    el.setAttribute('muted', '');
    el.setAttribute('playinline', '');
    el.setAttribute('preload', 'auto');
    el.setAttribute('playbackRate', `${this.config.speed}`);
    el.appendChild(sourceEl);

    this.addListeners(el, index);

    // Append the video element to the mobile player wrapper element
    this.wrapper.appendChild(el);

    return el;
  }

  /**
   * Resume timer only if replay is running. This accounts for
   * playing through "dead air". This is used only in `setBuffering`.
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
  private pauseTimer(videoOffsetMs?: number | undefined) {
    // This is valid to run when replay is not playing (seeking to
    // a place in the replay). Due to ReplayContext and maintaining
    // compatibility with rrweb player, we need to update the time
    // in the timer, as that will get passed into `play()` when we
    // press the play button.
    //
    // This supports the case where we load the replay, seek, and
    // then play.
    if (videoOffsetMs !== undefined) {
      this._timer.setTime(videoOffsetMs);
    }

    if (!this._isPlaying) {
      return;
    }

    this._timer.stop();
  }

  private startReplay(videoOffsetMs: number) {
    this._isPlaying = true;
    this._timer.start(videoOffsetMs);

    // This is used when a replay is restarted
    // Add another stop notification so the timer doesn't run over
    this._timer.addNotificationAtTime(
      this._clipDuration ? this._clipDuration : this._durationMs,
      () => {
        this.stopReplay();
      }
    );
  }

  /**
   * This is called when we want to pause the timer. This can be
   * called when replay is *and* is not running (e.g. seeking while
   * stopped). We need to update the timer with offset in this case.
   */
  private pauseReplay(videoOffsetMs: number | undefined) {
    this.pauseTimer(videoOffsetMs);
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

    this._callbacks.onBuffer!(isBuffering);
  }

  private stopReplay() {
    this._timer.stop();
    this._callbacks.onFinished!();
    this._isPlaying = false;
  }

  /**
   * Called when a video finishes playing, so that it can proceed
   * to the next video
   */
  private async handleSegmentEnd(index: number): Promise<void> {
    const nextIndex = index + 1;

    // No more segments
    if (nextIndex >= this._attachments.length) {
      if (this.getCurrentTime() < this._durationMs) {
        // If we're at the end of a segment, but there's a gap
        // at the end, force the replay to play until the end duration
        // rather than stopping right away.
        this._timer.addNotificationAtTime(this._durationMs, () => {
          this.stopReplay();
        });
        return;
      }
      this.stopReplay();
    }

    // Final check in case replay was stopped immediately after a video
    if (!this._isPlaying) {
      return;
    }

    const loadedSegmentIndex = await this.loadSegment(nextIndex, {segmentOffsetMs: 0});

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
   * Create videos from a slice of _attachments, given the start and end index.
   */
  protected preloadVideos({low, high}: {high: number; low: number}) {
    // Make sure we don't go out of bounds
    const l = Math.max(0, low);
    const h = Math.min(high, this._attachments.length + 1);

    return this._attachments.slice(l, h).forEach((attachment, index) => {
      const dictIndex = index + l;

      // Might be some videos we've already loaded before
      if (!this._videos.get(dictIndex)) {
        this._videos.set(dictIndex, this.createVideo(attachment, dictIndex));
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

    return this._videos.get(index);
  }

  /**
   * Shows the video -- it is assumed that it is preloaded. Also
   * hides all other videos, otherwise there will
   * be multiple video elements stacked on top of each other.
   */
  protected showVideo(nextVideo: HTMLVideoElement | undefined): void {
    if (!nextVideo) {
      return;
    }

    for (const [index, videoElem] of this._videos) {
      // On safari, some clips have a ~1 second gap in the beginning so we also need to show the previous video to hide this gap
      // Edge case: Don't show previous video if size is different (eg. orientation changes)
      if (
        index === (this._currentIndex || 0) - 1 &&
        videoElem.videoHeight === nextVideo.videoHeight &&
        videoElem.videoWidth === nextVideo.videoWidth
      ) {
        if (videoElem.duration) {
          // we need to set the previous video to the end so that it's shown in case the next video has a gap at the beginning
          // setting it to the end of the video causes the 'ended' bug in Chrome so we set it to 1 ms before the video ends
          this.setVideoTime(videoElem, videoElem.duration * 1000 - 1);
        }
        videoElem.style.display = 'block';
      }
      // hides all videos because videos have a different z-index depending on their index
      else {
        videoElem.style.display = 'none';
        // resets the other videos to the beginning if it's ended so it starts from the beginning on restart
        if (videoElem.ended) {
          this.setVideoTime(videoElem, 0);
        }
      }
    }

    nextVideo.style.display = 'block';
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
    // If 'ended' is true, the current time will be overwritten to 0 after hitting play.
    // Setting currentTime will cause a side-effect of resetting 'ended' to false.
    // The additional assignment of currentTime is required to make sure ended is reset before we assign the actual currentTime
    if (video.ended && timeMs > 0) {
      // we set it to 1ms before to reduce flickering
      video.currentTime = (timeMs - 1) / 1000;
    }

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
   * Loads a segment based on the video offset (all of the segments
   * concatenated together). Finds the proper segment to load based on each
   * segment's timestamp and duration. Displays the closest prior segment if
   * offset exists in a gap where there is no recorded segment.
   */
  protected async loadSegmentAtTime(
    videoOffsetMs: number = 0
  ): Promise<number | undefined> {
    if (!this._trackList.length) {
      return undefined;
    }

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

      // XXX: Note that loading the previous segment will require waiting for
      // it to be loaded before it "plays" through the gap. Some future
      // improvements can be made here. (e.g. do we play through gaps at all?
      // should it skip buffering state?)

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
      // If we end up here, we seeked into a gap
      // at the end of the replay.
      // This tells the timer to stop at the specified duration
      // and prevents the timer from running infinitely.
      this._timer.addNotificationAtTime(this._durationMs, () => {
        this.stopReplay();
      });
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
   * Pause at a specific time in the replay. Note that this gets
   * called when seeking while video is not playing.
   */
  public pause(videoOffsetMs: number) {
    const index = this._currentIndex ?? 0;
    this.pauseReplay(videoOffsetMs);

    // Preload videos before and after this index
    this.preloadVideos({
      low: index - PRELOAD_BUFFER,
      high: index + PRELOAD_BUFFER,
    });

    // Pause the old video
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
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        this.config[key] = value;
      });

    if (config.speed !== undefined) {
      const currentVideo = this.getVideo(this._currentIndex);

      if (!currentVideo) {
        return;
      }
      currentVideo.playbackRate = this.config.speed;
      this._timer.setSpeed(this.config.speed);
    }
  }
}
