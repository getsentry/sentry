import {useEffect, useMemo} from 'react';
import memoize from 'lodash/memoize';
import omit from 'lodash/omit';

import {fetchSpanFieldValues, fetchTagValues} from 'sentry/actionCreators/tags';
import type {SearchConfig} from 'sentry/components/searchSyntax/parser';
import {defaultConfig} from 'sentry/components/searchSyntax/parser';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import type {TagCollection} from 'sentry/types/group';
import {SavedSearchType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {Field} from 'sentry/utils/discover/fields';
import {
  FIELD_TAGS,
  isAggregateField,
  isEquation,
  isMeasurement,
  SEMVER_TAGS,
  SPAN_OP_BREAKDOWN_FIELDS,
  TRACING_FIELDS,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  DEVICE_CLASS_TAG_VALUES,
  FieldKey,
  FieldKind,
  isDeviceClass,
} from 'sentry/utils/fields';
import Measurements from 'sentry/utils/measurements/measurements';
import useApi from 'sentry/utils/useApi';
import withTags from 'sentry/utils/withTags';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

const STATIC_FIELD_TAGS_SET = new Set(Object.keys(FIELD_TAGS));
const getFunctionTags = (fields: Readonly<Field[]> | undefined) => {
  if (!fields?.length) {
    return [];
  }
  return fields.reduce((acc, item) => {
    if (
      !STATIC_FIELD_TAGS_SET.has(item.field) &&
      !isEquation(item.field) &&
      !isCustomMeasurement(item.field)
    ) {
      acc[item.field] = {key: item.field, name: item.field, kind: FieldKind.FUNCTION};
    }

    return acc;
  }, {});
};

const getMeasurementTags = (
  measurements: Parameters<
    React.ComponentProps<typeof Measurements>['children']
  >[0]['measurements'],
  customMeasurements:
    | Parameters<React.ComponentProps<typeof Measurements>['children']>[0]['measurements']
    | undefined
) => {
  const measurementsWithKind = Object.keys(measurements).reduce((tags, key) => {
    tags[key] = {
      ...measurements[key],
      kind: FieldKind.MEASUREMENT,
    };
    return tags;
  }, {});

  if (!customMeasurements) {
    return measurementsWithKind;
  }

  return Object.keys(customMeasurements).reduce((tags, key) => {
    tags[key] = {
      ...customMeasurements[key],
      kind: FieldKind.MEASUREMENT,
    };
    return tags;
  }, measurementsWithKind);
};

const getSearchConfigFromCustomPerformanceMetrics = (
  customPerformanceMetrics?: CustomMeasurementCollection
): Partial<SearchConfig> => {
  if (!customPerformanceMetrics) {
    return {};
  }
  const searchConfigMap: Record<string, string[]> = {
    sizeKeys: [...defaultConfig.sizeKeys],
    durationKeys: [...defaultConfig.durationKeys],
    percentageKeys: [...defaultConfig.percentageKeys],
    numericKeys: [...defaultConfig.numericKeys],
  };
  Object.keys(customPerformanceMetrics).forEach(metricName => {
    const {fieldType} = customPerformanceMetrics[metricName];
    switch (fieldType) {
      case 'size':
        searchConfigMap.sizeKeys.push(metricName);
        break;
      case 'duration':
        searchConfigMap.durationKeys.push(metricName);
        break;
      case 'percentage':
        searchConfigMap.percentageKeys.push(metricName);
        break;
      default:
        searchConfigMap.numericKeys.push(metricName);
    }
  });
  const searchConfig = {
    sizeKeys: new Set(searchConfigMap.sizeKeys),
    durationKeys: new Set(searchConfigMap.durationKeys),
    percentageKeys: new Set(searchConfigMap.percentageKeys),
    numericKeys: new Set(searchConfigMap.numericKeys),
  };
  return searchConfig;
};

const STATIC_FIELD_TAGS = Object.keys(FIELD_TAGS).reduce((tags, key) => {
  tags[key] = {
    ...FIELD_TAGS[key],
    kind: FieldKind.FIELD,
  };
  return tags;
}, {});

const STATIC_FIELD_TAGS_WITHOUT_TRACING = omit(STATIC_FIELD_TAGS, TRACING_FIELDS);

const STATIC_SPAN_TAGS = SPAN_OP_BREAKDOWN_FIELDS.reduce((tags, key) => {
  tags[key] = {name: key, kind: FieldKind.METRICS};
  return tags;
}, {});

const STATIC_SEMVER_TAGS = Object.keys(SEMVER_TAGS).reduce((tags, key) => {
  tags[key] = {
    ...SEMVER_TAGS[key],
    kind: FieldKind.FIELD,
  };
  return tags;
}, {});

export const getHasTag = (tags: TagCollection) => ({
  key: FieldKey.HAS,
  name: 'Has property',
  values: Object.keys(tags).sort((a, b) => {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  }),
  predefined: true,
  kind: FieldKind.FIELD,
});

export type SearchBarProps = Omit<React.ComponentProps<typeof SmartSearchBar>, 'tags'> & {
  organization: Organization;
  tags: TagCollection;
  customMeasurements?: CustomMeasurementCollection;
  dataset?: DiscoverDatasets;
  fields?: Readonly<Field[]>;
  includeSessionTagsValues?: boolean;
  /**
   * Used to define the max height of the menu in px.
   */
  maxMenuHeight?: number;
  maxSearchItems?: React.ComponentProps<typeof SmartSearchBar>['maxSearchItems'];
  metricAlert?: boolean;
  omitTags?: string[];
  projectIds?: number[] | Readonly<number[]>;
  supportedTags?: TagCollection | undefined;
};

function SearchBar(props: SearchBarProps) {
  const {
    maxSearchItems,
    organization,
    tags,
    metricAlert = false,
    omitTags,
    supportedTags,
    fields,
    projectIds,
    includeSessionTagsValues,
    maxMenuHeight,
    customMeasurements,
    dataset,
  } = props;

  const api = useApi();

  const functionTags = useMemo(() => getFunctionTags(fields), [fields]);
  const tagsWithKind = useMemo(() => {
    return Object.keys(tags).reduce((acc, key) => {
      acc[key] = {
        ...tags[key],
        kind: FieldKind.TAG,
      };
      return acc;
    }, {});
  }, [tags]);

  useEffect(() => {
    // Clear memoized data on mount to make tests more consistent.
    getEventFieldValues.cache.clear?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIds]);

  // Returns array of tag values that substring match `query`; invokes `callback`
  // with data when ready
  const getEventFieldValues = memoize(
    (tag, query, endpointParams): Promise<string[]> => {
      const projectIdStrings = (projectIds as Readonly<number>[])?.map(String);

      if (isAggregateField(tag.key) || isMeasurement(tag.key)) {
        // We can't really auto suggest values for aggregate fields
        // or measurements, so we simply don't
        return Promise.resolve([]);
      }

      // device.class is stored as "numbers" in snuba, but we want to suggest high, medium,
      // and low search filter values because discover maps device.class to these values.
      if (isDeviceClass(tag.key)) {
        return Promise.resolve(DEVICE_CLASS_TAG_VALUES);
      }

      const fetchPromise =
        dataset === DiscoverDatasets.SPANS_INDEXED
          ? fetchSpanFieldValues({
              api,
              orgSlug: organization.slug,
              fieldKey: tag.key,
              search: query,
              projectIds: projectIdStrings,
              endpointParams,
            })
          : fetchTagValues({
              api,
              orgSlug: organization.slug,
              tagKey: tag.key,
              search: query,
              projectIds: projectIdStrings,
              endpointParams,
              // allows searching for tags on transactions as well
              includeTransactions: true,
              // allows searching for tags on sessions as well
              includeSessions: includeSessionTagsValues,
            });

      return fetchPromise.then(
        results => results.filter(({name}) => defined(name)).map(({name}) => name),
        () => {
          throw new Error('Unable to fetch event field values');
        }
      );
    },
    ({key}, query) => `${key}-${query}`
  );

  const getTagList = (
    measurements: Parameters<
      React.ComponentProps<typeof Measurements>['children']
    >[0]['measurements']
  ) => {
    const measurementsWithKind = getMeasurementTags(measurements, customMeasurements);
    const orgHasPerformanceView = organization.features.includes('performance-view');

    // If it is not a metric alert search bar and supportedTags has a value, return supportedTags
    // If it is a metric alert search bar, combine supportedTags with getTagList tags
    if (metricAlert === false && supportedTags !== undefined) {
      return supportedTags;
    }

    const combinedTags: TagCollection = orgHasPerformanceView
      ? Object.assign(
          {},
          measurementsWithKind,
          functionTags,
          STATIC_SPAN_TAGS,
          STATIC_FIELD_TAGS
        )
      : Object.assign({}, STATIC_FIELD_TAGS_WITHOUT_TRACING);

    Object.assign(
      combinedTags,
      tagsWithKind,
      STATIC_FIELD_TAGS,
      STATIC_SEMVER_TAGS,
      supportedTags
    );

    combinedTags.has = getHasTag(combinedTags);

    const list =
      omitTags && omitTags.length > 0 ? omit(combinedTags, omitTags) : combinedTags;
    return list;
  };

  const customPerformanceMetricsSearchConfig = useMemo(
    () => getSearchConfigFromCustomPerformanceMetrics(customMeasurements),
    [customMeasurements]
  );

  return (
    <Measurements>
      {({measurements}) => (
        <SmartSearchBar
          hasRecentSearches
          savedSearchType={SavedSearchType.EVENT}
          onGetTagValues={getEventFieldValues}
          prepareQuery={query => {
            // Prepare query string (e.g. strip special characters like negation operator)
            return query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
          }}
          maxSearchItems={maxSearchItems}
          excludedTags={[FieldKey.ENVIRONMENT, FieldKey.TOTAL_COUNT]}
          maxMenuHeight={maxMenuHeight ?? 300}
          {...customPerformanceMetricsSearchConfig}
          {...props}
          supportedTags={getTagList(measurements)}
        />
      )}
    </Measurements>
  );
}

export default withTags(SearchBar);
