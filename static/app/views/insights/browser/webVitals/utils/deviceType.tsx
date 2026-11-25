import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {SpanFields} from 'sentry/views/insights/types';

import {BrowserType} from './queryParameterDecoders/browserType';

export type DeviceType = 'desktop' | 'mobile';

// Relay scores these browsers on the mobile curve, and every other browser,
// including ones it doesn't know, on the desktop curve. See
// `_get_mobile_browser_performance_profiles` in `src/sentry/relay/config/__init__.py`.
export const MOBILE_BROWSER_TYPES: BrowserType[] = [
  BrowserType.CHROME_MOBILE,
  BrowserType.FIREFOX_MOBILE,
  BrowserType.SAFARI_MOBILE,
  BrowserType.EDGE_MOBILE,
  BrowserType.OPERA_MOBILE,
];

function getDeviceType(browserType: BrowserType): DeviceType {
  return MOBILE_BROWSER_TYPES.includes(browserType) ? 'mobile' : 'desktop';
}

/**
 * Returns the device type that every selected browser has, or `undefined`
 * when no browser is selected or the selection has both device types.
 */
export function getSharedDeviceType(browserTypes: BrowserType[]): DeviceType | undefined {
  const deviceTypes = new Set(
    browserTypes.filter(browserType => browserType !== BrowserType.ALL).map(getDeviceType)
  );
  return deviceTypes.size === 1 ? [...deviceTypes][0] : undefined;
}

/**
 * Adds the `browser.name` filter for the selected browsers, narrowed to
 * `deviceType` when one is given. With no browsers selected, `deviceType`
 * alone picks every browser Relay scores on that device type's curve.
 * `deviceType` must match at least one selected browser, which `useDeviceType`
 * guarantees.
 */
export function addBrowserFilter(
  search: MutableSearch,
  browserTypes: BrowserType[] = [],
  deviceType?: DeviceType
) {
  const selected = browserTypes.filter(
    browserType =>
      browserType !== BrowserType.ALL &&
      (!deviceType || getDeviceType(browserType) === deviceType)
  );

  if (selected.length) {
    search.addFilterValueList(SpanFields.BROWSER_NAME, selected);
  } else if (deviceType === 'mobile') {
    search.addFilterValueList(SpanFields.BROWSER_NAME, MOBILE_BROWSER_TYPES);
  } else if (deviceType === 'desktop') {
    search.addFilterValueList(`!${SpanFields.BROWSER_NAME}`, MOBILE_BROWSER_TYPES);
  }
}
