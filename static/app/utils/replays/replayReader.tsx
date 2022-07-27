import type {Crumb} from 'sentry/types/breadcrumbs';
import {
  breadcrumbFactory,
  replayTimestamps,
  rrwebEventListFactory,
  spansFactory,
} from 'sentry/utils/replays/replayDataUtils';
import type {
  MemorySpanType,
  RecordingEvent,
  Replay,
  ReplayCrumb,
  ReplayError,
  ReplaySpan,
} from 'sentry/views/replays/types';

interface ReplayReaderParams {
  breadcrumbs: ReplayCrumb[] | undefined;
  errors: ReplayError[] | undefined;

  /**
   * The root Replay event, created at the start of the browser session.
   */
  replay: Replay | undefined;

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
  static factory({breadcrumbs, replay, errors, rrwebEvents, spans}: ReplayReaderParams) {
    if (!breadcrumbs || !replay || !rrwebEvents || !spans || !errors) {
      return null;
    }

    return new ReplayReader({breadcrumbs, replay, errors, rrwebEvents, spans});
  }

  private constructor({
    breadcrumbs,
    replay,
    errors,
    rrwebEvents,
    spans,
  }: RequiredNotNull<ReplayReaderParams>) {
    // TODO: probably don't need this with the new api backend
    // Could be `const {started_at, finished_at} = replay;`
    const {startTimestampMS, endTimestampMS} = replayTimestamps(
      rrwebEvents,
      breadcrumbs,
      spans
    );

    this.spans = spansFactory(spans);
    this.breadcrumbs = breadcrumbFactory(
      startTimestampMS,
      replay,
      errors,
      breadcrumbs,
      this.spans
    );

    this.rrwebEvents = rrwebEventListFactory(
      startTimestampMS,
      endTimestampMS,
      rrwebEvents
    );

    this.replay = replay;
  }

  private replay: Replay;
  private rrwebEvents: RecordingEvent[];
  private breadcrumbs: Crumb[];
  private spans: ReplaySpan[];

  getReplay = () => {
    return this.replay;
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
