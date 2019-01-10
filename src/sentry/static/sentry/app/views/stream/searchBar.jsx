import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import SmartSearchBar from 'app/components/smartSearchBar';
import {fetchTagValues} from 'app/actionCreators/tags';
import TagStore from 'app/stores/tagStore';
import withApi from 'app/utils/withApi';

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
    api: PropTypes.object,
    orgId: PropTypes.string.isRequired,
    // Optional to enable project scope search
    projectId: PropTypes.string,
  };

  /**
   * Returns array of tag values that substring match `query`; invokes `callback`
   * with data when ready
   */
  getTagValues = (tag, query) => {
    let {api, orgId, projectId} = this.props;

    return fetchTagValues(api, tag.key, orgId, projectId, query).then(
      values => values.map(({value}) => value),
      () => {
        throw new Error('Unable to fetch project tags');
      }
    );
  };

  render() {
    return (
      <SmartSearchBar
        {...this.props}
        onGetTagValues={this.getTagValues}
        supportedTags={TagStore.getAllTags()}
        defaultSearchItems={SEARCH_ITEMS}
        maxSearchItems={5}
      />
    );
  }
}

export default withApi(SearchBar);
