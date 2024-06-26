import type {Theme} from '@emotion/react';
import {type eventWithTime, Replayer} from '@sentry-internal/rrweb';

import {
  VideoReplayer,
  type VideoReplayerConfig,
} from 'sentry/components/replays/videoReplayer';
import type {ClipWindow, VideoEvent} from 'sentry/utils/replays/types';

type RootElem = HTMLDivElement | null;

interface VideoReplayerWithInteractionsOptions {
  durationMs: number;
  events: eventWithTime[];
  onBuffer: (isBuffering: boolean) => void;
  onFinished: () => void;
  onLoaded: (event: any) => void;
  root: RootElem;
  speed: number;
  start: number;
  theme: Theme;
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
    events,
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

    root?.classList.add('video-replayer');

    const eventsWithSnapshots: eventWithTime[] = [];
    events.forEach(e => {
      eventsWithSnapshots.push(e);
      if (e.type === 4) {
        // Create a mock full snapshot event, in order to render rrweb gestures properly
        // Need to add one for every meta event we see
        // The hardcoded data.node.id here should match the ID of the data being sent
        // in the `positions` arrays
        const fullSnapshotEvent = {
          type: 2,
          data: {
            node: {
              type: 0,
              childNodes: [
                {
                  type: 1,
                  name: 'html',
                  publicId: '',
                  systemId: '',
                },
                {
                  type: 2,
                  tagName: 'html',
                  attributes: {
                    lang: 'en',
                  },
                  childNodes: [],
                },
              ],
              id: 0,
            },
          },
          timestamp: e.timestamp,
        };
        eventsWithSnapshots.push(fullSnapshotEvent);
      }
    });

    this.replayer = new Replayer(eventsWithSnapshots, {
      root: root as Element,
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
