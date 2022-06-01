import {useEffect} from 'react';
import {ClassNames} from '@emotion/react';
import {Location} from 'history';
import flatten from 'lodash/flatten';

// import memoize from 'lodash/memoize';
import {fetchTagValues} from 'sentry/actionCreators/tags';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {Organization, SavedSearchType, TagCollection} from 'sentry/types';
import {defined} from 'sentry/utils';
import {Field} from 'sentry/utils/discover/fields';
import useApi from 'sentry/utils/useApi';
import withTags from 'sentry/utils/withTags';

import {normalizeDateTimeParams} from '../organizations/pageFilters/parse';

export type SearchBarProps = Omit<React.ComponentProps<typeof SmartSearchBar>, 'tags'> & {
  location: Location;
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
  const {organization, tags, projectIds, maxMenuHeight, location} = props;

  const api = useApi();

  useEffect(() => {
    // Clear memoized data on mount to make tests more consistent.
    // getEventFieldValues.cache.clear?.();
  }, [projectIds]);

  // Returns array of tag values that substring match `query`; invokes `callback`
  // with data when ready
  const getEventFieldValues = (_, query, endpointParams): Promise<string[]> => {
    const projectIdStrings = (projectIds as Readonly<number>[])?.map(String);

    return fetchTagValues(
      api,
      organization.slug,
      'transaction',
      query,
      projectIdStrings,
      endpointParams,

      // allows searching for tags on transactions as well
      true
    ).then(
      results => flatten(results.filter(({name}) => defined(name)).map(({name}) => name)),
      () => {
        throw new Error('Unable to fetch event field values');
      }
    );
  };

  const handleChange = (query: string) => {
    console.log(query)
    getEventFieldValues('transaction', query, normalizeDateTimeParams(location.query));
  };

  const getTransactionTag = () => ({transaction: tags.transaction});

  return (
    <ClassNames>
      {({css}) => (
        <SmartSearchBar
          savedSearchType={SavedSearchType.EVENT}
          onGetTagValues={getEventFieldValues}
          supportedTags={getTransactionTag()}
          maxSearchItems={1}
          excludeEnvironment
          dropdownClassName={css`
            max-height: ${maxMenuHeight ?? 300}px;
            overflow-y: auto;
          `}
          onChange={handleChange}
          prepareQuery={query => `transaction:${query}`}
          defaultSearchItems={[[], []]}
          {...props}
        />
      )}
    </ClassNames>
  );
}

export default withTags(SearchBar);
