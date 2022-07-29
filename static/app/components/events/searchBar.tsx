import {useEffect} from 'react';
import assign from 'lodash/assign';
import flatten from 'lodash/flatten';
import memoize from 'lodash/memoize';
import omit from 'lodash/omit';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {Organization, SavedSearchType, Tag, TagCollection} from 'sentry/types';
import {defined} from 'sentry/utils';
import {
  Field,
  FIELD_TAGS,
  isAggregateField,
  isEquation,
  isMeasurement,
  SEMVER_TAGS,
  TRACING_FIELDS,
} from 'sentry/utils/discover/fields';
import {FieldKey, FieldKind} from 'sentry/utils/fields';
import Measurements from 'sentry/utils/measurements/measurements';
import useApi from 'sentry/utils/useApi';
import withTags from 'sentry/utils/withTags';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

const getFunctionTags = (fields: Readonly<Field[]>) =>
  Object.fromEntries(
    fields
      .filter(
        item => !Object.keys(FIELD_TAGS).includes(item.field) && !isEquation(item.field)
      )
      .map(item => [
        item.field,
        {key: item.field, name: item.field, kind: FieldKind.FUNCTION},
      ])
  );

const getFieldTags = () =>
  Object.fromEntries(
    Object.keys(FIELD_TAGS).map(key => [
      key,
      {
        ...FIELD_TAGS[key],
        kind: FieldKind.FIELD,
      },
    ])
  );

const getMeasurementTags = (
  measurements: Parameters<
    React.ComponentProps<typeof Measurements>['children']
  >[0]['measurements']
) =>
  Object.fromEntries(
    Object.keys(measurements).map(key => [
      key,
      {
        ...measurements[key],
        kind: FieldKind.MEASUREMENT,
      },
    ])
  );

const getSemverTags = () =>
  Object.fromEntries(
    Object.keys(SEMVER_TAGS).map(key => [
      key,
      {
        ...SEMVER_TAGS[key],
        kind: FieldKind.FIELD,
      },
    ])
  );

export type SearchBarProps = Omit<React.ComponentProps<typeof SmartSearchBar>, 'tags'> & {
  organization: Organization;
  tags: TagCollection;
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
  } = props;

  const api = useApi();

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

      return fetchTagValues(
        api,
        organization.slug,
        tag.key,
        query,
        projectIdStrings,
        endpointParams,

        // allows searching for tags on transactions as well
        true,

        // allows searching for tags on sessions as well
        includeSessionTagsValues
      ).then(
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
    const functionTags = getFunctionTags(fields ?? []);
    const fieldTags = getFieldTags();
    const measurementsWithKind = getMeasurementTags(measurements);
    const semverTags = getSemverTags();

    const orgHasPerformanceView = organization.features.includes('performance-view');

    const combinedTags: Record<string, Tag> = orgHasPerformanceView
      ? Object.assign({}, measurementsWithKind, fieldTags, functionTags)
      : omit(fieldTags, TRACING_FIELDS);

    const tagsWithKind = Object.fromEntries(
      Object.keys(tags).map(key => [
        key,
        {
          ...tags[key],
          kind: FieldKind.TAG,
        },
      ])
    );

    assign(combinedTags, tagsWithKind, fieldTags, semverTags);

    const sortedTagKeys = Object.keys(combinedTags);
    sortedTagKeys.sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    combinedTags.has = {
      key: FieldKey.HAS,
      name: 'Has property',
      values: sortedTagKeys,
      predefined: true,
      kind: FieldKind.FIELD,
    };

    return omit(combinedTags, omitTags ?? []);
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
          excludeEnvironment
          maxMenuHeight={maxMenuHeight ?? 300}
          {...props}
        />
      )}
    </Measurements>
  );
}

export default withTags(SearchBar);
