import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {
  type BreadcrumbFrame,
  isBreadcrumbFrame,
  isErrorFrame,
  isSpanFrame,
  type SpanFrame,
} from 'sentry/utils/replays/types';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import type {ReplayRecord} from 'sentry/views/replays/types';

export interface SummaryResponse {
  data: {
    summary: string;
    time_ranges: Array<{
      error: boolean;
      feedback: boolean;
      period_end: number;
      period_start: number;
      period_title: string;
    }>;
    title: string;
  };
}

interface ReplayPrompt {
  body: {logs: string[]};
  signature: string;
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
  CANVAS = 14,
  OPTIONS = 15,
  FEEDBACK = 16,
  ISSUE = 17,
}

export function useFetchReplaySummary(_options?: UseApiQueryOptions<SummaryResponse>) {
  return useLocalAiSummary();
}

function useLocalAiSummary() {
  const replay = useReplayReader();
  const replayRecord = replay?.getReplay();

  // Sort all events chronologically
  const allEvents = [
    ...(replay?.getChapterFrames() ?? []), // inclues all errors & feedback
    ...(replay?.getNetworkFrames() ?? []).filter(
      frame => !frame.op.startsWith('navigation')
    ),
    ...(replay?.getConsoleFrames() ?? []),
  ].sort((a, b) => a.timestampMs - b.timestampMs);

  const allData =
    allEvents
      .map(event => {
        return asLogMessage(event);
      })
      .filter((item): item is string => item !== null && item !== '') ?? [];

  const logs = allData;
  const {data} = useReplayPrompt(replayRecord, logs);

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
    enabled: Boolean(replay?.getAttachments()),
    retry: false,
  });
}

function useReplayPrompt(replayRecord: ReplayRecord | undefined, logs: string[]) {
  const {project: project_id} = useLocationQuery({
    fields: {project: decodeScalar},
  });
  const replay = useReplayReader();
  const project = useProjectFromId({project_id});
  const organization = useOrganization();
  const body = {
    logs,
    replay_id: replay?.getReplay().id,
    organization_id: organization.id,
    project_id: project?.id,
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

function which(payload: SpanFrame | BreadcrumbFrame): EventType {
  if (isErrorFrame(payload)) {
    return EventType.ISSUE;
  }
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
    } else if (category === 'feedback') {
      return EventType.FEEDBACK;
    }
  }

  if (isSpanFrame(payload)) {
    const op = payload.op;

    if (op.startsWith('navigation')) {
      return EventType.NAVIGATION;
    }
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

function asLogMessage(payload: BreadcrumbFrame | SpanFrame): string | null {
  const eventType = which(payload);
  const timestamp = Number(payload.timestampMs || 0);
  if (isErrorFrame(payload)) {
    return `User experienced an error: ${payload.message} at ${timestamp}`;
  }
  if (isBreadcrumbFrame(payload)) {
    switch (eventType) {
      case EventType.CLICK:
        return `User clicked on ${payload.message} at ${timestamp}`;
      case EventType.DEAD_CLICK:
        return `User clicked on ${payload.message} but the triggered action was slow to complete at ${timestamp}`;
      case EventType.RAGE_CLICK:
        return `User rage clicked on ${payload.message} but the triggered action was slow to complete at ${timestamp}`;
      case EventType.CONSOLE:
        return `Logged: ${payload.message} at ${timestamp}`;
      case EventType.UI_BLUR:
        // return `User looked away from the tab at ${timestamp}.`;
        return null;
      case EventType.UI_FOCUS:
        return `User returned to tab at ${timestamp}.`;
        return null;
      case EventType.FEEDBACK:
        return `User submitted feedback: ${payload.message} at ${timestamp}`;
      case EventType.MUTATIONS:
        return null;
      case EventType.HYDRATION_ERROR:
        return `There was a hydration error on the page at ${timestamp}.`;
      default:
        return '';
    }
  }

  if (isSpanFrame(payload)) {
    switch (eventType) {
      case EventType.NAVIGATION:
        return `User navigated to: ${payload.description} at ${timestamp}`;
      case EventType.RESOURCE_FETCH: {
        const parsedUrl = new URL(payload.description || '');
        const path = `${parsedUrl.pathname}?${parsedUrl.search}`;
        const size = (payload.data as any)?.response?.size;
        const statusCode = (payload.data as any)?.statusCode;
        const duration =
          Number(payload.endTimestamp || 0) - Number(payload.startTimestamp || 0);
        const method = (payload.data as any)?.method;

        if (String(statusCode).startsWith('200')) {
          return null;
        }

        return `Application initiated request: "${method} ${path} HTTP/2.0" ${statusCode} and response size ${size}; took ${duration} milliseconds at ${timestamp}`;
      }
      case EventType.LCP: {
        const duration = (payload.data as any)?.size;
        const rating = (payload.data as any)?.rating;
        return `Application largest contentful paint: ${duration} ms and has a ${rating} rating at ${timestamp}`;
      }
      case EventType.FCP: {
        const duration = (payload.data as any)?.size;
        const rating = (payload.data as any)?.rating;
        return `Application first contentful paint: ${duration} ms and has a ${rating} rating at ${timestamp}`;
      }
      case EventType.RESOURCE_XHR:
        return null;
      default:
        return '';
    }
  }
  return '';
}
