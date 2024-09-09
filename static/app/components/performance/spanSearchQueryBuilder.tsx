import {useCallback, useMemo} from 'react';

import {fetchSpanFieldValues} from 'sentry/actionCreators/tags';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {CallbackSearchState} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {SavedSearchType, type Tag, type TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {
  isAggregateField,
  isEquation,
  isMeasurement,
  parseFunction,
} from 'sentry/utils/discover/fields';
import {
  DEVICE_CLASS_TAG_VALUES,
  FieldKind,
  getFieldDefinition,
  isDeviceClass,
} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';
import {
  useSpanFieldCustomTags,
  useSpanFieldSupportedTags,
} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

import {STATIC_FIELD_TAGS_SET} from '../events/searchBarFieldConstants';

interface SpanSearchQueryBuilderProps {
  initialQuery: string;
  searchSource: string;
  datetime?: PageFilters['datetime'];
  disableLoadingTags?: boolean;
  onSearch?: (query: string, state: CallbackSearchState) => void;
  placeholder?: string;
  projects?: PageFilters['projects'];
}

const getFunctionTags = (fields: string[]) => {
  if (!fields?.length) {
    return [];
  }
  return fields.reduce((acc, item) => {
    if (
      !STATIC_FIELD_TAGS_SET.has(item) &&
      !isEquation(item) &&
      !isCustomMeasurement(item)
    ) {
      const parsedFunction = parseFunction(item);
      if (parsedFunction) {
        acc[parsedFunction.name] = {
          key: parsedFunction.name,
          name: parsedFunction.name,
          kind: FieldKind.FUNCTION,
        };
      }
    }

    return acc;
  }, {});
};

const getSpanFieldDefinition = (key: string) => {
  return getFieldDefinition(key, 'span');
};

export function SpanSearchQueryBuilder({
  initialQuery,
  searchSource,
  datetime,
  onSearch,
  placeholder,
  projects,
}: SpanSearchQueryBuilderProps) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [groupBys] = useGroupBys();
  const [visualizes] = useVisualizes();
  const [resultsMode] = useResultMode();

  const fields = useMemo(() => {
    return [...groupBys, ...visualizes.flatMap(visualize => visualize.yAxes)].filter(
      Boolean
    );
  }, [groupBys, visualizes]);

  const functionTags = useMemo(() => {
    return resultsMode === 'samples' ? [] : getFunctionTags(fields);
  }, [fields, resultsMode]);

  const placeholderText = useMemo(() => {
    return placeholder ?? t('Search for spans, users, tags, and more');
  }, [placeholder]);

  const customTags = useSpanFieldCustomTags({
    projects: projects ?? selection.projects,
  });

  const supportedTags = useSpanFieldSupportedTags({
    projects: projects ?? selection.projects,
  });

  const filterTags: TagCollection = useMemo(() => {
    return {...functionTags, ...supportedTags};
  }, [supportedTags, functionTags]);

  const filterKeySections = useMemo(() => {
    return [
      ...SPANS_FILTER_KEY_SECTIONS,
      {
        value: 'custom_fields',
        label: 'Custom Tags',
        children: Object.keys(customTags),
      },
    ];
  }, [customTags]);

  const getSpanFilterTagValues = useCallback(
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
        const results = await fetchSpanFieldValues({
          api,
          orgSlug: organization.slug,
          fieldKey: tag.key,
          search: queryString,
          projectIds: projects?.map(String) ?? selection.projects?.map(String),
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
      fieldDefinitionGetter={getSpanFieldDefinition}
      onSearch={onSearch}
      searchSource={searchSource}
      filterKeySections={filterKeySections}
      getTagValues={getSpanFilterTagValues}
      disallowFreeText
      disallowUnsupportedFilters
      recentSearches={SavedSearchType.SPAN}
    />
  );
}
