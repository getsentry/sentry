import * as Sentry from '@sentry/react';
import {incrementalSnapshotEvent, IncrementalSource} from '@sentry-internal/rrweb';
import memoize from 'lodash/memoize';
import {duration} from 'moment';

import {defined} from 'sentry/utils';
import domId from 'sentry/utils/domId';
import localStorageWrapper from 'sentry/utils/localStorage';
import hydrateBreadcrumbs, {
  replayInitBreadcrumb,
} from 'sentry/utils/replays/hydrateBreadcrumbs';
import hydrateErrors from 'sentry/utils/replays/hydrateErrors';
import hydrateFrames from 'sentry/utils/replays/hydrateFrames';
import {
  recordingEndFrame,
  recordingStartFrame,
} from 'sentry/utils/replays/hydrateRRWebRecordingFrames';
import hydrateSpans from 'sentry/utils/replays/hydrateSpans';
import {replayTimestamps} from 'sentry/utils/replays/replayDataUtils';
import type {
  BreadcrumbFrame,
  ErrorFrame,
  MemoryFrame,
  OptionFrame,
  RecordingFrame,
  SlowClickFrame,
  SpanFrame,
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
}

interface Options {
  showHydrationErrors?: boolean;
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

export default class ReplayReader {
  static factory(
    {attachments, errors, replayRecord}: ReplayReaderParams,
    options: Options
  ) {
    if (!attachments || !replayRecord || !errors) {
      return null;
    }

    try {
      return new ReplayReader({attachments, errors, replayRecord}, options);
    } catch (err) {
      Sentry.captureException(err);

      // If something happens then we don't really know if it's the attachments
      // array or errors array to blame (it's probably attachments though).
      // Either way we can use the replayRecord to show some metadata, and then
      // put an error message below it.
      return new ReplayReader(
        {
          attachments: [],
          errors: [],
          replayRecord,
        },
        options
      );
    }
  }

  private constructor(
    {attachments, errors, replayRecord}: RequiredNotNull<ReplayReaderParams>,
    options: Options
  ) {
    this._options = options;
    this._cacheKey = domId('replayReader-');

    if (replayRecord.is_archived) {
      this._replayRecord = replayRecord;
      const archivedReader = new Proxy(this, {
        get(_target, prop, _receiver) {
          if (prop === '_replayRecord') {
            return replayRecord;
          }
          return () => {};
        },
      });
      return archivedReader;
    }

    const {breadcrumbFrames, optionFrame, rrwebFrames, spanFrames} =
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
    this._errors = hydrateErrors(replayRecord, errors).sort(sortFrames);
    // RRWeb Events are not sorted here, they are fetched in sorted order.
    this._sortedRRWebEvents = rrwebFrames;
    // Breadcrumbs must be sorted. Crumbs like `slowClick` and `multiClick` will
    // have the same timestamp as the click breadcrumb, but will be emitted a
    // few seconds later.
    this._sortedBreadcrumbFrames = hydrateBreadcrumbs(
      replayRecord,
      breadcrumbFrames,
      this._sortedRRWebEvents
    ).sort(sortFrames);
    // Spans must be sorted so components like the Timeline and Network Chart
    // can have an easier time to render.
    this._sortedSpanFrames = hydrateSpans(replayRecord, spanFrames).sort(sortFrames);
    this._optionFrame = optionFrame;

    // Insert extra records to satisfy minimum requirements for the UI
    this._sortedBreadcrumbFrames.push(replayInitBreadcrumb(replayRecord));
    this._sortedRRWebEvents.unshift(recordingStartFrame(replayRecord));
    this._sortedRRWebEvents.push(recordingEndFrame(replayRecord));
  }

  public timestampDeltas = {startedAtDelta: 0, finishedAtDelta: 0};

  private _options: Options;
  private _cacheKey: string;
  private _errors: ErrorFrame[] = [];
  private _optionFrame: undefined | OptionFrame;
  private _replayRecord: ReplayRecord;
  private _sortedBreadcrumbFrames: BreadcrumbFrame[] = [];
  private _sortedRRWebEvents: RecordingFrame[] = [];
  private _sortedSpanFrames: SpanFrame[] = [];

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

  /**
   * @returns Duration of Replay (milliseonds)
   */
  getDurationMs = () => {
    return this._replayRecord.duration.asMilliseconds();
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
    [
      ...this.getPerfFrames(),
      ...this._sortedBreadcrumbFrames.filter(
        frame =>
          ['replay.init', 'replay.mutations'].includes(frame.category) ||
          (this._options.showHydrationErrors && frame.category === 'replay.hydrate-error')
      ),
      ...this._errors,
    ].sort(sortFrames)
  );

  // TODO(session-replay-show-hydration-errors): remove this on GA
  getHydrationFrames = () =>
    this._sortedBreadcrumbFrames.filter(
      frame => frame.category === 'replay.hydrate-error'
    );

  getPerfFrames = memoize(() =>
    [
      ...removeDuplicateClicks(
        this._sortedBreadcrumbFrames.filter(
          frame =>
            ['navigation', 'ui.click'].includes(frame.category) ||
            (frame.category === 'ui.slowClickDetected' &&
              (isDeadClick(frame as SlowClickFrame) ||
                isDeadRageClick(frame as SlowClickFrame)))
        )
      ),
      ...this._sortedSpanFrames.filter(frame => frame.op.startsWith('navigation.')),
    ].sort(sortFrames)
  );

  getLPCFrames = memoize(() => this._sortedSpanFrames.filter(isLCPFrame));

  getPaintFrames = memoize(() => this._sortedSpanFrames.filter(isPaintFrame));

  getSDKOptions = () => this._optionFrame;

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
