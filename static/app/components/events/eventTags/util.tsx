import {type RefObject, useCallback, useLayoutEffect, useState} from 'react';
import {useResizeObserver} from '@react-aria/utils';

export const TAGS_DOCS_LINK = `https://docs.sentry.io/platform-redirect/?next=/enriching-events/tags`;

export enum TagFilter {
  ALL = 'All',
  CUSTOM = 'Custom',
  CLIENT = 'Client',
  APPLICATION = 'Application',
  OTHER = 'Other',
}

export const TagFilterData = {
  [TagFilter.APPLICATION]: new Set([
    /* AppContext in Relay */
    'app',
    'app.app_start_time',
    'app.device_app_hash',
    'app.build_type',
    'app.app_identifier',
    'app.app_name',
    'app.app_version',
    'app.app_build',
    'app.app_memory',
    'app.in_foreground',
    /* RuntimeContext in Relay */
    'runtime',
    'runtime.name',
    'runtime.context',
    'runtime.version',
    'runtime.build',
    /* Manually Sorted */
    'release',
    'dist',
    'environment',
    'platform',
    'app.identifier',
    'hostname',
    'server_name',
    'site',
  ]),
  [TagFilter.CLIENT]: new Set([
    /* BrowserContext in Relay */
    'browser',
    'browser.name',
    'browser.version',
    /* DeviceContext in Relay */
    'device',
    'device.family',
    'device.model',
    'device.model_id',
    'device.arch',
    'device.battery_level',
    'device.orientation',
    'device.manufacturer',
    'device.brand',
    'device.screen_resolution',
    'device.screen_width_pixels',
    'device.screen_height_pixels',
    'device.screen_density',
    'device.screen_dpi',
    'device.online',
    'device.charging',
    'device.low_memory',
    'device.simulator',
    'device.memory_size',
    'device.free_memory',
    'device.usable_memory',
    /* OsContext in Relay */
    'client_os',
    'client_os.name',
    'client_os.version',
    'client_os.build',
    'client_os.kernel_version',
    'client_os.rooted',
    'client_os.raw_description',
    'os',
    'os.name',
    'os.version',
    'os.build',
    'os.kernel_version',
    'os.rooted',
    'os.raw_description',
    'os.raw_description',
    /* Manually Sorted */
    'user',
    'mobile',
    'device.class',
    'site',
    'url',
  ]),
  [TagFilter.OTHER]: new Set([
    /* Monitors */
    'monitor.slug',
    'monitor.incident',
    'monitor.id',
    'monitor.status',
    /* SDK (maybe?) */
    'handled',
    'level',
    'mechanism',
    'url',
    'sdk.name',
    'sdk.version',
    /* Manually added in Relay with tags.insert(...) */
    'hostname',
    'server_name',
    'site',
    'transaction.start',
    'transaction.end',
    /* SpanTagKey in Relay */
    'transaction',
    'transaction.method',
    'transaction.op',
    'action',
    'category',
    'description',
    'domain',
    'raw_domain',
    'group',
    'http.decoded_response_content_length',
    'http.response_content_length',
    'http.response_transfer_size',
    'resource.render_blocking_status',
    'op',
    'status_code',
    'system',
    'ttfd',
    'ttid',
    'file_extension',
    'main_thread',
    'app_start_type',
    'replay_id',
    'replayId',
    /* CommonTag in Relay */
    'transaction.status',
    'http.method',
    'http.status_code',
    'geo.country_code',
  ]),
};

/**
 * Combines all of the above into a single set to determine if a tag is custom
 */
export function getSentryDefaultTags() {
  return Object.values(TagFilterData).reduce(
    // TODO: result.union(s) when Set.prototype.union is Baseline
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/union
    (result, s) => new Set([...result, ...s]),
    new Set([])
  );
}

const ISSUE_DETAILS_COLUMN_BREAKPOINTS = [
  {minWidth: 1950, columnCount: 3},
  {minWidth: 700, columnCount: 2},
  {minWidth: 0, columnCount: 1},
];

/**
 * Determine the column count using available space.
 * Note: This is pretty inefficient since it recalculates on resize, but since Tags/Context is
 * rendered in the page contents, modals, and asides, we can't rely on window breakpoint to
 * accurately describe the available space.
 */
export function useIssueDetailsColumnCount(elementRef: RefObject<HTMLElement>): number {
  const calculateColumnCount = useCallback(() => {
    const width = elementRef.current?.clientWidth || 0;
    const breakpoint = ISSUE_DETAILS_COLUMN_BREAKPOINTS.find(
      ({minWidth}) => width >= minWidth
    );
    return breakpoint?.columnCount ?? 1;
  }, [elementRef]);

  const [columnCount, setColumnCount] = useState(calculateColumnCount());

  // If the ref was undefined, calculate the column count again
  useLayoutEffect(() => {
    if (elementRef.current) {
      setColumnCount(calculateColumnCount());
    }
  }, [calculateColumnCount, elementRef]);

  const onResize = useCallback(() => {
    const count = calculateColumnCount();
    setColumnCount(count);
  }, [calculateColumnCount]);

  useResizeObserver({ref: elementRef, onResize});

  return columnCount;
}
