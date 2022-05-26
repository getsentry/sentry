import {Component} from 'react';

import {fetchRecentSearches} from 'sentry/actionCreators/savedSearches';
import {Client} from 'sentry/api';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {
  makePinSearchAction,
  makeSaveSearchAction,
  makeSearchBuilderAction,
} from 'sentry/components/smartSearchBar/actions';
import {ItemType, SearchItem} from 'sentry/components/smartSearchBar/types';
import {t} from 'sentry/locale';
import {Organization, SavedSearch, SavedSearchType, Tag} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import {TagValueLoader} from './types';

const SEARCH_ITEMS: SearchItem[] = [
  {
    title: t('Tag'),
    desc: 'browser:"Chrome 34", has:browser',
    value: 'browser:',
    type: ItemType.DEFAULT,
  },
  {
    title: t('Status'),
    desc: 'is:resolved, unresolved, ignored, assigned, unassigned',
    value: 'is:',
    type: ItemType.DEFAULT,
  },
  {
    title: t('Time or Count'),
    desc: 'firstSeen, lastSeen, event.timestamp, timesSeen',
    value: 'firstSeen:',
    type: ItemType.DEFAULT,
  },
  {
    title: t('Assigned'),
    desc: 'assigned, assigned_or_suggested:[me|[me, none]|user@example.com|#team-example]',
    value: 'assigned:',
    type: ItemType.DEFAULT,
  },
  {
    title: t('Bookmarked By'),
    desc: 'bookmarks:[me|user@example.com]',
    value: 'bookmarks:',
    type: ItemType.DEFAULT,
  },
];

type Props = React.ComponentProps<typeof SmartSearchBar> & {
  api: Client;
  onSidebarToggle: (e: React.MouseEvent) => void;
  organization: Organization;
  sort: string;
  tagValueLoader: TagValueLoader;
  /**
   * Used to define the max height of the menu in px.
   */
  maxMenuHeight?: number;
  projectIds?: string[];
  savedSearch?: SavedSearch;
};

type State = {
  defaultSearchItems: [SearchItem[], SearchItem[]];
  recentSearches: string[];
};

class IssueListSearchBar extends Component<Props, State> {
  state: State = {
    defaultSearchItems: [SEARCH_ITEMS, []],
    recentSearches: [],
  };

  componentDidMount() {
    // Ideally, we would fetch on demand (e.g. when input gets focus)
    // but `<SmartSearchBar>` is a bit complicated and this is the easiest route
    this.fetchData();
  }

  fetchData = async () => {
    this.props.api.clear();
    const resp = await this.getRecentSearches();

    this.setState({
      defaultSearchItems: [
        SEARCH_ITEMS,
        resp
          ? resp.map(query => ({
              desc: query,
              value: query,
              type: ItemType.RECENT_SEARCH,
            }))
          : [],
      ],
      recentSearches: resp,
    });
  };

  /**
   * @returns array of tag values that substring match `query`
   */
  getTagValues = async (tag: Tag, query: string): Promise<string[]> => {
    const {tagValueLoader} = this.props;

    const values = await tagValueLoader(tag.key, query);
    return values.map(({value}) => value);
  };

  getRecentSearches = async (): Promise<string[]> => {
    const {api, organization} = this.props;
    const recent = await fetchRecentSearches(
      api,
      organization.slug,
      SavedSearchType.ISSUE
    );
    return recent?.map(({query}) => query) ?? [];
  };

  handleSavedRecentSearch = () => {
    // Reset recent searches
    this.fetchData();
  };

  render() {
    const {tagValueLoader: _, savedSearch, sort, onSidebarToggle, ...props} = this.props;

    const pinnedSearch = savedSearch?.isPinned ? savedSearch : undefined;

    return (
      <SmartSearchBar
        searchSource="main_search"
        hasRecentSearches
        maxSearchItems={5}
        savedSearchType={SavedSearchType.ISSUE}
        onGetTagValues={this.getTagValues}
        defaultSearchItems={this.state.defaultSearchItems}
        onSavedRecentSearch={this.handleSavedRecentSearch}
        actionBarItems={[
          makePinSearchAction({sort, pinnedSearch}),
          makeSaveSearchAction({sort}),
          makeSearchBuilderAction({onSidebarToggle}),
        ]}
        {...props}
      />
    );
  }
}

export default withApi(withOrganization(IssueListSearchBar));
