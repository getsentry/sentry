import {
  isBreadcrumbFrame,
  isErrorFrame,
  isSpanFrame,
  type BreadcrumbFrame,
  type SpanFrame,
} from 'sentry/utils/replays/types';

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
  HYDRATION_ERROR = 10,
  MUTATIONS = 11,
  UNKNOWN = 12,
  CANVAS = 13,
  OPTIONS = 14,
  FEEDBACK = 15,
  ISSUE = 16,
}

export function which(payload: SpanFrame | BreadcrumbFrame): EventType {
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
    }
  }
  return EventType.UNKNOWN;
}

export function asLogMessage(payload: BreadcrumbFrame | SpanFrame): string | null {
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
        return `User clicked on ${payload.message} but the triggered action was slow to complete at ${timestamp}`;
      case EventType.CONSOLE:
        return `Logged: ${payload.message} at ${timestamp}`;
      case EventType.UI_BLUR:
        return null;
      case EventType.UI_FOCUS:
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
      case EventType.RESOURCE_XHR:
      case EventType.RESOURCE_FETCH: {
        const method = (payload.data as any)?.method;
        const statusCode = (payload.data as any)?.statusCode;
        const description = payload.description || '';

        let path = '';
        try {
          const parsedUrl = new URL(description);
          const pathPart = parsedUrl.pathname.replace(/^\//, '');
          path = `${parsedUrl.hostname}/${pathPart}`;
          if (parsedUrl.search) {
            path += parsedUrl.search;
          }
        } catch {
          path = description;
        }

        // Skip successful requests
        if (statusCode && String(statusCode).startsWith('2')) {
          return null;
        }

        const responseSize = (payload.data as any)?.response?.size;
        if (responseSize === undefined) {
          const requestType = eventType === EventType.RESOURCE_FETCH ? 'Fetch' : 'XHR';
          return `${requestType} request "${method} ${path}" failed with ${statusCode} at ${timestamp}`;
        }
        const requestType = eventType === EventType.RESOURCE_FETCH ? 'Fetch' : 'XHR';
        return `${requestType} request "${method} ${path}" failed with ${statusCode} (${responseSize} bytes) at ${timestamp}`;
      }
      case EventType.LCP: {
        const duration = (payload.data as any)?.size;
        const rating = (payload.data as any)?.rating;
        return `Application largest contentful paint: ${duration} ms and has a ${rating} rating at ${timestamp}`;
      }

      default:
        return '';
    }
  }
  return '';
}
