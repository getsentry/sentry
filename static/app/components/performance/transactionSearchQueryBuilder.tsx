import {useCallback, useEffect, useMemo} from 'react';

import {fetchTagValues, loadOrganizationTags} from 'sentry/actionCreators/tags';
import {getHasTag} from 'sentry/components/events/searchBar';
import {
  STATIC_FIELD_TAGS_WITHOUT_ERROR_FIELDS,
  STATIC_SEMVER_TAGS,
  STATIC_SPAN_TAGS,
} from 'sentry/components/events/searchBarFieldConstants';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {CallbackSearchState} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {SavedSearchType, type Tag, type TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {
  ALL_INSIGHTS_FILTER_KEY_SECTIONS,
  isAggregateField,
  isMeasurement,
} from 'sentry/utils/discover/fields';
import {DEVICE_CLASS_TAG_VALUES, isDeviceClass} from 'sentry/utils/fields';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useTags from 'sentry/utils/useTags';

interface TransactionSearchQueryBuilderProps {
  initialQuery: string;
  searchSource: string;
  datetime?: PageFilters['datetime'];
  disableLoadingTags?: boolean;
  filterKeyMenuWidth?: number;
  onSearch?: (query: string, state: CallbackSearchState) => void;
  placeholder?: string;
  projects?: PageFilters['projects'] | Readonly<number[]>;
  trailingItems?: React.ReactNode;
}

export function TransactionSearchQueryBuilder({
  initialQuery,
  searchSource,
  datetime,
  onSearch,
  placeholder,
  projects,
  disableLoadingTags,
  filterKeyMenuWidth,
  trailingItems,
}: TransactionSearchQueryBuilderProps) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const tags = useTags();

  const placeholderText = useMemo(() => {
    return placeholder ?? t('Search for events, users, tags, and more');
  }, [placeholder]);

  useEffect(() => {
    if (!disableLoadingTags) {
      loadOrganizationTags(api, organization.slug, selection);
    }
  }, [api, organization.slug, selection, disableLoadingTags]);

  const filterTags = useMemo(() => {
    const measurements = getMeasurements();

    const combinedTags: TagCollection = {
      ...STATIC_SPAN_TAGS,
      ...STATIC_FIELD_TAGS_WITHOUT_ERROR_FIELDS,
      ...STATIC_SEMVER_TAGS,
      ...measurements,
      ...tags,
    };

    combinedTags.has = getHasTag(combinedTags);
    return combinedTags;
  }, [tags]);

  const filterKeySections = useMemo(
    () => [
      ...ALL_INSIGHTS_FILTER_KEY_SECTIONS,
      {
        value: 'custom_fields',
        label: 'Custom Tags',
        children: Object.keys(tags),
      },
    ],
    [tags]
  );

  // This is adapted from the `getEventFieldValues` function in `events/searchBar.tsx`
  const getTransactionFilterTagValues = useCallback(
    async (tag: Tag, queryString: string) => {
      if (isAggregateField(tag.key) || isMeasurement(tag.key)) {
        // We can't really auto suggest values for aggregate fields
        // or measurements, so we simply don't
        return Promise.resolve([]);
      }
      //
      // device.class is stored as "numbers" in snuba, but we want to suggest high, medium,
      // and low search filter values because discover maps device.class to these values.
      if (isDeviceClass(tag.key)) {
        return Promise.resolve(DEVICE_CLASS_TAG_VALUES);
      }

      try {
        const results = await fetchTagValues({
          api,
          orgSlug: organization.slug,
          tagKey: tag.key,
          search: queryString,
          projectIds: projects?.map(String) ?? selection.projects?.map(String),
          includeTransactions: true,
          sort: '-count',
          endpointParams: normalizeDateTimeParams(datetime ?? selection.datetime),
        });

        return results.filter(({name}) => defined(name)).map(({name}) => name);
      } catch (e) {
        throw new Error(`Unable to fetch event field values: ${e}`);
      }
    },
    [api, organization, datetime, projects, selection.datetime, selection.projects]
  );

  return (
    <SearchQueryBuilder
      placeholder={placeholderText}
      filterKeys={filterTags}
      initialQuery={initialQuery}
      onSearch={onSearch}
      searchSource={searchSource}
      filterKeySections={filterKeySections}
      getTagValues={getTransactionFilterTagValues}
      disallowFreeText
      disallowUnsupportedFilters
      recentSearches={SavedSearchType.EVENT}
      filterKeyMenuWidth={filterKeyMenuWidth}
      trailingItems={trailingItems}
    />
  );
}
