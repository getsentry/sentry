import {WebVital} from 'sentry/utils/fields';
import {Browser} from 'sentry/utils/performance/vitals/constants';

export const vitalSupportedBrowsers: Partial<Record<WebVital, Browser[]>> = {
  [WebVital.LCP]: [Browser.CHROME, Browser.EDGE, Browser.OPERA, Browser.FIREFOX],
  [WebVital.FID]: [
    Browser.CHROME,
    Browser.EDGE,
    Browser.OPERA,
    Browser.FIREFOX,
    Browser.SAFARI,
    Browser.IE,
  ],
  [WebVital.CLS]: [Browser.CHROME, Browser.EDGE, Browser.OPERA],
  [WebVital.FP]: [Browser.CHROME, Browser.EDGE, Browser.OPERA],
  [WebVital.FCP]: [
    Browser.CHROME,
    Browser.EDGE,
    Browser.OPERA,
    Browser.FIREFOX,
    Browser.SAFARI,
  ],
  [WebVital.TTFB]: [
    Browser.CHROME,
    Browser.EDGE,
    Browser.OPERA,
    Browser.FIREFOX,
    Browser.SAFARI,
    Browser.IE,
  ],
  [WebVital.INP]: [Browser.CHROME, Browser.EDGE, Browser.OPERA],
};
