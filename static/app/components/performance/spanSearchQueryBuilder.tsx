import {useCallback, useMemo} from 'react';

import {fetchSpanFieldValues} from 'sentry/actionCreators/tags';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {CallbackSearchState} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {SavedSearchType, type Tag, type TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {isAggregateField, isMeasurement} from 'sentry/utils/discover/fields';
import {
  type AggregationKey,
  DEVICE_CLASS_TAG_VALUES,
  FieldKind,
  getFieldDefinition,
  isDeviceClass,
} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';
import type {SpanIndexedResponse} from 'sentry/views/insights/types';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {useSpanFieldCustomTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

interface SpanSearchQueryBuilderProps {
  builtinNumerics: TagCollection;
  builtinStrings: TagCollection;
  initialQuery: string;
  searchSource: string;
  customNumerics?: TagCollection;
  customStrings?: TagCollection;
  datetime?: PageFilters['datetime'];
  functions?: TagCollection;
  onSearch?: (query: string, state: CallbackSearchState) => void;
  placeholder?: string;
  projects?: PageFilters['projects'];
}

const getSpanFieldDefinition = (key: string) => {
  return getFieldDefinition(key, 'span');
};

export function SpanSearchQueryBuilder({
  initialQuery,
  searchSource,
  builtinNumerics,
  builtinStrings,
  customNumerics,
  customStrings,
  datetime,
  functions,
  onSearch,
  placeholder,
  projects,
}: SpanSearchQueryBuilderProps) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const filterKeys = useMemo(() => {
    return {
      ...(builtinNumerics || {}),
      ...(builtinStrings || {}),
      ...(customNumerics || {}),
      ...(customStrings || {}),
      ...(functions || {}),
    };
  }, [builtinNumerics, builtinStrings, customNumerics, customStrings, functions]);

  const filterKeySections = useMemo(() => {
    return [
      ...SPANS_FILTER_KEY_SECTIONS.map(section => {
        return {
          ...section,
          children: section.children.filter(child => {
            return (
              builtinNumerics.hasOwnProperty(child) ||
              builtinStrings.hasOwnProperty(child)
            );
          }),
        };
      }),
      {
        value: 'custom_fields',
        label: 'Custom Tags',
        children: [
          ...Object.keys(customNumerics || {}),
          ...Object.keys(customStrings || {}),
        ],
      },
    ];
  }, [builtinNumerics, builtinStrings, customNumerics, customStrings]);

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
      placeholder={placeholder ?? t('Search for spans, users, tags, and more')}
      filterKeys={filterKeys}
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

interface UseSpanFunctionTagsOptions {
  functions?: AggregationKey[];
}

export function useSpanFunctionTags({
  functions,
}: UseSpanFunctionTagsOptions): TagCollection {
  const functionTags = useMemo(() => {
    if (!functions?.length) {
      return {};
    }

    return functions.reduce((acc, item) => {
      acc[item] = {
        key: item,
        name: item,
        kind: FieldKind.FUNCTION,
      };
      return acc;
    }, {});
  }, [functions]);

  return functionTags;
}

interface UseSpanCustomTagsOptions {
  projects?: PageFilters['projects'];
}

export function useSpanCustomStringTags({
  projects,
}: UseSpanCustomTagsOptions): TagCollection {
  // TODO: fetch from eap spans
  const customStringTags = useSpanFieldCustomTags({
    projects,
  });

  return customStringTags;
}

export function useSpanCustomNumericTags({}: UseSpanCustomTagsOptions): TagCollection {
  // TODO: nothing for now
  return {};
}

interface UseSpanBuiltinTagsOptions {
  excludedTags?: string[];
}

export function useSpanBuiltinStringTags({
  excludedTags,
}: UseSpanBuiltinTagsOptions): TagCollection {
  const builtinTags: TagCollection = useMemo(() => {
    const stringFields: Record<keyof PickByType<SpanIndexedResponse, string>, 0> = {
      [SpanIndexedField.ENVIRONMENT]: 0,
      [SpanIndexedField.RELEASE]: 0,
      [SpanIndexedField.SDK_NAME]: 0,
      [SpanIndexedField.SPAN_CATEGORY]: 0,
      [SpanIndexedField.SPAN_GROUP]: 0,
      [SpanIndexedField.SPAN_MODULE]: 0,
      [SpanIndexedField.SPAN_DESCRIPTION]: 0,
      [SpanIndexedField.SPAN_OP]: 0,
      [SpanIndexedField.SPAN_AI_PIPELINE_GROUP]: 0,
      [SpanIndexedField.SPAN_STATUS]: 0,
      [SpanIndexedField.ID]: 0,
      [SpanIndexedField.SPAN_ACTION]: 0,
      [SpanIndexedField.TRACE]: 0,
      [SpanIndexedField.TRANSACTION]: 0,
      [SpanIndexedField.TRANSACTION_ID]: 0,
      [SpanIndexedField.TRANSACTION_METHOD]: 0,
      [SpanIndexedField.TRANSACTION_OP]: 0,
      [SpanIndexedField.RAW_DOMAIN]: 0,
      [SpanIndexedField.TIMESTAMP]: 0,
      [SpanIndexedField.PROJECT]: 0,
      [SpanIndexedField.PROFILE_ID]: 0,
      [SpanIndexedField.RESOURCE_RENDER_BLOCKING_STATUS]: 0,
      [SpanIndexedField.HTTP_RESPONSE_CONTENT_LENGTH]: 0,
      [SpanIndexedField.ORIGIN_TRANSACTION]: 0,
      [SpanIndexedField.REPLAY_ID]: 0,
      [SpanIndexedField.BROWSER_NAME]: 0,
      [SpanIndexedField.USER]: 0,
      [SpanIndexedField.USER_ID]: 0,
      [SpanIndexedField.USER_USERNAME]: 0,
      [SpanIndexedField.USER_EMAIL]: 0,
      [SpanIndexedField.RESPONSE_CODE]: 0,
      [SpanIndexedField.CACHE_HIT]: 0,
      [SpanIndexedField.TRACE_STATUS]: 0,
      [SpanIndexedField.MESSAGING_MESSAGE_ID]: 0,
      [SpanIndexedField.MESSAGING_MESSAGE_DESTINATION_NAME]: 0,
      [SpanIndexedField.USER_GEO_SUBREGION]: 0,
    };

    const excludedFields: string[] = [
      SpanIndexedField.SPAN_AI_PIPELINE_GROUP,
      SpanIndexedField.SPAN_CATEGORY,
      SpanIndexedField.SPAN_GROUP,
      ...(excludedTags || []),
    ];

    return Object.fromEntries(
      Object.keys(stringFields)
        .filter(v => !excludedFields.includes(v))
        .map(v => [v, {key: v, name: v}])
    );
  }, [excludedTags]);

  return builtinTags;
}

export function useSpanBuiltinNumericTags(): TagCollection {
  const builtinTags: TagCollection = useMemo(() => {
    const stringFields: Record<keyof PickByType<SpanIndexedResponse, number>, 0> = {
      [SpanIndexedField.SPAN_DURATION]: 0,
      [SpanIndexedField.SPAN_SELF_TIME]: 0,
      [SpanIndexedField.PROJECT_ID]: 0,
      [SpanIndexedField.INP]: 0,
      [SpanIndexedField.INP_SCORE]: 0,
      [SpanIndexedField.INP_SCORE_WEIGHT]: 0,
      [SpanIndexedField.TOTAL_SCORE]: 0,
      [SpanIndexedField.CACHE_ITEM_SIZE]: 0,
      [SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE]: 0,
      [SpanIndexedField.MESSAGING_MESSAGE_RECEIVE_LATENCY]: 0,
      [SpanIndexedField.MESSAGING_MESSAGE_RETRY_COUNT]: 0,
    };

    return Object.fromEntries(Object.keys(stringFields).map(v => [v, {key: v, name: v}]));
  }, []);

  return builtinTags;
}

type PickByType<T, Value> = {
  [P in keyof T as T[P] extends Value | undefined ? P : never]: T[P];
};
