import * as Sentry from '@sentry/react';
import {duration} from 'moment';

import type {Crumb} from 'sentry/types/breadcrumbs';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import localStorageWrapper from 'sentry/utils/localStorage';
import {
  errorToCrumb,
  hydrateDefaultCrumb,
  hydrateReplayMemorySpan,
  hydrateReplayNetworkSpan,
  networkSpanToCrumb,
} from 'sentry/utils/replays/hydration';
import {
  breadcrumbFactory,
  getBreadcrumbsByCategory,
  replayTimestamps,
  rrwebEventListFactory,
} from 'sentry/utils/replays/replayDataUtils';
import splitAttachmentsByType from 'sentry/utils/replays/splitAttachmentsByType';
import type {
  MemorySpanType,
  NetworkSpan,
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplayRecord,
  // ReplaySpan,
} from 'sentry/views/replays/types';

interface ReplayReaderParams {
  /**
   * Loaded segment data
   *
   * This is a mix of rrweb data, breadcrumbs and spans/transactions sorted by time
   * All three types are mixed together.
   */
  rawAttachments: unknown[];
  rawErrors: unknown[];

  /**
   * The root Replay event, created at the start of the browser session.
   */
  replayRecord: ReplayRecord | undefined;
}

type RequiredNotNull<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

function shouldConvertSpanToCrumb(span: NetworkSpan) {
  return [
    'navigation.navigate',
    'navigation.reload',
    'largest-contentful-paint',
  ].includes(span.op);
}

function shouldHydrateToCrumb(crumb: any) {
  if (['ui.focus', 'ui.blur'].includes(crumb.category || '')) {
    return false;
  }
  if (crumb.category?.startsWith('replay')) {
    return crumb.category === 'replay.mutations';
  }
  return true;
}

function isConsoleSpecificCrumb(crumb: ReplayCrumb) {
  return (
    ['console', 'issue'].includes(crumb.category || '') &&
    ![BreadcrumbType.HTTP, BreadcrumbType.NAVIGATION].includes(crumb.type)
  );
}

export default class ReplayReader {
  static factory({rawAttachments, rawErrors, replayRecord}: ReplayReaderParams) {
    if (!rawAttachments || !rawErrors || !replayRecord) {
      return null;
    }

    try {
      return new ReplayReader({rawAttachments, rawErrors, replayRecord});
    } catch (err) {
      Sentry.captureException(err);

      // If something happens then we don't really know if it's the attachments
      // array or errors array to blame (it's probably attachments though).
      // Either way we can use the replayRecord to show some metadata, and then
      // put an error message below it.
      return new ReplayReader({
        rawAttachments: [],
        rawErrors: [],
        replayRecord,
      });
    }
  }

  private constructor({
    rawAttachments,
    rawErrors,
    replayRecord,
  }: RequiredNotNull<ReplayReaderParams>) {
    this.replayRecord = replayRecord;

    const attachmentsByType = splitAttachmentsByType(rawAttachments);

    if (localStorageWrapper.getItem('REPLAY-BACKEND-TIMESTAMPS') !== '1') {
      // TODO(replays): We should get correct timestamps from the backend instead
      // of having to fix them up here.
      const {startTimestampMs, endTimestampMs} = replayTimestamps(
        replayRecord,
        rawErrors,
        attachmentsByType
      );
      replayRecord.started_at = new Date(startTimestampMs);
      replayRecord.finished_at = new Date(endTimestampMs);
      replayRecord.duration = duration(
        replayRecord.finished_at.getTime() - replayRecord.started_at.getTime()
      );
    }

    const {rawBreadcrumbs, rawRRWebEvents, rawNetworkSpans, rawMemorySpans} =
      attachmentsByType;

    // TODO: adjust timestamp of first event
    // TODO: push 'replay-end' event on the end
    // TODO: Make sure rrwebEvents is sorted before render
    this.rrwebEvents = rawRRWebEvents as RecordingEvent[];

    // TODO: Make sure networkSpans are sorted before render (by the table?)
    this.networkSpans = rawNetworkSpans.map(span => hydrateReplayNetworkSpan(span));

    // TODO: Make sure networkSpans are sorted before render
    this.memorySpans = rawMemorySpans.map(span => hydrateReplayMemorySpan(span));

    // Cast to `ReplayError[]` instead of calling `hydrateReplayError` to save memory pressure
    const errorCrumbs = (rawErrors as ReplayError[]).map(errorToCrumb);
    const networkCrumbs = this.networkSpans
      .filter(shouldConvertSpanToCrumb)
      .map(networkSpanToCrumb);
    const defaultCrumbs = rawBreadcrumbs
      .filter(shouldHydrateToCrumb)
      .map(hydrateDefaultCrumb);

    const consoleCrumbs = defaultCrumbs.filter(isConsoleSpecificCrumb);

    // TODO: combine [initialCrumb, ...errorCrumbs, ...networkCrumbs, ...defaultCrumbs]
    // TODO: Ensure this list is sorted, if need be
    this.breadcrumbs = [];

    this.breadcrumbs = breadcrumbFactory(
      replayRecord,
      rawErrors as any[],
      rawBreadcrumbs as any[],
      this.networkSpans
    );
    this.consoleCrumbs = getBreadcrumbsByCategory(this.breadcrumbs, ['console', 'issue']);

    this.rrwebEvents = rrwebEventListFactory(replayRecord, rawRRWebEvents as any[]);
  }

  private replayRecord: ReplayRecord;
  private rrwebEvents: RecordingEvent[];
  private breadcrumbs: Crumb[];
  private consoleCrumbs: ReturnType<typeof getBreadcrumbsByCategory>;
  private networkSpans: NetworkSpan[];
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

  // callers: [DOM Tab, replayContext]
  // Must be sorted here, rename to `getSortedRRWebEvents`
  getRRWebEvents = () => {
    return this.rrwebEvents;
  };

  // callers: [
  //   Crumb Tab => filter( crumb.category !== 'console' )
  //   Timeline => filter( crumb.type == [BreadcrumbType.ERROR, BreadcrumbType.NAVIGATION, BreadcrumbType.UI, BreadcrumbType.USER])
  //   DOM Tab => filter( 'nodeId' in crumb.data )
  //   Current Url => filter( crumb.type === BreadcrumbType.NAVIGATION ),
  //   Header -> UrlWalker => filter( crumb.type === [BreadcrumbType.INIT, BreadcrumbType.NAVIGATION] )
  // ]
  getRawCrumbs = () => {
    return this.breadcrumbs;
  };

  // callers: [Console Tab]
  getConsoleCrumbs = () => {
    return this.consoleCrumbs;
  };

  // callers: [Network Tab, Timeline]
  getNetworkSpans = () => {
    return this.networkSpans;
  };

  // callers: [Memory Tab]
  getMemorySpans = () => {
    return this.memorySpans;
  };
}
