import {VitalsKey} from './types';

// these are industry standards determined by Google (https://web.dev/defining-core-web-vitals-thresholds/)
export const INDUSTRY_STANDARDS: Record<VitalsKey, number> = {
  LCP: 2500,
  FCP: 1800,
  appStartCold: 5000,
  appStartWarm: 2000,
};

// these were determined using a Looker query and might change over time
export const SENTRY_CUSTOMERS: Record<VitalsKey, number> = {
  LCP: 948,
  FCP: 760,
  appStartCold: 2260,
  appStartWarm: 1900,
};
