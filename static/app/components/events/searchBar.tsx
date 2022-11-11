import {useEffect, useMemo, useRef} from 'react';
import * as Sentry from '@sentry/react';
import {Transaction} from '@sentry/types';
import assign from 'lodash/assign';
import flatten from 'lodash/flatten';
import memoize from 'lodash/memoize';
import omit from 'lodash/omit';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import type {Organization, TagCollection} from 'sentry/types';
import {SavedSearchType} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {
  Field,
  FIELD_TAGS,
  isAggregateField,
  isEquation,
  isMeasurement,
  SEMVER_TAGS,
  SPAN_OP_BREAKDOWN_FIELDS,
  TRACING_FIELDS,
} from 'sentry/utils/discover/fields';
import {FieldKey, FieldKind} from 'sentry/utils/fields';
import Measurements from 'sentry/utils/measurements/measurements';
import useApi from 'sentry/utils/useApi';
import withTags from 'sentry/utils/withTags';
import {isCustomMeasurement} from 'sentry/views/dashboardsV2/utils';

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
      ...measurements[key],
      kind: FieldKind.MEASUREMENT,
    };
    return tags;
  }, measurementsWithKind);
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

export type SearchBarProps = Omit<React.ComponentProps<typeof SmartSearchBar>, 'tags'> & {
  organization: Organization;
  tags: TagCollection;
  customMeasurements?: CustomMeasurementCollection;
  fields?: Readonly<Field[]>;
  includeSessionTagsValues?: boolean;
  /**
   * Used to define the max height of the menu in px.
   */
  maxMenuHeight?: number;
  maxSearchItems?: React.ComponentProps<typeof SmartSearchBar>['maxSearchItems'];
  omitTags?: string[];
  projectIds?: number[] | Readonly<number[]>;
};

function SearchBar(props: SearchBarProps) {
  const {
    maxSearchItems,
    organization,
    tags,
    omitTags,
    fields,
    projectIds,
    includeSessionTagsValues,
    maxMenuHeight,
    customMeasurements,
  } = props;

  const api = useApi();
  const collectedTransactionFromGetTagsListRef = useRef<boolean>(false);

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

      return fetchTagValues({
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
      }).then(
        results =>
          flatten(results.filter(({name}) => defined(name)).map(({name}) => name)),
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
    // We will only collect a transaction once and only if the number of tags > 0
    // This is to avoid a large number of transactions being sent to Sentry. The 0 check
    // is to avoid collecting a transaction when tags are not loaded yet.
    let transaction: Transaction | undefined = undefined;
    if (!collectedTransactionFromGetTagsListRef.current && Object.keys(tags).length > 0) {
      transaction = Sentry.startTransaction({
        name: 'SearchBar.getTagList',
      });
      // Mark as collected - if code below errors, we risk never collecting
      // a transaction in that case, but that is fine.
      collectedTransactionFromGetTagsListRef.current = true;
    }

    const measurementsWithKind = getMeasurementTags(measurements, customMeasurements);
    const orgHasPerformanceView = organization.features.includes('performance-view');

    const combinedTags: TagCollection = orgHasPerformanceView
      ? Object.assign(
          {},
          measurementsWithKind,
          functionTags,
          STATIC_SPAN_TAGS,
          STATIC_FIELD_TAGS
        )
      : Object.assign({}, STATIC_FIELD_TAGS_WITHOUT_TRACING);

    assign(combinedTags, tagsWithKind, STATIC_FIELD_TAGS, STATIC_SEMVER_TAGS);

    combinedTags.has = {
      key: FieldKey.HAS,
      name: 'Has property',
      values: Object.keys(combinedTags).sort((a, b) => {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      }),
      predefined: true,
      kind: FieldKind.FIELD,
    };

    const list =
      omitTags && omitTags.length > 0 ? omit(combinedTags, omitTags) : combinedTags;

    if (transaction) {
      const totalCount: number = Object.keys(list).length;
      transaction.setTag('tags.totalCount', totalCount);
      const countGroup = [
        1, 5, 10, 20, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 10000,
      ].find(n => totalCount <= n);
      transaction.setTag('tags.totalCount.grouped', `<=${countGroup}`);
      transaction.finish();
    }
    return list;
  };

  return (
    <Measurements>
      {({measurements}) => (
        <SmartSearchBar
          hasRecentSearches
          savedSearchType={SavedSearchType.EVENT}
          onGetTagValues={getEventFieldValues}
          supportedTags={getTagList(measurements)}
          prepareQuery={query => {
            // Prepare query string (e.g. strip special characters like negation operator)
            return query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
          }}
          maxSearchItems={maxSearchItems}
          excludedTags={['environment']}
          maxMenuHeight={maxMenuHeight ?? 300}
          customPerformanceMetrics={customMeasurements}
          {...props}
        />
      )}
    </Measurements>
  );
}

export default withTags(SearchBar);
