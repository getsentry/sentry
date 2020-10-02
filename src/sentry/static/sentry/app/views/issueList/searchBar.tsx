import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {fetchRecentSearches} from 'app/actionCreators/savedSearches';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {SavedSearchType} from 'app/types';
import SmartSearchBar from 'app/components/smartSearchBar';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

const SEARCH_ITEMS = [
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
    desc: 'assigned:[me|user@example.com]',
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

class IssueListSearchBar extends React.Component {
  static propTypes = {
    ...SmartSearchBar.propTypes,

    savedSearch: SentryTypes.SavedSearch,
    tagValueLoader: PropTypes.func.isRequired,
    onSidebarToggle: PropTypes.func,
  };

  state = {
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
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */
  getTagValues = (tag, query) => {
    const {tagValueLoader, projectIds} = this.props;

    return tagValueLoader(tag.key, query, projectIds).then(
      values => values.map(({value}) => value),
      () => {
        throw new Error('Unable to fetch project tags');
      }
    );
  };

  getRecentSearches = async fullQuery => {
    const {api, organization} = this.props;
    const recent = await fetchRecentSearches(
      api,
      organization.slug,
      SavedSearchType.ISSUE,
      fullQuery
    );
    return (recent && recent.map(({query}) => query)) || [];
  };

  handleSavedRecentSearch = () => {
    // Reset recent searches
    this.fetchData();
  };

  render() {
    const {tagValueLoader: _, savedSearch, onSidebarToggle, ...props} = this.props;

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
        pinnedSearch={savedSearch && savedSearch.isPinned ? savedSearch : null}
        {...props}
      />
    );
  }
}

const SmartSearchBarNoLeftCorners = styled(SmartSearchBar)`
  border-radius: ${p =>
    p.isOpen
      ? `0 ${p.theme.borderRadius} 0 0`
      : `0 ${p.theme.borderRadius} ${p.theme.borderRadius} 0`};
  flex-grow: 1;
`;

export default withApi(withOrganization(IssueListSearchBar));
