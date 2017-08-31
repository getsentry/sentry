import PropTypes from 'prop-types';
import React from 'react';

import {Event} from '../../proptypes';
import {t} from '../../locale';
import MergedItem from './mergedItem';
import MergedToolbar from './mergedToolbar';
import Pagination from '../../components/pagination';
import QueryCount from '../../components/queryCount';

const MergedList = React.createClass({
  propTypes: {
    onUnmerge: PropTypes.func.isRequired,
    onCollapse: PropTypes.func.isRequired,
    items: PropTypes.arrayOf(Event),
    pageLinks: PropTypes.string
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t("There don't seem to be any hashes for this issue.")}</p>
      </div>
    );
  },

  render() {
    let {items, pageLinks, onCollapse, onUnmerge, ...otherProps} = this.props;
    let itemsWithLatestEvent = items.filter(({latestEvent}) => !!latestEvent);
    let hasResults = itemsWithLatestEvent.length > 0;

    if (!hasResults) {
      return (
        <div className="merged-list-container">
          {this.renderEmpty()}
        </div>
      );
    }

    return (
      <div className="merged-list-container">
        <h2>
          <span>{t('Merged fingerprints with latest event')}</span>
          <QueryCount count={itemsWithLatestEvent.length} />
        </h2>

        <MergedToolbar onCollapse={onCollapse} onUnmerge={onUnmerge} />

        <div className="merged-list">
          {itemsWithLatestEvent.map(({id, latestEvent}) => (
            <MergedItem
              key={id}
              {...otherProps}
              disabled={items.length === 1}
              event={latestEvent}
              fingerprint={id}
              itemCount={items.length}
            />
          ))}
        </div>
        <Pagination pageLinks={pageLinks} />
      </div>
    );
  }
});

export default MergedList;
