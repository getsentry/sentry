import {Component} from 'react';

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
import {getFieldDoc} from 'sentry/utils/discover/fields';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import {FieldValueKind} from '../eventsV2/table/types';

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
  supportedTags: {[key: string]: Tag};
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
  supportedTags: {[key: string]: Tag};
};

class IssueListSearchBar extends Component<Props, State> {
  state: State = {
    defaultSearchItems: [SEARCH_ITEMS, []],
    recentSearches: [],
    supportedTags: {},
  };

  componentDidMount() {
    // Ideally, we would fetch on demand (e.g. when input gets focus)
    // but `<SmartSearchBar>` is a bit complicated and this is the easiest route
    this.getSupportedTags();
  }

  getSupportedTags = () => {
    const {supportedTags} = this.props;

    const newTags = Object.fromEntries(
      Object.keys(supportedTags).map(key => [
        key,
        {
          ...supportedTags[key],
          kind: supportedTags[key].predefined ? FieldValueKind.TAG : FieldValueKind.FIELD,
        },
      ])
    );

    this.setState({
      supportedTags: newTags,
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
        actionBarItems={[
          makePinSearchAction({sort, pinnedSearch}),
          makeSaveSearchAction({sort}),
          makeSearchBuilderAction({onSidebarToggle}),
        ]}
        {...props}
        supportedTags={this.state.supportedTags}
        getFieldDoc={getFieldDoc}
      />
    );
  }
}

export default withApi(withOrganization(IssueListSearchBar));
