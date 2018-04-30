import PropTypes from 'prop-types';
import React from 'react';

import {Event} from 'app/proptypes';
import {t} from 'app/locale';
import MergedItem from 'app/views/groupMerged/mergedItem';
import MergedToolbar from 'app/views/groupMerged/mergedToolbar';
import Pagination from 'app/components/pagination';
import QueryCount from 'app/components/queryCount';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {Panel} from 'app/components/panels';

class MergedList extends React.Component {
  static propTypes = {
    onUnmerge: PropTypes.func.isRequired,
    onToggleCollapse: PropTypes.func.isRequired,
    items: PropTypes.arrayOf(Event),
    pageLinks: PropTypes.string,
  };

  renderEmpty = () => {
    return (
      <EmptyStateWarning>
        <p>{t("There don't seem to be any hashes for this issue.")}</p>
      </EmptyStateWarning>
    );
  };

  render() {
    let {items, pageLinks, onToggleCollapse, onUnmerge, ...otherProps} = this.props;
    let itemsWithLatestEvent = items.filter(({latestEvent}) => !!latestEvent);
    let hasResults = itemsWithLatestEvent.length > 0;

    if (!hasResults) {
      return <Panel>{this.renderEmpty()}</Panel>;
    }

    return (
      <div className="merged-list-container">
        <h2>
          <span>{t('Merged fingerprints with latest event')}</span>
          <QueryCount count={itemsWithLatestEvent.length} />
        </h2>

        <MergedToolbar
          {...otherProps}
          onToggleCollapse={onToggleCollapse}
          onUnmerge={onUnmerge}
        />

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
}

export default MergedList;
