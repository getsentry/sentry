import * as Sentry from '@sentry/react';
import memoize from 'lodash/memoize';
import {duration} from 'moment';

import type {Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {
  breadcrumbFactory,
  isMemorySpan,
  isNetworkSpan,
  mapRRWebAttachments,
  replayTimestamps,
  rrwebEventListFactory,
  spansFactory,
} from 'sentry/utils/replays/replayDataUtils';
import type {
  RecordingEvent,
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
    const {breadcrumbs, rrwebEvents, spans} = mapRRWebAttachments(attachments);

    // TODO(replays): We should get correct timestamps from the backend instead
    // of having to fix them up here.
    const {startTimestampMs, endTimestampMs} = replayTimestamps(
      replayRecord,
      rrwebEvents,
      breadcrumbs,
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
      breadcrumbs,
      this.sortedSpans
    );
    this.rrwebEvents = rrwebEventListFactory(replayRecord, rrwebEvents);

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

  isNetworkDetailsSetup = memoize(() =>
    this.getNetworkSpans().some(
      span =>
        Object.keys(span.data.request?.headers || {}).length ||
        Object.keys(span.data.response?.headers || {}).length
    )
  );
}
