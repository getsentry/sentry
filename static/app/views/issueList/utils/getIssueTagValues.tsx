import {useFetchOrganizationTagKeyValues} from 'sentry/actionCreators/tags';
import type {Organization, PageFilters} from 'sentry/types';
import type {Tag, TagValue} from 'sentry/types/group';
import {getUtcDateString} from 'sentry/utils/dates';
import {DEVICE_CLASS_TAG_VALUES, isDeviceClass} from 'sentry/utils/fields';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

type FetchIssueTagValuesParams = {
  organization: Organization;
  pageFilters: PageFilters;
  useCache?: boolean;
};

/**
 * Returns a function that fetches tag values for a given tag key. Useful as
 * an input to the SearchQueryBuilder component.
 *
 * Accepts a function that fetches tag values for a given tag key and search query.
 */
export function makeGetIssueTagKeyValues({
  organization,
  pageFilters,
  useCache = true,
}: FetchIssueTagValuesParams): (tag: Tag, search: string) => Promise<string[]> {
  return async (tag: Tag, search: string): Promise<string[]> => {
    const orgSlug = organization.slug;
    const projectIds = pageFilters.projects.map(id => id.toString());
    const endpointParams = {
      start: pageFilters.datetime.start
        ? getUtcDateString(pageFilters.datetime.start)
        : undefined,
      end: pageFilters.datetime.end
        ? getUtcDateString(pageFilters.datetime.end)
        : undefined,
      statsPeriod: pageFilters.datetime.period,
    };

    const {data: eventsTagValues = []} = useFetchOrganizationTagKeyValues(
      {
        orgSlug,
        tagKey: tag.key,
        search,
        dataset: Dataset.ERRORS,
        useCache: useCache,
        projectIds,
        ...endpointParams,
      },
      {}
    );

    const {data: issuePlatformTagValues = []} = useFetchOrganizationTagKeyValues(
      {
        orgSlug,
        tagKey: tag.key,
        search,
        dataset: Dataset.ISSUE_PLATFORM,
        useCache: useCache,
        projectIds,
        ...endpointParams,
      },
      {}
    );

    // device.class is stored as "numbers" in snuba, but we want to suggest high, medium,
    // and low search filter values because discover maps device.class to these values.
    if (isDeviceClass(tag.key)) {
      return await Promise.resolve(DEVICE_CLASS_TAG_VALUES);
    }

    const allTagValuesDict: Record<string, TagValue> = {};
    eventsTagValues.forEach(value => {
      allTagValuesDict[value.name] = value;
    });

    issuePlatformTagValues.forEach(value => {
      if (allTagValuesDict[value.name]) {
        allTagValuesDict[value.name].count += value.count;
      }
      allTagValuesDict[value.name] = value;
    });

    const allTagValues = Object.values(allTagValuesDict);

    return await Promise.resolve(
      allTagValues.map(({value}) => {
        // Truncate results to 5000 characters to avoid exceeding the max url query length
        // The message attribute for example can be 8192 characters.
        if (typeof value === 'string' && value.length > 5000) {
          return value.substring(0, 5000);
        }
        return value;
      })
    );
  };
}
