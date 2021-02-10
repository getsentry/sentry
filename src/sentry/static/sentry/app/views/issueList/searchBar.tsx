import React from 'react';
import styled from '@emotion/styled';

import {fetchRecentSearches} from 'app/actionCreators/savedSearches';
import {Client} from 'app/api';
import SmartSearchBar from 'app/components/smartSearchBar';
import {SearchItem} from 'app/components/smartSearchBar/types';
import {t} from 'app/locale';
import {Organization, SavedSearch, SavedSearchType, Tag} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import {TagValueLoader} from './types';

const SEARCH_ITEMS: SearchItem[] = [
  {
    title: t('Tag'),
    desc: 'browser:"Chrome 34", has:browser',
    value: 'browser:',
    type: 'default',
  },
  {
    title: t('Status'),
    desc: 'is:resolved, unresolved, ignored, assigned, unassigned',
    value: 'is:',
    type: 'default',
  },
  {
    title: t('Time or Count'),
    desc: 'firstSeen, lastSeen, event.timestamp, timesSeen',
    value: '',
    type: 'default',
  },
  {
    title: t('Assigned'),
    desc: 'assigned:[me|user@example.com|#team-example]',
    value: 'assigned:',
    type: 'default',
  },
  {
    title: t('Bookmarked By'),
    desc: 'bookmarks:[me|user@example.com]',
    value: 'bookmarks:',
    type: 'default',
  },
];

type Props = React.ComponentProps<typeof SmartSearchBar> & {
  api: Client;
  organization: Organization;
  tagValueLoader: TagValueLoader;
  projectIds?: string[];
  savedSearch?: SavedSearch;
  isInbox?: boolean;
};

type State = {
  defaultSearchItems: [SearchItem[], SearchItem[]];
  recentSearches: string[];
};

class IssueListSearchBar extends React.Component<Props, State> {
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
              type: 'recent-search',
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
    const {
      tagValueLoader: _,
      savedSearch,
      onSidebarToggle,
      isInbox,
      ...props
    } = this.props;

    return (
      <SmartSearchBarNoLeftCorners
        hasPinnedSearch
        hasRecentSearches
        hasSearchBuilder
        canCreateSavedSearch
        maxSearchItems={5}
        savedSearchType={SavedSearchType.ISSUE}
        onGetTagValues={this.getTagValues}
        defaultSearchItems={this.state.defaultSearchItems}
        onSavedRecentSearch={this.handleSavedRecentSearch}
        onSidebarToggle={onSidebarToggle}
        pinnedSearch={savedSearch?.isPinned ? savedSearch : undefined}
        isInbox={isInbox}
        {...props}
      />
    );
  }
}

const SmartSearchBarNoLeftCorners = styled(SmartSearchBar)<{isInbox?: boolean}>`
  ${p =>
    !p.isInbox &&
    `
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    `}

  flex-grow: 1;
`;

export default withApi(withOrganization(IssueListSearchBar));
