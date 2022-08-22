import {useCallback} from 'react';

import SmartSearchBar from 'sentry/components/smartSearchBar';
import {
  makePinSearchAction,
  makeSaveSearchAction,
  makeSearchBuilderAction,
} from 'sentry/components/smartSearchBar/actions';
import {SavedSearch, SavedSearchType, Tag} from 'sentry/types';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';

import {TagValueLoader} from './types';

const getSupportedTags = (supportedTags: {[key: string]: Tag}) =>
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

interface Props extends React.ComponentProps<typeof SmartSearchBar> {
  onSidebarToggle: (e: React.MouseEvent) => void;
  sort: string;
  supportedTags: {[key: string]: Tag};
  tagValueLoader: TagValueLoader;
  savedSearch?: SavedSearch;
}

function IssueListSearchBar({
  onSidebarToggle,
  sort,
  supportedTags,
  tagValueLoader,
  savedSearch,
  ...props
}: Props) {
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
        makePinSearchAction({sort, pinnedSearch}),
        makeSaveSearchAction({sort}),
        makeSearchBuilderAction({onSidebarToggle}),
      ]}
      {...props}
      maxMenuHeight={500}
      supportedTags={getSupportedTags(supportedTags)}
    />
  );
}

export default IssueListSearchBar;
