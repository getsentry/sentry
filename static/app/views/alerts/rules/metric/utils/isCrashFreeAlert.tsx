import {Dataset} from '../types';

/**
 * Currently we can tell if an alert is a crash free alert by the dataset,
 * but this may become more complicated soon
 */
export function isCrashFreeAlert(dataset?: Dataset): boolean {
  return dataset !== undefined && [Dataset.SESSIONS, Dataset.METRICS].includes(dataset);
}
