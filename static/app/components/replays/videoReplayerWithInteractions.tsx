import type {Theme} from '@emotion/react';
import * as Sentry from '@sentry/react';
import {Replayer} from '@sentry-internal/rrweb';

import type {VideoReplayerConfig} from 'sentry/components/replays/videoReplayer';
import {VideoReplayer} from 'sentry/components/replays/videoReplayer';
import type {ClipWindow, RecordingFrame, VideoEvent} from 'sentry/utils/replays/types';

interface VideoReplayerWithInteractionsOptions {
  context: {sdkName: string | undefined | null; sdkVersion: string | undefined | null};
  durationMs: number;
  eventsWithSnapshots: RecordingFrame[];
  onBuffer: (isBuffering: boolean) => void;
  onFinished: () => void;
  onLoaded: (event: any) => void;
  root: HTMLDivElement;
  speed: number;
  start: number;
  theme: Theme;
  touchEvents: RecordingFrame[];
  videoApiPrefix: string;
  videoEvents: VideoEvent[];
  clipWindow?: ClipWindow;
}

/**
 * A wrapper replayer that wraps both VideoReplayer and the rrweb Replayer.
 * We need both instances in order to render the video playback alongside gestures.
 */
export class VideoReplayerWithInteractions {
  public config: VideoReplayerConfig;
  private videoReplayer: VideoReplayer;
  private replayer: Replayer;

  constructor({
    videoEvents,
    eventsWithSnapshots,
    touchEvents,
    root,
    start,
    videoApiPrefix,
    onBuffer,
    onFinished,
    onLoaded,
    clipWindow,
    durationMs,
    theme,
    speed,
    context,
  }: VideoReplayerWithInteractionsOptions) {
    this.config = {
      skipInactive: false,
      speed,
    };

    this.videoReplayer = new VideoReplayer(videoEvents, {
      videoApiPrefix,
      root,
      start,
      onFinished,
      onLoaded,
      onBuffer,
      clipWindow,
      durationMs,
      config: this.config,
    });

    root.classList.add('video-replayer');

    const grouped = Object.groupBy(touchEvents, (t: any) => t.data.pointerId);
    Object.values(grouped).forEach(t => {
      if (t?.length !== 2) {
        Sentry.captureMessage(
          'Mobile replay has mismatching touch start and end events',
          {
            tags: {
              sdk_name: context.sdkName,
              sdk_version: context.sdkVersion,
              touch_event_type: typeof t,
            },
          }
        );
      }
    });

    this.replayer = new Replayer(eventsWithSnapshots, {
      root,
      blockClass: 'sentry-block',
      mouseTail: {
        duration: 0.75 * 1000,
        lineCap: 'round',
        lineWidth: 2,
        strokeStyle: theme.purple200,
      },
      plugins: [],
      skipInactive: false,
      speed: this.config.speed,
    });

    this.setConfig({
      skipInactive: false,
      speed,
    });
  }

  public destroy() {
    this.videoReplayer.destroy();
    this.replayer.destroy();
  }

  /**
   * Returns the current video time, using the video's external timer.
   */
  public getCurrentTime() {
    return this.videoReplayer.getCurrentTime();
  }

  /**
   * Play both the rrweb and video player.
   */
  public play(videoOffsetMs: number) {
    this.videoReplayer.play(videoOffsetMs);
    this.replayer.play(videoOffsetMs);
  }

  /**
   * Pause both the rrweb and video player.
   */
  public pause(videoOffsetMs: number) {
    this.videoReplayer.pause(videoOffsetMs);
    this.replayer.pause(videoOffsetMs);
  }

  /**
   * Equivalent to rrweb's `setConfig()`, but here we only support the `speed` configuration.
   */
  public setConfig(config: Partial<VideoReplayerConfig>): void {
    this.videoReplayer.setConfig(config);
    this.replayer.setConfig(config);
  }
}
