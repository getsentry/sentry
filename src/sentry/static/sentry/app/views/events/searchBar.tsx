import {ClassNames} from '@emotion/core';
import assign from 'lodash/assign';
import flatten from 'lodash/flatten';
import isEqual from 'lodash/isEqual';
import memoize from 'lodash/memoize';
import omit from 'lodash/omit';
import PropTypes from 'prop-types';
import React from 'react';

import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'app/constants';
import {defined} from 'app/utils';
import {fetchTagValues} from 'app/actionCreators/tags';
import SentryTypes from 'app/sentryTypes';
import {SavedSearchType, Organization, TagCollection} from 'app/types';
import SmartSearchBar from 'app/components/smartSearchBar';
import {
  Field,
  FIELD_TAGS,
  TRACING_FIELDS,
  isAggregateField,
  isMeasurement,
} from 'app/utils/discover/fields';
import withApi from 'app/utils/withApi';
import withTags from 'app/utils/withTags';
import Measurements from 'app/utils/measurements/measurements';
import {Client} from 'app/api';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

type SearchBarProps = Omit<React.ComponentProps<typeof SmartSearchBar>, 'tags'> & {
  api: Client;
  organization: Organization;
  tags: TagCollection;
  omitTags?: string[];
  projectIds?: number[] | Readonly<number[]>;
  fields?: Readonly<Field[]>;
};

class SearchBar extends React.PureComponent<SearchBarProps> {
  static propTypes: any = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    tags: PropTypes.objectOf(SentryTypes.Tag),
    omitTags: PropTypes.arrayOf(PropTypes.string.isRequired),
    projectIds: PropTypes.arrayOf(PropTypes.number.isRequired),
    fields: PropTypes.arrayOf(PropTypes.object.isRequired) as any,
  };

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
      const {api, organization, projectIds} = this.props;
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
        true
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

  getTagList(measurements) {
    const {fields, organization, tags, omitTags} = this.props;
    const functionTags = fields
      ? Object.fromEntries(
          fields
            .filter(item => !Object.keys(FIELD_TAGS).includes(item.field))
            .map(item => [item.field, {key: item.field, name: item.field}])
        )
      : {};

    const fieldTags = organization.features.includes('performance-view')
      ? Object.assign({}, FIELD_TAGS, functionTags)
      : omit(FIELD_TAGS, TRACING_FIELDS);

    const combined = organization.features.includes('measurements')
      ? assign({}, tags, measurements, fieldTags)
      : assign({}, tags, fieldTags);
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
                  {...this.props}
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
