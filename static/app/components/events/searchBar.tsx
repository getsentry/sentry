import * as React from 'react';
import {ClassNames} from '@emotion/react';
import assign from 'lodash/assign';
import flatten from 'lodash/flatten';
import isEqual from 'lodash/isEqual';
import memoize from 'lodash/memoize';
import omit from 'lodash/omit';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {Organization, SavedSearchType, TagCollection} from 'sentry/types';
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
import Measurements from 'sentry/utils/measurements/measurements';
import withApi from 'sentry/utils/withApi';
import withTags from 'sentry/utils/withTags';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

type SearchBarProps = Omit<React.ComponentProps<typeof SmartSearchBar>, 'tags'> & {
  api: Client;
  organization: Organization;
  tags: TagCollection;
  fields?: Readonly<Field[]>;
  includeSessionTagsValues?: boolean;
  omitTags?: string[];
  projectIds?: number[] | Readonly<number[]>;
};

class SearchBar extends React.PureComponent<SearchBarProps> {
  componentDidMount() {
    // Clear memoized data on mount to make tests more consistent.
    this.getEventFieldValues.cache.clear?.();
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(this.props.projectIds, prevProps.projectIds)) {
      // Clear memoized data when projects change.
      this.getEventFieldValues.cache.clear?.();
    }
  }

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */
  getEventFieldValues = memoize(
    (tag, query, endpointParams): Promise<string[]> => {
      const {api, organization, projectIds, includeSessionTagsValues} = this.props;
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

  /**
   * Prepare query string (e.g. strip special characters like negation operator)
   */
  prepareQuery = query => query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');

  getTagList(
    measurements: Parameters<
      React.ComponentProps<typeof Measurements>['children']
    >[0]['measurements']
  ) {
    const {fields, organization, tags, omitTags} = this.props;

    const functionTags = fields
      ? Object.fromEntries(
          fields
            .filter(
              item =>
                !Object.keys(FIELD_TAGS).includes(item.field) && !isEquation(item.field)
            )
            .map(item => [item.field, {key: item.field, name: item.field}])
        )
      : {};

    const fieldTags = organization.features.includes('performance-view')
      ? Object.assign({}, measurements, FIELD_TAGS, functionTags)
      : omit(FIELD_TAGS, TRACING_FIELDS);

    const combined = assign({}, tags, fieldTags, SEMVER_TAGS);
    combined.has = {
      key: 'has',
      name: 'Has property',
      values: Object.keys(combined),
      predefined: true,
    };

    return omit(combined, omitTags ?? []);
  }

  render() {
    return (
      <Measurements>
        {({measurements}) => {
          const tags = this.getTagList(measurements);
          return (
            <ClassNames>
              {({css}) => (
                <SmartSearchBar
                  hasRecentSearches
                  savedSearchType={SavedSearchType.EVENT}
                  onGetTagValues={this.getEventFieldValues}
                  supportedTags={tags}
                  prepareQuery={this.prepareQuery}
                  excludeEnvironment
                  dropdownClassName={css`
                    max-height: 300px;
                    overflow-y: auto;
                  `}
                  {...this.props}
                />
              )}
            </ClassNames>
          );
        }}
      </Measurements>
    );
  }
}

export default withApi(withTags(SearchBar));
