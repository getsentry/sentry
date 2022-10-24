import {duration} from 'moment';

import type {Crumb} from 'sentry/types/breadcrumbs';
import {
  breadcrumbFactory,
  getBreadcrumbsByCategory,
  isMemorySpan,
  isNetworkSpan,
  replayTimestamps,
  rrwebEventListFactory,
  spansFactory,
} from 'sentry/utils/replays/replayDataUtils';
import type {
  MemorySpanType,
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplayRecord,
  ReplaySpan,
} from 'sentry/views/replays/types';

interface ReplayReaderParams {
  breadcrumbs: ReplayCrumb[] | undefined;
  errors: ReplayError[] | undefined;

  /**
   * The root Replay event, created at the start of the browser session.
   */
  replayRecord: ReplayRecord | undefined;

  /**
   * The captured data from rrweb.
   * Saved as N attachments that belong to the root Replay event.
   */
  rrwebEvents: RecordingEvent[] | undefined;

  spans: ReplaySpan[] | undefined;
}

type RequiredNotNull<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

export default class ReplayReader {
  static factory({
    breadcrumbs,
    replayRecord,
    errors,
    rrwebEvents,
    spans,
  }: ReplayReaderParams) {
    if (!breadcrumbs || !replayRecord || !rrwebEvents || !spans || !errors) {
      return null;
    }

    return new ReplayReader({breadcrumbs, replayRecord, errors, rrwebEvents, spans});
  }

  private constructor({
    breadcrumbs,
    replayRecord,
    errors,
    rrwebEvents,
    spans,
  }: RequiredNotNull<ReplayReaderParams>) {
    // TODO(replays): We should get correct timestamps from the backend instead
    // of having to fix them up here.
    const {startTimestampMs, endTimestampMs} = replayTimestamps(
      replayRecord,
      rrwebEvents,
      breadcrumbs,
      spans
    );
    replayRecord.startedAt = new Date(startTimestampMs);
    replayRecord.finishedAt = new Date(endTimestampMs);
    replayRecord.duration = duration(
      replayRecord.finishedAt.getTime() - replayRecord.startedAt.getTime()
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
