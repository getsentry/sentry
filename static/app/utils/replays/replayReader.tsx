import * as Sentry from '@sentry/react';
import {duration} from 'moment';

import type {Crumb} from 'sentry/types/breadcrumbs';
import {
  breadcrumbFactory,
  getBreadcrumbsByCategory,
  isMemorySpan,
  isNetworkSpan,
  mapRRWebAttachments,
  replayTimestamps,
  rrwebEventListFactory,
  spansFactory,
} from 'sentry/utils/replays/replayDataUtils';
import type {
  MemorySpanType,
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

    const sortedSpans = spansFactory(spans);
    this.networkSpans = sortedSpans.filter(isNetworkSpan);
    this.memorySpans = sortedSpans.filter(isMemorySpan);

    this.breadcrumbs = breadcrumbFactory(replayRecord, errors, breadcrumbs, sortedSpans);
    this.consoleCrumbs = getBreadcrumbsByCategory(this.breadcrumbs, ['console', 'issue']);

    this.rrwebEvents = rrwebEventListFactory(replayRecord, rrwebEvents);

    this.replayRecord = replayRecord;
  }

  private replayRecord: ReplayRecord;
  private rrwebEvents: RecordingEvent[];
  private breadcrumbs: Crumb[];
  private consoleCrumbs: ReturnType<typeof getBreadcrumbsByCategory>;
  private networkSpans: ReplaySpan[];
  private memorySpans: MemorySpanType[];

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

  getRawCrumbs = () => {
    return this.breadcrumbs;
  };

  getConsoleCrumbs = () => {
    return this.consoleCrumbs;
  };

  getNetworkSpans = () => {
    return this.networkSpans;
  };

  getMemorySpans = () => {
    return this.memorySpans;
  };
}
