import type {Theme} from '@emotion/react';
import {type eventWithTime, Replayer} from '@sentry-internal/rrweb';

import {
  VideoReplayer,
  type VideoReplayerConfig,
} from 'sentry/components/replays/videoReplayer';
import type {ClipWindow, VideoEvent} from 'sentry/utils/replays/types';

type RootElem = HTMLDivElement | null;

interface WrapperReplayerOptions {
  durationMs: number;
  onBuffer: (isBuffering: boolean) => void;
  onFinished: () => void;
  onLoaded: (event: any) => void;
  root: RootElem;
  start: number;
  theme: Theme;
  videoApiPrefix: string;
  clipWindow?: ClipWindow;
}

/**
 * A wrapper replayer that wraps both VideoReplayer and the rrweb Replayer.
 * We need both instances in order to render the video playback alongside gestures.
 */
export class WrapperReplayer {
  public config: VideoReplayerConfig = {
    skipInactive: false,
    speed: 1.0,
  };
  public iframe = {};
  public videoInst: VideoReplayer;
  public rrwebInst: Replayer;

  constructor(
    {videoEvents, events}: {events: eventWithTime[]; videoEvents: VideoEvent[]},
    {
      root,
      start,
      videoApiPrefix,
      onBuffer,
      onFinished,
      onLoaded,
      clipWindow,
      durationMs,
      theme,
    }: WrapperReplayerOptions
  ) {
    this.videoInst = new VideoReplayer(videoEvents, {
      videoApiPrefix,
      root,
      start,
      onFinished,
      onLoaded,
      onBuffer,
      clipWindow,
      durationMs,
    });

    root?.classList.add('video-replayer');

    const modifiedEvents: eventWithTime[] = [];
    events.forEach((e, idx) => {
      modifiedEvents.push(e);
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
                  id: 0,
                },
                {
                  type: 2,
                  tagName: 'html',
                  attributes: {
                    lang: 'en',
                  },
                  childNodes: [],
                  id: 0,
                },
              ],
              id: 0,
            },
            initialOffset: {
              left: 0,
              top: 0,
            },
          },
          timestamp: events[idx].timestamp,
        };
        modifiedEvents.push(fullSnapshotEvent);
      }
    });

    this.rrwebInst = new Replayer(modifiedEvents, {
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
  }

  public destroy() {
    this.videoInst.destroy();
    this.rrwebInst.destroy();
  }

  /**
   * Returns the current video time, using the video's external timer.
   */
  public getCurrentTime() {
    return this.videoInst.getCurrentTime();
  }

  /**
   * Play both the rrweb and video player.
   */
  public play(videoOffsetMs: number) {
    this.videoInst.play(videoOffsetMs);
    this.rrwebInst.play(videoOffsetMs);
  }

  /**
   * Pause both the rrweb and video player.
   */
  public pause(videoOffsetMs: number) {
    this.videoInst.pause(videoOffsetMs);
    this.rrwebInst.pause(videoOffsetMs);
  }

  /**
   * Equivalent to rrweb's `setConfig()`, but here we only support the `speed` configuration.
   */
  public setConfig(config: Partial<VideoReplayerConfig>): void {
    this.videoInst.setConfig(config);
    this.rrwebInst.setConfig(config);
  }
}
