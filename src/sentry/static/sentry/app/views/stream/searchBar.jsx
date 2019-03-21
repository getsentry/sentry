import PropTypes from 'prop-types';
import React from 'react';

import {RECENT_SEARCH_TYPES} from 'app/constants';
import {t} from 'app/locale';
import SmartSearchBar from 'app/components/smartSearchBar';

const SEARCH_ITEMS = [
  {
    title: t('Tag'),
    desc: t('key/value pair associated to an issue'),
    example: 'browser:"Chrome 34", has:browser',
    className: 'icon-tag',
    value: 'browser:',
  },
  {
    title: t('Status'),
    desc: t('State of an issue'),
    example: 'is:resolved, unresolved, ignored, assigned, unassigned',
    className: 'icon-toggle',
    value: 'is:',
  },
  {
    title: t('Time or Count'),
    desc: t('Time or Count related search'),
    example: 'firstSeen, lastSeen, event.timestamp, timesSeen',
    className: 'icon-clock',
    value: '',
  },
  {
    title: t('Assigned'),
    desc: t('team member assigned to an issue'),
    example: 'assigned:[me|user@example.com]',
    className: 'icon-user',
    value: 'assigned:',
  },
  {
    title: t('Bookmarked By'),
    desc: t('team member who bookmarked an issue'),
    example: 'bookmarks:[me|user@example.com]',
    className: 'icon-user',
    value: 'bookmarks:',
  },
  {
    desc: t('or paste an event id to jump straight to it'),
    className: 'icon-hash',
    value: '',
  },
];

class SearchBar extends React.Component {
  static propTypes = {
    ...SmartSearchBar.propTypes,

    tagValueLoader: PropTypes.func.isRequired,
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

  render() {
    const {
      tagValueLoader, // eslint-disable-line no-unused-vars
      ...props
    } = this.props;

    return (
      <SmartSearchBar
        onGetTagValues={this.getTagValues}
        defaultSearchItems={SEARCH_ITEMS}
        maxSearchItems={5}
        recentSearchType={RECENT_SEARCH_TYPES.ISSUE}
        {...props}
      />
    );
  }
}

export default SearchBar;
