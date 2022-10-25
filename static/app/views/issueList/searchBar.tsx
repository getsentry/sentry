import {useCallback} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';

import SmartSearchBar from 'sentry/components/smartSearchBar';
import {
  makePinSearchAction,
  makeSaveSearchAction,
} from 'sentry/components/smartSearchBar/actions';
import {SavedSearch, SavedSearchType, Tag, TagCollection} from 'sentry/types';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';

import {TagValueLoader} from './types';

const getSupportedTags = (supportedTags: TagCollection) =>
  Object.fromEntries(
    Object.keys(supportedTags).map(key => [
      key,
      {
        ...supportedTags[key],
        kind:
          getFieldDefinition(key)?.kind ??
          (supportedTags[key].predefined ? FieldKind.FIELD : FieldKind.TAG),
      },
    ])
  );

interface Props extends React.ComponentProps<typeof SmartSearchBar>, WithRouterProps {
  onSidebarToggle: () => void;
  sort: string;
  supportedTags: TagCollection;
  tagValueLoader: TagValueLoader;
  savedSearch?: SavedSearch;
}

function IssueListSearchBar({
  onSidebarToggle: _onSidebarToggle,
  sort,
  supportedTags,
  tagValueLoader,
  savedSearch,
  location,
  ...props
}: Props) {
  const organization = useOrganization();
  const getTagValues = useCallback(
    async (tag: Tag, query: string): Promise<string[]> => {
      const values = await tagValueLoader(tag.key, query);
      return values.map(({value}) => value);
    },
    [tagValueLoader]
  );

  const pinnedSearch = savedSearch?.isPinned ? savedSearch : undefined;

  return (
    <SmartSearchBar
      searchSource="main_search"
      hasRecentSearches
      savedSearchType={SavedSearchType.ISSUE}
      onGetTagValues={getTagValues}
      actionBarItems={[
        makePinSearchAction({sort, pinnedSearch, location}),
        makeSaveSearchAction({
          sort,
          disabled: !organization.access.includes('org:write'),
        }),
        // TODO: fully remove this
        // makeSearchBuilderAction({onSidebarToggle}),
      ]}
      {...props}
      maxMenuHeight={500}
      supportedTags={getSupportedTags(supportedTags)}
    />
  );
}

export default withRouter(IssueListSearchBar);
