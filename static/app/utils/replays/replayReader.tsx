import * as Sentry from '@sentry/react';
import type {incrementalSnapshotEvent} from '@sentry-internal/rrweb';
import {IncrementalSource} from '@sentry-internal/rrweb';
import memoize from 'lodash/memoize';
import {type Duration, duration} from 'moment';

import {defined} from 'sentry/utils';
import domId from 'sentry/utils/domId';
import localStorageWrapper from 'sentry/utils/localStorage';
import clamp from 'sentry/utils/number/clamp';
import hydrateBreadcrumbs, {
  replayInitBreadcrumb,
} from 'sentry/utils/replays/hydrateBreadcrumbs';
import hydrateErrors from 'sentry/utils/replays/hydrateErrors';
import hydrateFrames from 'sentry/utils/replays/hydrateFrames';
import {
  clipEndFrame,
  recordingEndFrame,
  recordingStartFrame,
} from 'sentry/utils/replays/hydrateRRWebRecordingFrames';
import hydrateSpans from 'sentry/utils/replays/hydrateSpans';
import {replayTimestamps} from 'sentry/utils/replays/replayDataUtils';
import type {
  BreadcrumbFrame,
  ClipWindow,
  ErrorFrame,
  fullSnapshotEvent,
  MemoryFrame,
  OptionFrame,
  RecordingFrame,
  serializedNodeWithId,
  SlowClickFrame,
  SpanFrame,
  VideoEvent,
} from 'sentry/utils/replays/types';
import {
  BreadcrumbCategories,
  EventType,
  isDeadClick,
  isDeadRageClick,
  isLCPFrame,
  isPaintFrame,
} from 'sentry/utils/replays/types';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

interface ReplayReaderParams {
  /**
   * Loaded segment data
   *
   * This is a mix of rrweb data, breadcrumbs and spans/transactions sorted by time
   * All three types are mixed together.
   */
  attachments: unknown[] | undefined;

  /**
   * Error objects related to this replay
   *
   * Error instances could be frontend, backend, or come from the error platform
   * like performance-errors or replay-errors
   */
  errors: ReplayError[] | undefined;

  /**
   * The root Replay event, created at the start of the browser session.
   */
  replayRecord: ReplayRecord | undefined;

  /**
   * If provided, the replay will be clipped to this window.
   */
  clipWindow?: ClipWindow;
}

type RequiredNotNull<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

const sortFrames = (a, b) => a.timestampMs - b.timestampMs;

function removeDuplicateClicks(frames: BreadcrumbFrame[]) {
  const slowClickFrames = frames.filter(
    frame => frame.category === 'ui.slowClickDetected'
  );

  const clickFrames = frames.filter(frame => frame.category === 'ui.click');

  const otherFrames = frames.filter(
    frame => !(slowClickFrames.includes(frame) || clickFrames.includes(frame))
  );

  const uniqueClickFrames: BreadcrumbFrame[] = clickFrames.filter(clickFrame => {
    return !slowClickFrames.some(
      slowClickFrame =>
        slowClickFrame.data &&
        'nodeId' in slowClickFrame.data &&
        clickFrame.data &&
        'nodeId' in clickFrame.data &&
        slowClickFrame.data.nodeId === clickFrame.data.nodeId &&
        slowClickFrame.timestampMs === clickFrame.timestampMs
    );
  });

  return uniqueClickFrames.concat(otherFrames).concat(slowClickFrames);
}

// If a `navigation` crumb and `navigation.*` span happen within this timeframe,
// we'll consider them duplicates.
const DUPLICATE_NAV_THRESHOLD_MS = 2;

/**
 * Return a list of BreadcrumbFrames, where any navigation crumb is removed if
 * there is a matching navigation.* span to replace it.
 *
 * SpanFrame is preferred because they render with more specific titles.
 */
function removeDuplicateNavCrumbs(
  crumbFrames: BreadcrumbFrame[],
  spanFrames: SpanFrame[]
) {
  const navCrumbs = crumbFrames.filter(crumb => crumb.category === 'navigation');
  const otherBreadcrumbFrames = crumbFrames.filter(
    crumb => crumb.category !== 'navigation'
  );

  const navSpans = spanFrames.filter(span => span.op.startsWith('navigation.'));

  const uniqueNavCrumbs = navCrumbs.filter(
    crumb =>
      !navSpans.some(
        span => Math.abs(crumb.offsetMs - span.offsetMs) <= DUPLICATE_NAV_THRESHOLD_MS
      )
  );
  return otherBreadcrumbFrames.concat(uniqueNavCrumbs);
}

export default class ReplayReader {
  static factory({attachments, errors, replayRecord, clipWindow}: ReplayReaderParams) {
    if (!attachments || !replayRecord || !errors) {
      return null;
    }

    try {
      return new ReplayReader({attachments, errors, replayRecord, clipWindow});
    } catch (err) {
      Sentry.captureException(err);

      // If something happens then we don't really know if it's the attachments
      // array or errors array to blame (it's probably attachments though).
      // Either way we can use the replayRecord to show some metadata, and then
      // put an error message below it.
      return new ReplayReader({
        attachments: [],
        errors: [],
        replayRecord,
        clipWindow,
      });
    }
  }

  private constructor({
    attachments,
    errors,
    replayRecord,
    clipWindow,
  }: RequiredNotNull<ReplayReaderParams>) {
    this._cacheKey = domId('replayReader-');

    if (replayRecord.is_archived) {
      this._replayRecord = replayRecord;
      const archivedReader = new Proxy(this, {
        get(_target, prop, _receiver) {
          if (prop === 'getReplay') {
            return () => replayRecord;
          }
          return () => {};
        },
      });
      return archivedReader;
    }

    const {breadcrumbFrames, optionFrame, rrwebFrames, spanFrames, videoFrames} =
      hydrateFrames(attachments);

    if (localStorageWrapper.getItem('REPLAY-BACKEND-TIMESTAMPS') !== '1') {
      // TODO(replays): We should get correct timestamps from the backend instead
      // of having to fix them up here.
      const {startTimestampMs, endTimestampMs} = replayTimestamps(
        replayRecord,
        rrwebFrames,
        breadcrumbFrames,
        spanFrames
      );

      this.timestampDeltas = {
        startedAtDelta: startTimestampMs - replayRecord.started_at.getTime(),
        finishedAtDelta: endTimestampMs - replayRecord.finished_at.getTime(),
      };

      replayRecord.started_at = new Date(startTimestampMs);
      replayRecord.finished_at = new Date(endTimestampMs);
      replayRecord.duration = duration(
        replayRecord.finished_at.getTime() - replayRecord.started_at.getTime()
      );
    }

    // Hydrate the data we were given
    this._replayRecord = replayRecord;
    // Errors don't need to be sorted here, they will be merged with breadcrumbs
    // and spans in the getter and then sorted together.
    const {errorFrames, feedbackFrames} = hydrateErrors(replayRecord, errors);
    this._errors = errorFrames.sort(sortFrames);
    // RRWeb Events are not sorted here, they are fetched in sorted order.
    this._sortedRRWebEvents = rrwebFrames;
    this._videoEvents = videoFrames;
    // Breadcrumbs must be sorted. Crumbs like `slowClick` and `multiClick` will
    // have the same timestamp as the click breadcrumb, but will be emitted a
    // few seconds later.
    this._sortedBreadcrumbFrames = hydrateBreadcrumbs(
      replayRecord,
      breadcrumbFrames,
      this._sortedRRWebEvents
    )
      .concat(feedbackFrames)
      .sort(sortFrames);
    // Spans must be sorted so components like the Timeline and Network Chart
    // can have an easier time to render.
    this._sortedSpanFrames = hydrateSpans(replayRecord, spanFrames).sort(sortFrames);
    this._optionFrame = optionFrame;

    // Insert extra records to satisfy minimum requirements for the UI
    this._sortedBreadcrumbFrames.push(replayInitBreadcrumb(replayRecord));
    this._sortedRRWebEvents.unshift(recordingStartFrame(replayRecord));
    this._sortedRRWebEvents.push(recordingEndFrame(replayRecord));

    this._duration = replayRecord.duration;

    if (clipWindow) {
      this._applyClipWindow(clipWindow);
    }
  }

  public timestampDeltas = {startedAtDelta: 0, finishedAtDelta: 0};

  private _cacheKey: string;
  private _duration: Duration = duration(0);
  private _errors: ErrorFrame[] = [];
  private _optionFrame: undefined | OptionFrame;
  private _replayRecord: ReplayRecord;
  private _sortedBreadcrumbFrames: BreadcrumbFrame[] = [];
  private _sortedRRWebEvents: RecordingFrame[] = [];
  private _sortedSpanFrames: SpanFrame[] = [];
  private _startOffsetMs = 0;
  private _videoEvents: VideoEvent[] = [];
  private _clipWindow: ClipWindow | undefined = undefined;

  private _applyClipWindow = (clipWindow: ClipWindow) => {
    const clipStartTimestampMs = clamp(
      clipWindow.startTimestampMs,
      this._replayRecord.started_at.getTime(),
      this._replayRecord.finished_at.getTime()
    );
    const clipEndTimestampMs = clamp(
      clipWindow.endTimestampMs,
      clipStartTimestampMs,
      this._replayRecord.finished_at.getTime()
    );

    this._duration = duration(clipEndTimestampMs - clipStartTimestampMs);

    // For video replays, we need to bypass setting the global offset (_startOffsetMs)
    // because it messes with the playback time by causing it
    // to become negative sometimes. Instead we pass a clip window directly into
    // the video player, which runs on an external timer
    if (this.isVideoReplay()) {
      this._clipWindow = {
        startTimestampMs: clipStartTimestampMs,
        endTimestampMs: clipEndTimestampMs,
      };

      // Trim error frames and update offsets so they show inside the clip window
      // Do this in here since we bypass setting the global offset
      // Eventually when we have video breadcrumbs we'll probably need to trim them here too

      const updateVideoFrameOffsets = <T extends {offsetMs: number}>(
        frames: Array<T>
      ) => {
        const offset = clipStartTimestampMs - this._replayRecord.started_at.getTime();

        return frames.map(frame => ({
          ...frame,
          offsetMs: frame.offsetMs - offset,
        }));
      };

      this._errors = updateVideoFrameOffsets(
        this._trimFramesToClipWindow(
          this._errors,
          clipStartTimestampMs,
          clipEndTimestampMs
        )
      );

      return;
    }

    // For RRWeb frames we only trim from the end because playback will
    // not work otherwise. The start offset is used to begin playback at
    // the correct time.
    this._sortedRRWebEvents = this._sortedRRWebEvents.filter(
      frame => frame.timestamp <= clipEndTimestampMs
    );
    this._sortedRRWebEvents.push(clipEndFrame(clipEndTimestampMs));

    this._startOffsetMs = clipStartTimestampMs - this._replayRecord.started_at.getTime();

    // We also only trim from the back for breadcrumbs/spans to keep
    // historical information about the replay, such as the current URL.
    this._sortedBreadcrumbFrames = this._updateFrameOffsets(
      this._trimFramesToClipWindow(
        this._sortedBreadcrumbFrames,
        this._replayRecord.started_at.getTime(),
        clipEndTimestampMs
      )
    );
    this._sortedSpanFrames = this._updateFrameOffsets(
      this._trimFramesToClipWindow(
        this._sortedSpanFrames,
        this._replayRecord.started_at.getTime(),
        clipEndTimestampMs
      )
    );

    this._errors = this._updateFrameOffsets(
      this._trimFramesToClipWindow(this._errors, clipStartTimestampMs, clipEndTimestampMs)
    );
  };

  /**
   * Filters out frames that are outside of the supplied window
   */
  _trimFramesToClipWindow = <T extends {timestampMs: number}>(
    frames: Array<T>,
    startTimestampMs: number,
    endTimestampMs: number
  ) => {
    return frames.filter(
      frame =>
        frame.timestampMs >= startTimestampMs && frame.timestampMs <= endTimestampMs
    );
  };

  /**
   * Updates the offsetMs of all frames to be relative to the start of the clip window
   */
  _updateFrameOffsets = <T extends {offsetMs: number}>(frames: Array<T>) => {
    return frames.map(frame => ({
      ...frame,
      offsetMs: frame.offsetMs - this.getStartOffsetMs(),
    }));
  };

  toJSON = () => this._cacheKey;

  processingErrors = memoize(() => {
    return [
      this.getRRWebFrames().length < 2
        ? `Replay has ${this.getRRWebFrames().length} frames`
        : null,
      !this.getRRWebFrames().some(frame => frame.type === EventType.Meta)
        ? 'Missing Meta Frame'
        : null,
    ].filter(defined);
  });
  hasProcessingErrors = () => {
    return this.processingErrors().length;
  };

  getClipWindow = () => this._clipWindow;

  /**
   * @returns Duration of Replay (milliseonds)
   */
  getDurationMs = () => {
    return this._duration.asMilliseconds();
  };

  getStartOffsetMs = () => this._startOffsetMs;

  getStartTimestampMs = () => {
    // For video replays we bypass setting the global _startOffsetMs
    // because it messes with the player time by causing it to
    // be negative in some cases, but we still need that calculated value here
    const start =
      this.isVideoReplay() && this._clipWindow
        ? this._clipWindow?.startTimestampMs - this._replayRecord.started_at.getTime()
        : this._startOffsetMs;

    return this._replayRecord.started_at.getTime() + start;
  };

  getReplay = () => {
    return this._replayRecord;
  };

  getRRWebFrames = () => this._sortedRRWebEvents;

  getRRWebMutations = () =>
    this._sortedRRWebEvents.filter(
      event =>
        [EventType.IncrementalSnapshot].includes(event.type) &&
        [IncrementalSource.Mutation].includes(
          (event as incrementalSnapshotEvent).data.source
        ) // filter only for mutation events
    );

  getErrorFrames = () => this._errors;

  getConsoleFrames = memoize(() =>
    this._sortedBreadcrumbFrames.filter(
      frame =>
        frame.category === 'console' || !BreadcrumbCategories.includes(frame.category)
    )
  );

  getNavigationFrames = memoize(() =>
    [
      ...this._sortedBreadcrumbFrames.filter(frame => frame.category === 'replay.init'),
      ...this._sortedSpanFrames.filter(frame => frame.op.startsWith('navigation.')),
    ].sort(sortFrames)
  );

  getNetworkFrames = memoize(() =>
    this._sortedSpanFrames.filter(
      frame => frame.op.startsWith('navigation.') || frame.op.startsWith('resource.')
    )
  );

  getDOMFrames = memoize(() =>
    [
      ...removeDuplicateClicks(
        this._sortedBreadcrumbFrames
          .filter(frame => 'nodeId' in (frame.data ?? {}))
          .filter(
            frame =>
              !(
                (frame.category === 'ui.slowClickDetected' &&
                  !isDeadClick(frame as SlowClickFrame)) ||
                frame.category === 'ui.multiClick'
              )
          )
      ),
      ...this._sortedSpanFrames.filter(frame => 'nodeId' in (frame.data ?? {})),
    ].sort(sortFrames)
  );

  getMemoryFrames = memoize(() =>
    this._sortedSpanFrames.filter((frame): frame is MemoryFrame => frame.op === 'memory')
  );

  getChapterFrames = memoize(() =>
    this._trimFramesToClipWindow(
      [
        ...this.getPerfFrames(),
        ...this._sortedBreadcrumbFrames.filter(frame =>
          [
            'replay.hydrate-error',
            'replay.init',
            'replay.mutations',
            'feedback',
            'device.battery',
            'device.connectivity',
            'device.orientation',
          ].includes(frame.category)
        ),
        ...this._errors,
      ].sort(sortFrames),
      this.getStartTimestampMs(),
      this.getStartTimestampMs() + this.getDurationMs()
    )
  );

  getPerfFrames = memoize(() => {
    const crumbs = removeDuplicateClicks(
      this._sortedBreadcrumbFrames.filter(
        frame =>
          ['navigation', 'ui.click', 'ui.tap'].includes(frame.category) ||
          (frame.category === 'ui.slowClickDetected' &&
            (isDeadClick(frame as SlowClickFrame) ||
              isDeadRageClick(frame as SlowClickFrame)))
      )
    );
    const spans = this._sortedSpanFrames.filter(frame =>
      frame.op.startsWith('navigation.')
    );
    const uniqueCrumbs = removeDuplicateNavCrumbs(crumbs, spans);
    return [...uniqueCrumbs, ...spans].sort(sortFrames);
  });

  getLPCFrames = memoize(() => this._sortedSpanFrames.filter(isLCPFrame));

  getVideoEvents = () => this._videoEvents;

  getPaintFrames = memoize(() => this._sortedSpanFrames.filter(isPaintFrame));

  getSDKOptions = () => this._optionFrame;

  /**
   * Checks the replay to see if user has any canvas elements in their
   * application. Needed to inform them that we now support canvas in replays.
   */
  hasCanvasElementInReplay = memoize(() => {
    return Boolean(this._sortedRRWebEvents.filter(findCanvas).length);
  });

  isVideoReplay = memoize(() => this.getVideoEvents().length > 0);

  isNetworkDetailsSetup = memoize(() => {
    const sdkOptions = this.getSDKOptions();
    if (sdkOptions) {
      return sdkOptions.networkDetailHasUrls;
    }

    // Network data was added in JS SDK 7.50.0 while sdkConfig was added in v7.51.1
    // So even if we don't have the config object, we should still fallback and
    // look for spans with network data, as that means things are setup!
    return this.getNetworkFrames().some(
      frame =>
        // We'd need to `filter()` before calling `some()` in order for TS to be happy
        // @ts-expect-error
        Object.keys(frame?.data?.request?.headers ?? {}).length ||
        // @ts-expect-error
        Object.keys(frame?.data?.response?.headers ?? {}).length
    );
  });
}

function findCanvas(event: RecordingFrame) {
  if (event.type === EventType.FullSnapshot) {
    return findCanvasInSnapshot(event);
  }

  if (event.type === EventType.IncrementalSnapshot) {
    return findCanvasInMutation(event);
  }

  return false;
}

function findCanvasInMutation(event: incrementalSnapshotEvent) {
  if (event.data.source !== IncrementalSource.Mutation) {
    return false;
  }

  return event.data.adds.find(
    add => add.node && add.node.type === 2 && add.node.tagName === 'canvas'
  );
}

function findCanvasInChildNodes(nodes: serializedNodeWithId[]) {
  return nodes.find(
    node =>
      node.type === 2 &&
      (node.tagName === 'canvas' || findCanvasInChildNodes(node.childNodes || []))
  );
}

function findCanvasInSnapshot(event: fullSnapshotEvent) {
  if (event.data.node.type !== 0) {
    return false;
  }

  return findCanvasInChildNodes(event.data.node.childNodes);
}
