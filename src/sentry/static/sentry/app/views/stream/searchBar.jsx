import PropTypes from 'prop-types';
import React from 'react';

import {RECENT_SEARCH_TYPES} from 'app/constants';
import {fetchRecentSearches} from 'app/actionCreators/savedSearches';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import SmartSearchBar from 'app/components/smartSearchBar';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

const SEARCH_ITEMS = [
  {
    title: t('Tag'),
    desc: t('key/value pair associated to an issue'),
    example: 'browser:"Chrome 34", has:browser',
    className: 'icon-tag',
    value: 'browser:',
    type: 'default',
  },
  {
    title: t('Status'),
    desc: t('State of an issue'),
    example: 'is:resolved, unresolved, ignored, assigned, unassigned',
    className: 'icon-toggle',
    value: 'is:',
    type: 'default',
  },
  {
    title: t('Time or Count'),
    desc: t('Time or Count related search'),
    example: 'firstSeen, lastSeen, event.timestamp, timesSeen',
    className: 'icon-av_timer',
    value: '',
    type: 'default',
  },
  {
    title: t('Assigned'),
    desc: t('team member assigned to an issue'),
    example: 'assigned:[me|user@example.com]',
    className: 'icon-user',
    value: 'assigned:',
    type: 'default',
  },
  {
    title: t('Bookmarked By'),
    desc: t('team member who bookmarked an issue'),
    example: 'bookmarks:[me|user@example.com]',
    className: 'icon-user',
    value: 'bookmarks:',
    type: 'default',
  },
  {
    desc: t('or paste an event id to jump straight to it'),
    className: 'icon-hash',
    value: '',
    type: 'default',
  },
];

class SearchBar extends React.Component {
  static propTypes = {
    ...SmartSearchBar.propTypes,

    organization: SentryTypes.Organization.isRequired,
    tagValueLoader: PropTypes.func.isRequired,
  };

  state = {
    defaultSearchItems: SEARCH_ITEMS,
    recentSearches: [],
  };

  componentDidMount() {
    // Ideally, we would fetch on demand (e.g. when input gets focus)
    // but `<SmartSearchBar>` is a bit complicated and this is the easiest route
    this.fetchData();
  }

  hasRecentSearches = () => {
    const {organization} = this.props;
    return organization && organization.features.includes('recent-searches');
  };

  fetchData = async () => {
    if (!this.hasRecentSearches()) {
      this.setState({
        defaultSearchItems: SEARCH_ITEMS,
      });

      return;
    }

    const resp = await this.getRecentSearches();

    this.setState({
      defaultSearchItems: [
        ...(resp &&
          resp.map(query => ({
            desc: query,
            value: query,
            className: 'icon-clock',
            type: 'recent-search',
          }))),
        ...SEARCH_ITEMS,
      ],
      recentSearches: resp,
    });
  };

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */
  getTagValues = (tag, query) => {
    const {tagValueLoader} = this.props;

    return tagValueLoader(tag.key, query).then(
      values => values.map(({value}) => value),
      () => {
        throw new Error('Unable to fetch project tags');
      }
    );
  };

  getRecentSearches = async fullQuery => {
    const {api, orgId} = this.props;
    const recent = await fetchRecentSearches(
      api,
      orgId,
      RECENT_SEARCH_TYPES.ISSUE,
      fullQuery
    );
    return (recent && recent.map(({query}) => query)) || [];
  };

  handleSavedRecentSearch = () => {
    // No need to refetch if recent searches feature is not enabled
    if (!this.hasRecentSearches()) {
      return;
    }

    // Reset recent searches
    this.fetchData();
  };

  render() {
    const {
      tagValueLoader, // eslint-disable-line no-unused-vars
      ...props
    } = this.props;

    return (
      <SmartSearchBar
        onGetTagValues={this.getTagValues}
        defaultSearchItems={this.state.defaultSearchItems}
        maxSearchItems={5}
        recentSearchType={RECENT_SEARCH_TYPES.ISSUE}
        displayRecentSearches={this.hasRecentSearches()}
        onSavedRecentSearch={this.handleSavedRecentSearch}
        {...props}
      />
    );
  }
}

export default withApi(withOrganization(SearchBar));
