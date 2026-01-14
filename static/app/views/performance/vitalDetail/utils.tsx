import type {Theme} from '@emotion/react';

import {IconHappy, IconMeh, IconSad} from 'sentry/icons';
import {WebVital} from 'sentry/utils/fields';
import {Browser} from 'sentry/utils/performance/vitals/constants';

export const webVitalPoor = {
  [WebVital.FP]: 3000,
  [WebVital.FCP]: 3000,
  [WebVital.LCP]: 4000,
  [WebVital.FID]: 300,
  [WebVital.CLS]: 0.25,
};

export const webVitalMeh = {
  [WebVital.FP]: 1000,
  [WebVital.FCP]: 1000,
  [WebVital.LCP]: 2500,
  [WebVital.FID]: 100,
  [WebVital.CLS]: 0.1,
};

export enum VitalState {
  POOR = 'Poor',
  MEH = 'Meh',
  GOOD = 'Good',
}

export function makeVitalStateColors(theme: Theme): Record<VitalState, string> {
  return {
    [VitalState.POOR]: theme.colors.red400,
    [VitalState.MEH]: theme.colors.yellow400,
    [VitalState.GOOD]: theme.colors.green400,
  };
}

export const vitalStateIcons: Record<VitalState, React.ReactNode> = {
  [VitalState.POOR]: <IconSad variant="danger" />,
  [VitalState.MEH]: <IconMeh variant="warning" />,
  [VitalState.GOOD]: <IconHappy variant="success" />,
};

export const vitalSupportedBrowsers: Partial<Record<WebVital, Browser[]>> = {
  [WebVital.LCP]: [
    Browser.CHROME,
    Browser.EDGE,
    Browser.OPERA,
    Browser.FIREFOX,
    Browser.SAFARI,
  ],
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
  [WebVital.INP]: [
    Browser.CHROME,
    Browser.EDGE,
    Browser.OPERA,
    Browser.FIREFOX,
    Browser.SAFARI,
  ],
};
