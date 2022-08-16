import type {BreadcrumbTypeNavigation, Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Event, EventTransaction} from 'sentry/types/event';
import {
  breadcrumbFactory,
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
  event: Event | undefined;

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
  static factory({breadcrumbs, event, errors, rrwebEvents, spans}: ReplayReaderParams) {
    if (!breadcrumbs || !event || !rrwebEvents || !spans || !errors) {
      return null;
    }

    return new ReplayReader({breadcrumbs, event, errors, rrwebEvents, spans});
  }

  private constructor({
    breadcrumbs,
    event,
    errors,
    rrwebEvents,
    spans,
  }: RequiredNotNull<ReplayReaderParams>) {
    const {startTimestampMs, endTimestampMs} = replayTimestamps(
      rrwebEvents,
      breadcrumbs,
      spans
    );

    this.spans = spansFactory(spans);
    this.breadcrumbs = breadcrumbFactory(
      startTimestampMs,
      event,
      errors,
      breadcrumbs,
      this.spans
    );

    this.rrwebEvents = rrwebEventListFactory(
      startTimestampMs,
      endTimestampMs,
      rrwebEvents
    );

    this.event = {
      ...event,
      startTimestamp: startTimestampMs / 1000,
      endTimestamp: endTimestampMs / 1000,
    } as EventTransaction;

    const urls = (
      this.getRawCrumbs().filter(
        crumb => crumb.category === BreadcrumbType.NAVIGATION
      ) as BreadcrumbTypeNavigation[]
    )
      .map(crumb => crumb.data?.to)
      .filter(Boolean) as string[];

    this.replayRecord = {
      countErrors: this.getRawCrumbs().filter(
        crumb => crumb.category === BreadcrumbType.ERROR
      ).length,
      countSegments: 0,
      countUrls: urls.length,
      errorIds: [],
      dist: this.event.dist,
      duration: endTimestampMs - startTimestampMs,
      environment: null,
      finishedAt: new Date(endTimestampMs), // TODO(replay): Convert from string to Date when reading API
      longestTransaction: 0,
      platform: this.event.platform,
      projectId: this.event.projectID,
      projectSlug: '', // TODO(replay): Read from useProject to fill this in
      release: null, // event.release is not a string, expected to be `version@1.4`
      replayId: this.event.id,
      sdkName: this.event.sdk?.name,
      sdkVersion: this.event.sdk?.version,
      startedAt: new Date(startTimestampMs), // TODO(replay): Convert from string to Date when reading API
      tags: this.event.tags.reduce((tags, {key, value}) => {
        tags[key] = value;
        return tags;
      }, {} as ReplayRecord['tags']),
      title: this.event.title,
      traceIds: [],
      urls,
      userAgent: '',
      user: {
        email: this.event.user?.email,
        id: this.event.user?.id,
        ipAddress: this.event.user?.ip_address,
        name: this.event.user?.name,
      },
    } as ReplayRecord;
  }

  private event: EventTransaction;
  private replayRecord: ReplayRecord;
  private rrwebEvents: RecordingEvent[];
  private breadcrumbs: Crumb[];
  private spans: ReplaySpan[];

  getEvent = () => {
    return this.event;
  };

  /**
   * @returns Duration of Replay (milliseonds)
   */
  getDurationMs = () => {
    return this.replayRecord.duration;
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

  getRawSpans = () => {
    return this.spans;
  };

  isMemorySpan = (span: ReplaySpan): span is MemorySpanType => {
    return span.op === 'memory';
  };

  isNetworkSpan = (span: ReplaySpan) => {
    return !this.isMemorySpan(span) && !span.op.includes('paint');
  };
}
