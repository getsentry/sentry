import {useCallback, useMemo} from 'react';

import {fetchSpanFieldValues} from 'sentry/actionCreators/tags';
import {STATIC_SEMVER_TAGS} from 'sentry/components/events/searchBarFieldConstants';
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
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {
  useSpanFieldCustomTags,
  useSpanFieldSupportedTags,
} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

interface SpanSearchQueryBuilderProps {
  initialQuery: string;
  searchSource: string;
  datetime?: PageFilters['datetime'];
  disableLoadingTags?: boolean;
  onBlur?: (query: string, state: CallbackSearchState) => void;
  onSearch?: (query: string, state: CallbackSearchState) => void;
  placeholder?: string;
  projects?: PageFilters['projects'];
  useEap?: boolean;
}

export const getFunctionTags = (supportedAggregates?: AggregationKey[]) => {
  if (!supportedAggregates?.length) {
    return {};
  }

  return supportedAggregates.reduce((acc, item) => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    acc[item] = {
      key: item,
      name: item,
      kind: FieldKind.FUNCTION,
    };
    return acc;
  }, {});
};

function getSpanFieldDefinitionFunction(tags: TagCollection) {
  return (key: string) => {
    return getFieldDefinition(key, 'span', tags[key]?.kind);
  };
}

function useSpanSearchQueryBuilderProps({
  initialQuery,
  searchSource,
  datetime,
  onSearch,
  onBlur,
  placeholder,
  projects,
}: SpanSearchQueryBuilderProps) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const functionTags = useMemo(() => {
    return getFunctionTags();
  }, []);

  const placeholderText = useMemo(() => {
    return placeholder ?? t('Search for spans, users, tags, and more');
  }, [placeholder]);

  const {data: customTags} = useSpanFieldCustomTags({
    projects: projects ?? selection.projects,
  });

  const {data: supportedTags} = useSpanFieldSupportedTags({
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

  return {
    placeholder: placeholderText,
    filterKeys: filterTags,
    initialQuery,
    fieldDefinitionGetter: getSpanFieldDefinitionFunction(filterTags),
    onSearch,
    onBlur,
    searchSource,
    filterKeySections,
    getTagValues: getSpanFilterTagValues,
    disallowUnsupportedFilters: true,
    recentSearches: SavedSearchType.SPAN,
    showUnsubmittedIndicator: true,
    searchOnChange: organization.features.includes('ui-search-on-change'),
  };
}

export function SpanSearchQueryBuilder(props: SpanSearchQueryBuilderProps) {
  const {useEap} = props;

  if (useEap) {
    return <EapSpanSearchQueryBuilderWrapper {...props} />;
  }

  return <IndexedSpanSearchQueryBuilder {...props} />;
}

function IndexedSpanSearchQueryBuilder({
  initialQuery,
  searchSource,
  datetime,
  onSearch,
  onBlur,
  placeholder,
  projects,
}: SpanSearchQueryBuilderProps) {
  const searchQueryBuilderProps = useSpanSearchQueryBuilderProps({
    initialQuery,
    searchSource,
    datetime,
    onSearch,
    onBlur,
    placeholder,
    projects,
  });

  return <SearchQueryBuilder {...searchQueryBuilderProps} />;
}

function EapSpanSearchQueryBuilderWrapper(props: SpanSearchQueryBuilderProps) {
  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

  return (
    <EAPSpanSearchQueryBuilder
      numberTags={numberTags}
      stringTags={stringTags}
      {...props}
    />
  );
}

export interface EAPSpanSearchQueryBuilderProps extends SpanSearchQueryBuilderProps {
  numberTags: TagCollection;
  stringTags: TagCollection;
  autoFocus?: boolean;
  getFilterTokenWarning?: (key: string) => React.ReactNode;
  onChange?: (query: string, state: CallbackSearchState) => void;
  portalTarget?: HTMLElement | null;
  supportedAggregates?: AggregationKey[];
}

export function useEAPSpanSearchQueryBuilderProps(props: EAPSpanSearchQueryBuilderProps) {
  const {numberTags, stringTags, ...rest} = props;

  const numberAttributes = numberTags;
  const stringAttributes = useMemo(() => {
    if (stringTags.hasOwnProperty(SpanIndexedField.RELEASE)) {
      return {
        ...stringTags,
        ...STATIC_SEMVER_TAGS,
      };
    }
    return stringTags;
  }, [stringTags]);

  return useSearchQueryBuilderProps({
    itemType: TraceItemDataset.SPANS,
    numberAttributes,
    stringAttributes,
    ...rest,
  });
}

export function EAPSpanSearchQueryBuilder(props: EAPSpanSearchQueryBuilderProps) {
  const {numberTags, stringTags, ...rest} = props;

  return (
    <TraceItemSearchQueryBuilder
      itemType={TraceItemDataset.SPANS}
      numberAttributes={numberTags}
      stringAttributes={stringTags}
      {...rest}
    />
  );
}
