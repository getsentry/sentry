import PropTypes from 'prop-types';
import React from 'react';

import {Group} from 'app/sentryTypes';
import {t} from 'app/locale';
import Pagination from 'app/components/pagination';
import QueryCount from 'app/components/queryCount';
import SimilarSpectrum from 'app/components/similarSpectrum';
import SpreadLayout from 'app/components/spreadLayout';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {Panel} from 'app/components/panels';

import SimilarItem from './similarItem';
import SimilarToolbar from './similarToolbar';

const SimilarItemPropType = PropTypes.shape({
  issue: Group,
  score: PropTypes.object,
  avgScore: PropTypes.number,
  isBelowThreshold: PropTypes.bool,
});

class SimilarList extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    onMerge: PropTypes.func.isRequired,
    pageLinks: PropTypes.string,
    items: PropTypes.arrayOf(SimilarItemPropType),
    filteredItems: PropTypes.arrayOf(SimilarItemPropType),
  };

  static defaultProps = {
    filteredItems: [],
  };

  constructor(...args) {
    super(...args);
    this.state = {
      showAllItems: false,
    };
  }

  renderEmpty = () => (
    <Panel>
      <EmptyStateWarning>
        <p>{t('There are no similar issues.')}</p>
      </EmptyStateWarning>
    </Panel>
  );

  handleShowAll = () => {
    this.setState({showAllItems: true});
  };

  render() {
    const {orgId, groupId, items, filteredItems, pageLinks, onMerge} = this.props;
    const hasHiddenItems = !!filteredItems.length;
    const hasResults = items.length > 0 || hasHiddenItems;
    const itemsWithFiltered = items.concat(
      (this.state.showAllItems && filteredItems) || []
    );

    if (!hasResults) {
      return this.renderEmpty();
    }

    return (
      <div className="similar-list-container">
        <SpreadLayout className="similar-list-header">
          <h2>
            <span>{t('Similar Issues')}</span>
            <QueryCount count={items.length + filteredItems.length} />
          </h2>
          <SimilarSpectrum />
        </SpreadLayout>
        <SimilarToolbar onMerge={onMerge} />

        <div className="similar-list">
          {itemsWithFiltered.map(item => (
            <SimilarItem key={item.issue.id} orgId={orgId} groupId={groupId} {...item} />
          ))}

          {hasHiddenItems && !this.state.showAllItems && (
            <div className="similar-items-footer">
              <button className="btn btn-default btn-xl" onClick={this.handleShowAll}>
                Show {filteredItems.length} issues below threshold
              </button>
            </div>
          )}
        </div>
        <Pagination pageLinks={pageLinks} />
      </div>
    );
  }
}

export default SimilarList;
