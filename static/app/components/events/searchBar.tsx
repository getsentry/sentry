import {useEffect} from 'react';
import assign from 'lodash/assign';
import flatten from 'lodash/flatten';
import memoize from 'lodash/memoize';
import omit from 'lodash/omit';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {Organization, SavedSearchType, TagCollection} from 'sentry/types';
import {defined} from 'sentry/utils';
import {
  Field,
  FIELD_TAGS,
  getFieldDoc,
  isAggregateField,
  isEquation,
  isMeasurement,
  SEMVER_TAGS,
  TRACING_FIELDS,
} from 'sentry/utils/discover/fields';
import Measurements from 'sentry/utils/measurements/measurements';
import useApi from 'sentry/utils/useApi';
import withTags from 'sentry/utils/withTags';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
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
    const functionTags = fields
      ? Object.fromEntries(
          fields
            .filter(
              item =>
                !Object.keys(FIELD_TAGS).includes(item.field) && !isEquation(item.field)
            )
            .map(item => [
              item.field,
              {key: item.field, name: item.field, kind: FieldValueKind.FUNCTION},
            ])
        )
      : {};

    const field = Object.fromEntries(
      Object.keys(FIELD_TAGS).map(key => [
        key,
        {
          ...FIELD_TAGS[key],
          kind: FieldValueKind.FIELD,
        },
      ])
    );

    const measurementsWithKind = Object.fromEntries(
      Object.keys(measurements).map(key => [
        key,
        {
          ...measurements[key],
          kind: FieldValueKind.MEASUREMENT,
        },
      ])
    );

    const fieldTags = organization.features.includes('performance-view')
      ? Object.assign({}, measurementsWithKind, field, functionTags)
      : omit(field, TRACING_FIELDS);

    const semverTags = Object.fromEntries(
      Object.keys(SEMVER_TAGS).map(key => [
        key,
        {
          ...SEMVER_TAGS[key],
          kind: FieldValueKind.FIELD,
        },
      ])
    );

    const combined = assign({}, tags, fieldTags, semverTags);
    combined.has = {
      key: 'has',
      name: 'Has property',
      values: Object.keys(combined),
      predefined: true,
      kind: FieldValueKind.FIELD,
    };

    return omit(combined, omitTags ?? []);
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
          getFieldDoc={getFieldDoc}
          {...props}
        />
      )}
    </Measurements>
  );
}

export default withTags(SearchBar);
