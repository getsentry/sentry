import type {BreadcrumbTypeNavigation, Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Event, EventTransaction, EventUser} from 'sentry/types/event';
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
    const {startTimestampMS, endTimestampMS} = replayTimestamps(
      rrwebEvents,
      breadcrumbs,
      spans
    );

    this.spans = spansFactory(spans);
    this.breadcrumbs = breadcrumbFactory(
      startTimestampMS,
      event,
      errors,
      breadcrumbs,
      this.spans
    );

    this.rrwebEvents = rrwebEventListFactory(
      startTimestampMS,
      endTimestampMS,
      rrwebEvents
    );

    this.event = {
      ...event,
      startTimestamp: startTimestampMS / 1000,
      endTimestamp: endTimestampMS / 1000,
    } as EventTransaction;
  }

  private event: EventTransaction;
  private rrwebEvents: RecordingEvent[];
  private breadcrumbs: Crumb[];
  private spans: ReplaySpan[];

  getEvent = () => {
    return this.event;
  };

  getDuration = () => {
    return (this.event.endTimestamp - this.event.startTimestamp) * 1000;
  };

  getReplay = () => {
    const urls = (
      this.getRawCrumbs().filter(
        crumb => crumb.category === BreadcrumbType.NAVIGATION
      ) as BreadcrumbTypeNavigation[]
    )
      .map(crumb => crumb.data?.to)
      .filter(Boolean) as string[];

    return {
      count_errors: this.getRawCrumbs().filter(
        crumb => crumb.category === BreadcrumbType.ERROR
      ).length,
      count_segments: 0,
      count_urls: urls.length,
      dist: this.event.dist,
      duration: this.getDuration(),
      environment: null,
      finished_at: new Date(this.event.endTimestamp),
      ip_address_v4: this.event.user?.ip_address,
      ip_address_v6: null,
      longest_transaction: 0,
      platform: this.event.platform,
      project_id: this.event.projectID,
      release: null, // event.release is not a string, expected to be `version@1.4`
      replay_id: this.event.id,
      sdk_name: this.event.sdk?.name,
      sdk_version: this.event.sdk?.version,
      started_at: new Date(this.event.startTimestamp),
      tags: this.event.tags.reduce(({key, val}, tags) => {
        tags[key] = val;
        return tags;
      }, {} as ReplayRecord['tags']),
      title: this.event.title,
      trace_ids: [],
      urls,
      user: this.event.user?.id,
      user_email: this.event.user?.email,
      user_hash: JSON.stringify(this.event.user),
      user_id: this.event.user?.id,
      user_name: this.event.user?.name,
    } as ReplayRecord;
  };

  getEventUser = () => {
    const replay = this.getReplay();
    return {
      email: replay.user_email,
      id: replay.user_id,
      ip_address: replay.ip_address_v6 || replay.ip_address_v4,
      name: replay.user_name,
    } as EventUser;
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

  isNotMemorySpan = (span: ReplaySpan) => {
    return !this.isMemorySpan(span);
  };
}
