import {useCallback} from 'react';
import flatten from 'lodash/flatten';
import omit from 'lodash/omit';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {NEGATION_OPERATOR, SEARCH_WILDCARD} from 'sentry/constants';
import {Organization, TagCollection} from 'sentry/types';
import {defined} from 'sentry/utils';
import {FIELD_TAGS, isAggregateField} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import withTags from 'sentry/utils/withTags';

const SEARCH_SPECIAL_CHARS_REGEXP = new RegExp(
  `^${NEGATION_OPERATOR}|\\${SEARCH_WILDCARD}`,
  'g'
);

const REPLAY_TAGS = [
  'browser.name',
  'browser.version',
  'countErrors',
  'countSegments',
  'device.brand',
  'device.family',
  'device.model',
  'device.name',
  'dist',
  'duration',
  'id',
  'os.name',
  'os.version',
  'platform',
  'projectId',
  'release',
  'sdk.name',
  'sdk.version',
  'user.display',
  'user.email',
  'user.id',
  'user.ipAddress',
  'user.name',
];

export type SearchBarProps = Omit<React.ComponentProps<typeof SmartSearchBar>, 'tags'> & {
  organization: Organization;
  tags: TagCollection;
  /**
   * Used to define the max height of the menu in px.
   */
  maxMenuHeight?: number;
  maxSearchItems?: React.ComponentProps<typeof SmartSearchBar>['maxSearchItems'];
  omitTags?: string[];
  projectIds?: number[] | Readonly<number[]>;
};

function SearchBar(props: SearchBarProps) {
  const {maxSearchItems, organization, omitTags, projectIds, maxMenuHeight} = props;

  const api = useApi();

  // Returns array of tag values that substring match `query`; invokes `callback`
  // with data when ready
  const getEventFieldValues = useCallback(
    (tag, query, endpointParams): Promise<string[]> => {
      const projectIdStrings = projectIds?.map(String);

      if (isAggregateField(tag.key)) {
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
        endpointParams
      ).then(
        results =>
          flatten(results.filter(({name}) => defined(name)).map(({name}) => name)),
        () => {
          throw new Error('Unable to fetch event field values');
        }
      );
    },
    [api, organization.slug, projectIds]
  );

  const getTagList = () => {
    const tags: TagCollection = Object.fromEntries(
      REPLAY_TAGS.map(key => [
        key,
        {
          ...FIELD_TAGS[key],
          kind: FieldKind.FIELD,
        },
      ])
    );

    return omit(tags, omitTags ?? []);
  };

  return (
    <SmartSearchBar
      maxSearchItems={maxSearchItems}
      excludeEnvironment
      maxMenuHeight={maxMenuHeight ?? 300}
      {...props}
      prepareQuery={query => {
        // Prepare query string (e.g. strip special characters like negation operator)
        return query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
      }}
      supportedTags={getTagList()}
      onGetTagValues={getEventFieldValues}
    />
  );
}

export default withTags(SearchBar);
