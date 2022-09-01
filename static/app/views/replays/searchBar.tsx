import {useEffect} from 'react';
import assign from 'lodash/assign';
import flatten from 'lodash/flatten';
import memoize from 'lodash/memoize';
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
  'device.brand',
  'device.family',
  'device.name',
  'dist',
  'os.build',
  'os.kernel_version',
  'platform.name',
  'release',
  'sdk.name',
  'sdk.version',
  'user.display',
  'user.email',
  'user.id',
  'user.ip',
  'user.username',
];

const getReplayTags = () =>
  Object.fromEntries(
    REPLAY_TAGS.map(key => [
      key,
      {
        ...FIELD_TAGS[key],
        kind: FieldKind.FIELD,
      },
    ])
  );

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
  const {maxSearchItems, organization, tags, omitTags, projectIds, maxMenuHeight} = props;

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
    ({key}, query) => `${key}-${query}`
  );

  const getTagList = () => {
    const replayTags = getReplayTags();

    const tagsWithKind = Object.fromEntries(
      Object.keys(tags).map(key => [
        key,
        {
          ...tags[key],
          kind: FieldKind.TAG,
        },
      ])
    );

    const combinedTags: TagCollection = assign({}, tagsWithKind, replayTags);

    const sortedTagKeys = Object.keys(combinedTags);
    sortedTagKeys.sort((a, b) => {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    return omit(combinedTags, omitTags ?? []);
  };

  return (
    <SmartSearchBar
      onGetTagValues={getEventFieldValues}
      supportedTags={getTagList()}
      prepareQuery={query => {
        // Prepare query string (e.g. strip special characters like negation operator)
        return query.replace(SEARCH_SPECIAL_CHARS_REGEXP, '');
      }}
      maxSearchItems={maxSearchItems}
      excludeEnvironment
      maxMenuHeight={maxMenuHeight ?? 300}
      {...props}
    />
  );
}

export default withTags(SearchBar);
