import type {Tag, TagValue} from 'sentry/types/group';
import {DEVICE_CLASS_TAG_VALUES, isDeviceClass} from 'sentry/utils/fields';

/**
 * Returns a function that fetches tag values for a given tag key. Useful as
 * an input to the SearchQueryBuilder component.
 *
 * Accepts a function that fetches tag values for a given tag key and search query.
 */
export function makeGetIssueTagValues(
  tagValueLoader: (key: string, search: string) => Promise<TagValue[]>
) {
  return async (tag: Tag, query: string): Promise<string[]> => {
    // device.class is stored as "numbers" in snuba, but we want to suggest high, medium,
    // and low search filter values because discover maps device.class to these values.
    if (isDeviceClass(tag.key)) {
      return DEVICE_CLASS_TAG_VALUES;
    }
    const values = await tagValueLoader(tag.key, query);
    return values.map(({value}) => {
      // Truncate results to 5000 characters to avoid exceeding the max url query length
      // The message attribute for example can be 8192 characters.
      if (typeof value === 'string' && value.length > 5000) {
        return value.substring(0, 5000);
      }
      return value;
    });
  };
}
