import {VitalsKey} from './types';

export const INDUSTRY_STANDARDS: Record<VitalsKey, number> = {
  LCP: 2500,
  FCP: 1800,
  appStartCold: 5000,
  appStartWarm: 2000,
};

export const SENTRY_CUSTOMERS: Record<VitalsKey, number> = {
  LCP: 948,
  FCP: 760,
  appStartCold: 4000, // TODO: Update
  appStartWarm: 1500, // TODO: Update
};
