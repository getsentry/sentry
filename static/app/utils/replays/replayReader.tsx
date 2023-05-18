import * as Sentry from '@sentry/react';
import memoize from 'lodash/memoize';
import {duration} from 'moment';

import type {Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {
  breadcrumbFactory,
  replayTimestamps,
  rrwebEventListFactory,
  spansFactory,
} from 'sentry/utils/replays/replayDataUtils';
import splitAttachmentsByType from 'sentry/utils/replays/splitAttachmentsByType';
import type {
  MemorySpan,
  NetworkSpan,
  RecordingEvent,
  RecordingOptions,
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
  errors: ReplayError[] | undefined;

  /**
   * The root Replay event, created at the start of the browser session.
   */
  replayRecord: ReplayRecord | undefined;
}

type RequiredNotNull<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

export default class ReplayReader {
  static factory({attachments, replayRecord, errors}: ReplayReaderParams) {
    if (!attachments || !replayRecord || !errors) {
      return null;
    }

    try {
      return new ReplayReader({attachments, replayRecord, errors});
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
    replayRecord,
    errors,
  }: RequiredNotNull<ReplayReaderParams>) {
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

    this.sortedSpans = spansFactory(spans);
    this.breadcrumbs = breadcrumbFactory(
      replayRecord,
      errors,
      rawBreadcrumbs as ReplayCrumb[],
      this.sortedSpans
    );
    this.rrwebEvents = rrwebEventListFactory(
      replayRecord,
      rawRRWebEvents as RecordingEvent[]
    );

    this.replayRecord = replayRecord;
  }

  private sortedSpans: ReplaySpan[];
  private replayRecord: ReplayRecord;
  private rrwebEvents: RecordingEvent[];
  private breadcrumbs: Crumb[];

  /**
   * @returns Duration of Replay (milliseonds)
   */
  getDurationMs = () => {
    return this.replayRecord.duration.asMilliseconds();
  };

  getReplay = () => {
    return this.replayRecord;
  };

  getRRWebEvents = () => {
    return this.rrwebEvents;
  };

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
    this.breadcrumbs.filter(crumb => ['console', 'issue'].includes(crumb.category || ''))
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

  sdkConfig = memoize(() => {
    const found = this.rrwebEvents.find(
      event => event.type === 5 && event.data.tag === 'options'
    ) as undefined | RecordingOptions;
    return found?.data?.payload;
  });

  isNetworkDetailsSetup = memoize(() => {
    const config = this.sdkConfig();
    if (config) {
      return this.sdkConfig()?.networkDetailHasUrls;
    }

    // Network data was added in JS SDK 7.50.0 while sdkConfig was added in v7.51.1
    // So even if we don't have the config object, we should still fallback and
    // look for spans with network data, as that means things are setup!
    return this.getNetworkSpans().some(
      span =>
        Object.keys(span.data.request?.headers || {}).length ||
        Object.keys(span.data.response?.headers || {}).length
    );
  });
}

const isMemorySpan = (span: ReplaySpan): span is MemorySpan => {
  return span.op === 'memory';
};

const isNetworkSpan = (span: ReplaySpan): span is NetworkSpan => {
  return span.op?.startsWith('navigation.') || span.op?.startsWith('resource.');
};
