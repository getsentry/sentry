import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {BrowserType} from './queryParameterDecoders/browserType';
import {addBrowserFilter, getSharedDeviceType, type DeviceType} from './deviceType';

const MOBILE_LIST =
  '["Chrome Mobile","Firefox Mobile","Mobile Safari","Edge Mobile","Opera Mobile"]';

function formatBrowserFilter(browserTypes: BrowserType[], deviceType?: DeviceType) {
  const search = new MutableSearch('');
  addBrowserFilter(search, browserTypes, deviceType);
  return search.formatString();
}

describe('getSharedDeviceType', () => {
  it('returns the device type every browser has', () => {
    expect(getSharedDeviceType([BrowserType.CHROME, BrowserType.SAFARI])).toBe('desktop');
    expect(
      getSharedDeviceType([BrowserType.CHROME_MOBILE, BrowserType.SAFARI_MOBILE])
    ).toBe('mobile');
  });

  it('returns undefined for mixed or empty selections', () => {
    expect(
      getSharedDeviceType([BrowserType.CHROME, BrowserType.CHROME_MOBILE])
    ).toBeUndefined();
    expect(getSharedDeviceType([])).toBeUndefined();
    expect(getSharedDeviceType([BrowserType.ALL])).toBeUndefined();
  });
});

describe('addBrowserFilter', () => {
  it('filters to the selected browsers without a device type', () => {
    expect(formatBrowserFilter([BrowserType.CHROME, BrowserType.CHROME_MOBILE])).toBe(
      'browser.name:[Chrome,"Chrome Mobile"]'
    );
    expect(formatBrowserFilter([])).toBe('');
  });

  it('narrows the selected browsers to the device type', () => {
    expect(
      formatBrowserFilter([BrowserType.CHROME, BrowserType.CHROME_MOBILE], 'mobile')
    ).toBe('browser.name:["Chrome Mobile"]');
  });

  it('covers every browser of the device type when none are selected', () => {
    expect(formatBrowserFilter([], 'mobile')).toBe(`browser.name:${MOBILE_LIST}`);
    expect(formatBrowserFilter([], 'desktop')).toBe(`!browser.name:${MOBILE_LIST}`);
  });
});
