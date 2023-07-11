import * as Sentry from '@sentry/react';
import memoize from 'lodash/memoize';
import {duration} from 'moment';

import type {Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import domId from 'sentry/utils/domId';
import localStorageWrapper from 'sentry/utils/localStorage';
import extractDomNodes from 'sentry/utils/replays/extractDomNodes';
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
import {
  breadcrumbFactory,
  replayTimestamps,
  spansFactory,
} from 'sentry/utils/replays/replayDataUtils';
import splitAttachmentsByType from 'sentry/utils/replays/splitAttachmentsByType';
import type {
  BreadcrumbFrame,
  ErrorFrame,
  MemoryFrame,
  MultiClickFrame,
  OptionFrame,
  RecordingFrame,
  SpanFrame,
} from 'sentry/utils/replays/types';
import type {
  MemorySpan,
  NetworkSpan,
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplayRecord,
  ReplaySpan,
} from 'sentry/views/replays/types';

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

type RequiredNotNull<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

const sortFrames = (a, b) => a.timestampMs - b.timestampMs;

export default class ReplayReader {
  static factory({attachments, errors, replayRecord}: ReplayReaderParams) {
    if (!attachments || !replayRecord || !errors) {
      return null;
    }

    try {
      return new ReplayReader({attachments, errors, replayRecord});
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
      });
    }
  }

  private constructor({
    attachments,
    errors,
    replayRecord,
  }: RequiredNotNull<ReplayReaderParams>) {
    this._cacheKey = domId('replayReader-');

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
    this.replayRecord = replayRecord;
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
      breadcrumbFrames
    ).sort(sortFrames);
    // Spans must be sorted so components like the Timeline and Network Chart
    // can have an easier time to render.
    this._sortedSpanFrames = hydrateSpans(replayRecord, spanFrames).sort(sortFrames);
    this._optionFrame = optionFrame;

    // Insert extra records to satisfy minimum requirements for the UI
    this._sortedBreadcrumbFrames.push(replayInitBreadcrumb(replayRecord));
    this._sortedRRWebEvents.unshift(recordingStartFrame(replayRecord));
    this._sortedRRWebEvents.push(recordingEndFrame(replayRecord));

    /*********************/
    /** OLD STUFF BELOW **/
    /*********************/
    const {rawBreadcrumbs, rawRRWebEvents, rawNetworkSpans, rawMemorySpans} =
      splitAttachmentsByType(attachments);

    const spans = [...rawMemorySpans, ...rawNetworkSpans] as ReplaySpan[];

    // TODO(replays): We should get correct timestamps from the backend instead
    // of having to fix them up here.
    const {startTimestampMs, endTimestampMs} = replayTimestamps(
      replayRecord,
      rawRRWebEvents as RecordingEvent[],
      rawBreadcrumbs as ReplayCrumb[],
      spans
    );
    replayRecord.started_at = new Date(startTimestampMs);
    replayRecord.finished_at = new Date(endTimestampMs);
    replayRecord.duration = duration(
      replayRecord.finished_at.getTime() - replayRecord.started_at.getTime()
    );

    this.rawErrors = errors;

    this.sortedSpans = spansFactory(spans);
    this.breadcrumbs = breadcrumbFactory(
      replayRecord,
      errors,
      rawBreadcrumbs as ReplayCrumb[],
      this.sortedSpans
    );

    this.replayRecord = replayRecord;
  }

  public timestampDeltas = {startedAtDelta: 0, finishedAtDelta: 0};

  private _cacheKey: string;
  private _errors: ErrorFrame[];
  private _optionFrame: undefined | OptionFrame;
  private _sortedBreadcrumbFrames: BreadcrumbFrame[];
  private _sortedRRWebEvents: RecordingFrame[];
  private _sortedSpanFrames: SpanFrame[];

  private rawErrors: ReplayError[];
  private sortedSpans: ReplaySpan[];
  private replayRecord: ReplayRecord;
  private breadcrumbs: Crumb[];

  toJSON = () => this._cacheKey;

  /**
   * @returns Duration of Replay (milliseonds)
   */
  getDurationMs = () => {
    return this.replayRecord.duration.asMilliseconds();
  };

  getReplay = () => {
    return this.replayRecord;
  };

  getRRWebFrames = () => this._sortedRRWebEvents;

  getErrorFrames = () => this._errors;

  getConsoleFrames = memoize(() =>
    this._sortedBreadcrumbFrames.filter(frame => frame.category === 'console')
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

  getDOMFrames = memoize(() => [
    ...this._sortedBreadcrumbFrames.filter(frame => 'nodeId' in (frame.data ?? {})),
    ...this._sortedSpanFrames.filter(frame => 'nodeId' in (frame.data ?? {})),
  ]);

  getDomNodes = memoize(() =>
    extractDomNodes({
      frames: this.getDOMFrames(),
      rrwebEvents: this.getRRWebFrames(),
      finishedAt: this.replayRecord.finished_at,
    })
  );

  getMemoryFrames = memoize(() =>
    this._sortedSpanFrames.filter((frame): frame is MemoryFrame => frame.op === 'memory')
  );

  getChapterFrames = memoize(() =>
    [
      ...this._sortedBreadcrumbFrames.filter(
        frame =>
          [
            'replay.init',
            'ui.click',
            'replay.mutations',
            'ui.slowClickDetected',
            'navigation',
          ].includes(frame.category) ||
          (frame.category === 'ui.multiClick' &&
            (frame as MultiClickFrame).data.clickCount >= 3)
      ),
      ...this._sortedSpanFrames.filter(frame =>
        ['navigation.navigate', 'navigation.reload', 'navigation.back_forward'].includes(
          frame.op
        )
      ),
      ...this._errors,
    ].sort(sortFrames)
  );

  getTimelineFrames = memoize(() =>
    [
      ...this._sortedBreadcrumbFrames.filter(frame =>
        ['replay.init', 'ui.click'].includes(frame.category)
      ),
      ...this._sortedSpanFrames.filter(frame =>
        ['navigation.navigate', 'navigation.reload'].includes(frame.op)
      ),
      ...this._errors,
    ].sort(sortFrames)
  );

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

  /*********************/
  /** OLD STUFF BELOW **/
  /*********************/
  getCrumbsWithRRWebNodes = memoize(() =>
    this.breadcrumbs.filter(
      crumb => crumb.data && typeof crumb.data === 'object' && 'nodeId' in crumb.data
    )
  );

  getUserActionCrumbs = memoize(() => {
    const USER_ACTIONS = [
      BreadcrumbType.ERROR,
      BreadcrumbType.INIT,
      BreadcrumbType.NAVIGATION,
      BreadcrumbType.UI,
      BreadcrumbType.USER,
    ];
    return this.breadcrumbs.filter(crumb => USER_ACTIONS.includes(crumb.type));
  });

  getConsoleCrumbs = memoize(() =>
    this.breadcrumbs.filter(crumb => crumb.category === 'console')
  );

  getRawErrors = memoize(() => this.rawErrors);

  getIssueCrumbs = memoize(() =>
    this.breadcrumbs.filter(crumb => crumb.category === 'issue')
  );

  getNonConsoleCrumbs = memoize(() =>
    this.breadcrumbs.filter(crumb => crumb.category !== 'console')
  );

  getNavCrumbs = memoize(() =>
    this.breadcrumbs.filter(crumb =>
      [BreadcrumbType.INIT, BreadcrumbType.NAVIGATION].includes(crumb.type)
    )
  );

  getNetworkSpans = memoize(() => this.sortedSpans.filter(isNetworkSpan));

  getMemorySpans = memoize(() => this.sortedSpans.filter(isMemorySpan));
}

const isMemorySpan = (span: ReplaySpan): span is MemorySpan => {
  return span.op === 'memory';
};

const isNetworkSpan = (span: ReplaySpan): span is NetworkSpan => {
  return span.op?.startsWith('navigation.') || span.op?.startsWith('resource.');
};
