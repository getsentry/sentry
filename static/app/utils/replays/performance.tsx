export type AllPerformanceEntry =
  | PerformancePaintTiming
  | PerformanceResourceTiming
  | PerformanceNavigationTiming;

// PerformancePaintTiming and PerformanceNavigationTiming are only available with TS 4.4 and newer
// Therefore, we're exporting them here to make them available in older TS versions
export type PerformancePaintTiming = PerformanceEntry;
export type PerformanceNavigationTiming = PerformanceEntry &
  PerformanceResourceTiming & {
    /**
     * A DOMHighResTimeStamp representing the time immediately before the user agent
     * sets the document's readyState to "complete".
     */
    domComplete: number;
    /**
     * A DOMHighResTimeStamp representing the time immediately after the current
     * document's DOMContentLoaded event handler completes.
     */
    domContentLoadedEventEnd: number;

    /**
     * A DOMHighResTimeStamp representing the time immediately before the current
     * document's DOMContentLoaded event handler starts.
     */
    domContentLoadedEventStart: number;

    /**
     * A DOMHighResTimeStamp representing the time immediately before the user agent
     * sets the document's readyState to "interactive".
     */
    domInteractive: number;
    /**
     * A DOMHighResTimeStamp representing the time immediately after the current
     * document's load event handler completes.
     */
    loadEventEnd: number;

    /**
     * A DOMHighResTimeStamp representing the time immediately before the current
     * document's load event handler starts.
     */
    loadEventStart: number;

    /**
     * A number representing the number of redirects since the last non-redirect
     * navigation in the current browsing context.
     */
    redirectCount: number;

    transferSize: number;

    type: string;
  };
export type ExperimentalPerformanceResourceTiming = PerformanceResourceTiming & {
  // Experimental, see: https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/responseStatus
  // Requires Chrome 109
  responseStatus?: number;
};

export type PaintData = undefined;

/**
 * See https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming
 *
 * Note `navigation.push` will not have any data
 */
export type NavigationData = Partial<
  Pick<
    PerformanceNavigationTiming,
    | 'decodedBodySize'
    | 'encodedBodySize'
    | 'duration'
    | 'domInteractive'
    | 'domContentLoadedEventEnd'
    | 'domContentLoadedEventStart'
    | 'loadEventStart'
    | 'loadEventEnd'
    | 'domComplete'
    | 'redirectCount'
  >
> & {
  /**
   * Transfer size of resource
   */
  size?: number;
};

export type ResourceData = Pick<
  PerformanceResourceTiming,
  'decodedBodySize' | 'encodedBodySize'
> & {
  /**
   * Transfer size of resource
   */
  size: number;
  /**
   * HTTP status code. Note this is experimental and not available on all browsers.
   */
  statusCode?: number;
};

export interface LargestContentfulPaintData {
  size: number;
  /**
   * Render time (in ms) of the LCP
   */
  value: number;
  /**
   * The recording id of the LCP node. -1 if not found
   */
  nodeId?: number;
}

/**
 * Entries that come from window.performance
 */
export type AllPerformanceEntryData =
  | PaintData
  | NavigationData
  | ResourceData
  | LargestContentfulPaintData;

export interface MemoryData {
  memory: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
}

export interface NetworkRequestData {
  method?: string;
  requestBodySize?: number;
  responseBodySize?: number;
  statusCode?: number;
}

export interface HistoryData {
  previous: string;
}

export type AllEntryData =
  | AllPerformanceEntryData
  | MemoryData
  | NetworkRequestData
  | HistoryData;

export interface ReplayPerformanceEntry<T> {
  /**
   * Additional unstructured data to be included
   */
  data: T;

  /**
   * The end timestamp in seconds
   */
  end: number;

  /**
   * A more specific description of the performance entry
   */
  name: string;

  /**
   * The start timestamp in seconds
   */
  start: number;

  /**
   * One of these types https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEntry/entryType
   */
  type: string;
}
