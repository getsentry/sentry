import {useReplayContext} from 'sentry/components/replays/replayContext';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery, useQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {
  type BreadcrumbFrame,
  isBreadcrumbFrame,
  isSpanFrame,
  type SpanFrame,
} from 'sentry/utils/replays/types';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';

export interface SummaryResponse {
  data: {
    summary: string;
    time_ranges: Array<{period_end: number; period_start: number; period_title: string}>;
    title: string;
  };
}

function createAISummaryQueryKey(
  orgSlug: string,
  projectSlug: string | undefined,
  replayId: string
): ApiQueryKey {
  return [
    `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/summarize/breadcrumbs/`,
  ];
}

export function useFetchReplaySummary(options?: UseApiQueryOptions<SummaryResponse>) {
  return useLocalAiSummary();
  const organization = useOrganization();
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();
  const project = useProjectFromId({project_id: replayRecord?.project_id});
  return useApiQuery<SummaryResponse>(
    createAISummaryQueryKey(organization.slug, project?.slug, replayRecord?.id ?? ''),
    {
      staleTime: 0,
      ...options,
    }
  );
}
export function useLocalAiSummary() {
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();
  // const {data: summaryData, isPending, isRefetching, refetch, isError} = useAiSummary(replayRecord);
  const logs = [...replay?.getChapterFrames()].map(asLogMessage).filter(Boolean) ?? [];
  // const logs = [JSON.stringify(replay?.getChapterFrames?.())];
  //
  // const attachmentData = replay?._attachments
  // ?.filter(({type}) => type === 5)
  // .filter(
  //     ({data}) =>
  //       (data.tag !== 'performanceSpan' ||
  //         (!data.payload.op.startsWith('resource') && data.payload.op !== 'memory') ||
  //         ['resource.xhr', 'resource.fetch'].includes(data.payload.op)) &&
  //       data.tag !== 'options'
  // )
  // .map(ev => {
  //     if (['ui.click', 'ui.input'].includes(ev.data.payload.category)) {
  //       const {message: _, type: _1, ...rest} = ev.data.payload;
  //       return rest;
  //     }
  //
  //     if (['console'].includes(ev.data.payload.category)) {
  //       const {type: _1, data, _2, ...rest} = ev.data.payload;
  //       return rest;
  //     }
  //
  //     if (['resource.xhr', 'resource.fetch'].includes(ev.data.payload.op)) {
  //       const {type: _1, data, startTimestamp, ...rest} = ev.data.payload;
  //       return {
  //         timestamp: startTimestamp,
  //         ...rest,
  //         data: {
  //           method: data.method,
  //           statusCode: data.statusCode,
  //         },
  //       };
  //     }
  //     const ts =
  //       ev.data.payload.timestamp || ev.data.payload.startTimestamp || ev.timestamp;
  //
  //     return {
  //       timestamp: ts,
  //       ...ev.data.payload,
  //     };
  // });
  // const logs = [JSON.stringify(attachmentData)];
  //
  const {data} = useReplayPrompt(replayRecord, logs);
  console.log({logs});

  return useQuery<SummaryResponse | null>({
    queryKey: ['ai-summary-seer', replayRecord?.id, data],
    queryFn: async () => {
      if (!data) {
        return null;
      }

      const response = await fetch(`/v1/automation/summarize/replay/breadcrumbs`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json;charset=utf-8',
          Authorization: `Rpcsignature rpc0:${data.signature}`,
        },
        body: JSON.stringify(data.body ?? {}),
      });

      const json = await response.json();
      return json;
    },
    enabled: Boolean(replay?._attachments),
    retry: false,
  });
}

interface ReplayPrompt {
  body: {logs: string[]};
  signature: string;
}

function useReplayPrompt(replayRecord: ReplayRecord | undefined, logs: string[]) {
  const {project: project_id} = useLocationQuery({
    fields: {project: decodeScalar},
  });
  const project = useProjectFromId({project_id});
  const body = {
    logs,
  };

  return useQuery<ReplayPrompt | null>({
    queryKey: ['replay-prompt', project?.id, replayRecord?.id, body],
    queryFn: async () => {
      try {
        const key = await window.crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode('seers-also-very-long-value-haha'),
          {name: 'HMAC', hash: {name: 'SHA-256'}},
          false,
          ['sign', 'verify']
        );
        const signature = await window.crypto.subtle.sign(
          'HMAC',
          key,
          new TextEncoder().encode(JSON.stringify(body))
        );

        return {
          body,
          signature: Buffer.from(signature).toString('base64'),
        };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return null;
      }
    },
  });
}

enum EventType {
  CLICK = 0,
  DEAD_CLICK = 1,
  RAGE_CLICK = 2,
  NAVIGATION = 3,
  CONSOLE = 4,
  UI_BLUR = 5,
  UI_FOCUS = 6,
  RESOURCE_FETCH = 7,
  RESOURCE_XHR = 8,
  LCP = 9,
  FCP = 10,
  HYDRATION_ERROR = 11,
  MUTATIONS = 12,
  UNKNOWN = 13,
  FEEDBACK = 14,
}

/**
 * Identity the passed event.
 * This function helpfully hides the dirty data munging necessary to identify an event type and
 * helpfully reduces the number of operations required by reusing context from previous branches.
 */
export function which(payload: SpanFrame | BreadcrumbFrame): EventType {
  if (isBreadcrumbFrame(payload)) {
    const category = payload.category;

    if (category === 'ui.click') {
      return EventType.CLICK;
    }
    if (category === 'ui.slowClickDetected') {
      const isTimeoutReason = payload.data?.endReason === 'timeout';
      const isTargetTagname = payload.data?.node?.tagName in ['a', 'button', 'input'];
      const timeout =
        payload.data?.timeAfterClickMs || payload.data?.timeafterclickms || 0;
      if (isTimeoutReason && isTargetTagname && timeout >= 7000) {
        const isRage = (payload.data?.clickCount || payload.data?.clickcount || 0) >= 5;
        return isRage ? EventType.RAGE_CLICK : EventType.DEAD_CLICK;
      }
    } else if (category === 'navigation') {
      return EventType.NAVIGATION;
    } else if (category === 'console') {
      return EventType.CONSOLE;
    } else if (category === 'ui.blur') {
      return EventType.UI_BLUR;
    } else if (category === 'ui.focus') {
      return EventType.UI_FOCUS;
    } else if (category === 'replay.hydrate-error') {
      return EventType.HYDRATION_ERROR;
    } else if (category === 'replay.mutations') {
      return EventType.MUTATIONS;
    } else if (category === 'sentry.feedback') {
      return EventType.FEEDBACK;
    }
  }

  if (isSpanFrame(payload)) {
    const op = payload.op;

    if (op === 'resource.fetch') {
      return EventType.RESOURCE_FETCH;
    }
    if (op === 'resource.xhr') {
      return EventType.RESOURCE_XHR;
    }
    if (op === 'web-vital') {
      if (payload.description === 'largest-contentful-paint') {
        return EventType.LCP;
      }
      if (payload.description === 'first-contentful-paint') {
        return EventType.FCP;
      }
    }
  }
  return EventType.UNKNOWN;
}

/**
 * Return an event as a log message.
 * Useful in AI contexts where the event's structure is an impediment to the AI's understanding
 * of the interaction log. Not every event produces a log message. This function is overly coupled
 * to the AI use case. In later iterations, if more or all log messages are desired, this function
 * should be forked.
 */
export function asLogMessage(payload: BreadcrumbFrame | SpanFrame): string | null {
  const eventType = which(payload);
  const timestamp = payload.timestampMs || 0.0;
  if (isBreadcrumbFrame(payload)) {
    switch (eventType) {
      case EventType.CLICK:
        return `User clicked on ${payload.message} at ${timestamp}`;
      case EventType.DEAD_CLICK:
        return `User clicked on ${payload.message} but the triggered action was slow to complete at ${timestamp}`;
      case EventType.RAGE_CLICK:
        return `User rage clicked on ${payload.message} but the triggered action was slow to complete at ${timestamp}`;
      case EventType.NAVIGATION:
        return `User navigated to: ${payload.data?.to} at ${timestamp}`;
      case EventType.CONSOLE:
        return `Logged: ${payload.message} at ${timestamp}`;
      case EventType.UI_BLUR:
        return `User looked away from the tab at ${timestamp}.`;
      case EventType.UI_FOCUS:
        return `User returned to tab at ${timestamp}.`;
      default:
        return '';
    }
  }

  if (isSpanFrame(payload)) {
    switch (eventType) {
      case EventType.RESOURCE_FETCH: {
        const parsedUrl = new URL(payload.description || '');
        const path = `${parsedUrl.pathname}?${parsedUrl.search}`;
        const size = payload.data?.response?.size;
        const statusCode = payload.data?.statusCode;
        const duration = (payload.endTimestamp || 0) - (payload.startTimestamp || 0);
        const method = payload.data?.method;
        return `Application initiated request: "${method} ${path} HTTP/2.0" ${statusCode} ${size}; took ${duration} milliseconds at ${timestamp}`;
      }
      case EventType.RESOURCE_XHR:
        return null;
      case EventType.LCP: {
        const duration = payload.data?.size;
        const rating = payload.data?.rating;
        return `Application largest contentful paint: ${duration} ms and has a ${rating} rating`;
      }
      case EventType.FCP: {
        const duration = payload.data?.size;
        const rating = payload.data?.rating;
        return `Application first contentful paint: ${duration} ms and has a ${rating} rating`;
      }
      case EventType.HYDRATION_ERROR:
        return `There was a hydration error on the page at ${timestamp}.`;
      case EventType.MUTATIONS:
        return null;
      case EventType.UNKNOWN:
        return null;
      case EventType.FEEDBACK:
        return 'The user filled out a feedback form describing their experience using the application.';
      default:
        return '';
    }
  }
  return '';
}
