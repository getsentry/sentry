import type {eventWithTime} from 'rrweb/typings/types';

/**
 * Merge a list of replay events and sort by `timestamp`
 */

export default function mergeAndSortEvents(...args: eventWithTime[][]): eventWithTime[] {
  return Array.prototype.concat(...args).sort((a, b) => {
    return a.timestamp - b.timestamp;
  });
}
