import PropTypes from 'prop-types';
import React from 'react';

import {Group} from '../../proptypes';
import {t} from '../../locale';
import Pagination from '../../components/pagination';
import QueryCount from '../../components/queryCount';
import SimilarItem from './similarItem';
import SimilarSpectrum from '../../components/similarSpectrum';
import SimilarToolbar from './similarToolbar';
import SpreadLayout from '../../components/spreadLayout';

const SimilarItemPropType = PropTypes.shape({
  issue: Group,
  score: PropTypes.object,
  avgScore: PropTypes.number,
  isBelowThreshold: PropTypes.bool
});

const SimilarList = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    onMerge: PropTypes.func.isRequired,
    pageLinks: PropTypes.string,
    items: PropTypes.arrayOf(SimilarItemPropType),
    filteredItems: PropTypes.arrayOf(SimilarItemPropType)
  },

  getDefaultProps() {
    return {
      filteredItems: []
    };
  },

  getInitialState() {
    return {
      showAllItems: false
    };
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>
          {t('There are no similar issues.')}
        </p>
      </div>
    );
  },

  handleShowAll() {
    this.setState({showAllItems: true});
  },

  render() {
    let {
      orgId,
      groupId,
      projectId,
      items,
      filteredItems,
      pageLinks,
      onMerge
    } = this.props;
    let hasHiddenItems = !!filteredItems.length;
    let hasResults = items.length > 0 || hasHiddenItems;
    let itemsWithFiltered = items.concat(
      (this.state.showAllItems && filteredItems) || []
    );

    if (!hasResults) {
      return (
        <div className="similar-list-container">
          {this.renderEmpty()}
        </div>
      );
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
            <SimilarItem
              key={item.issue.id}
              orgId={orgId}
              projectId={projectId}
              groupId={groupId}
              {...item}
            />
          ))}

          {hasHiddenItems &&
            !this.state.showAllItems &&
            <div className="similar-items-footer">
              <button className="btn btn-default btn-xl" onClick={this.handleShowAll}>
                Show {filteredItems.length} issues below threshold
              </button>
            </div>}
        </div>
        <Pagination pageLinks={pageLinks} />
      </div>
    );
  }
});

export default SimilarList;
