import type {
  HistoryData as THistoryData,
  LargestContentfulPaintData as TLargestContentfulPaintData,
  MemoryData as TMemoryData,
  NavigationData as TNavigationData,
  NetworkRequestData as TNetworkRequestData,
  PaintData as TPaintData,
  ResourceData as TResourceData,
} from 'sentry/views/replays/types';

export function PaintData(): TPaintData {
  return undefined;
}

export function NavigationData(fields: Partial<TNavigationData>): TNavigationData {
  return {
    decodedBodySize: fields.decodedBodySize,
    domComplete: fields.domComplete,
    domContentLoadedEventEnd: fields.domContentLoadedEventEnd,
    domContentLoadedEventStart: fields.domContentLoadedEventStart,
    domInteractive: fields.domInteractive,
    duration: fields.duration,
    encodedBodySize: fields.encodedBodySize,
    loadEventEnd: fields.loadEventEnd,
    loadEventStart: fields.loadEventStart,
    redirectCount: fields.redirectCount,
    size: fields.size,
  };
}

export function ResourceData(fields: Partial<TResourceData>): TResourceData {
  return {
    decodedBodySize: fields.decodedBodySize ?? 0,
    encodedBodySize: fields.encodedBodySize ?? 0,
    size: fields.size ?? 0,
    statusCode: fields.statusCode,
  };
}

export function LargestContentfulPaintData(
  fields: Partial<TLargestContentfulPaintData>
): TLargestContentfulPaintData {
  return {
    nodeId: fields.nodeId,
    size: fields.size ?? 0,
    value: fields.value ?? 0,
  };
}

export function MemoryData(fields: Partial<TMemoryData>): TMemoryData {
  return {
    memory: {
      jsHeapSizeLimit: fields.memory?.jsHeapSizeLimit ?? 0,
      totalJSHeapSize: fields.memory?.totalJSHeapSize ?? 0,
      usedJSHeapSize: fields.memory?.usedJSHeapSize ?? 0,
    },
  };
}

export function NetworkRequestData(
  fields: Partial<TNetworkRequestData>
): TNetworkRequestData {
  return {
    method: fields.method,
    requestBodySize: fields.requestBodySize,
    responseBodySize: fields.responseBodySize,
    statusCode: fields.statusCode,
  };
}

export function HistoryData(fields: Partial<THistoryData>): THistoryData {
  return {
    previous: fields.previous ?? '/',
  };
}
