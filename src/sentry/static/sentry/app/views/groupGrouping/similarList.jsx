import React, {PropTypes} from 'react';

import {t} from '../../locale';
import {Group} from '../../proptypes';

import Pagination from '../../components/pagination';

import SimilarToolbar from './similarToolbar';
import SimilarItem from './similarItem';

const SimilarItemPropType = PropTypes.shape({
  issue: Group,
  score: PropTypes.object,
  avgScore: PropTypes.number,
  isBelowThreshold: PropTypes.bool
});

const SimilarList = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    onMerge: PropTypes.func.isRequired,
    pageLinks: PropTypes.string,
    items: PropTypes.arrayOf(SimilarItemPropType),
    filteredItems: PropTypes.arrayOf(SimilarItemPropType)
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

  render() {
    let {orgId, projectId, items, filteredItems, pageLinks, onMerge} = this.props;
    let hasHiddenItems = !!filteredItems.length;
    let hasResults = items.length > 0 || hasHiddenItems;

    if (hasResults) {
      return (
        <div className="grouping-list-container grouping-similar-list-container">
          <h2>{t('Similar Issues')}</h2>
          <SimilarToolbar onMerge={onMerge} />

          <div className="grouping-list">
            {items.map(item => (
              <SimilarItem
                key={item.issue.id}
                orgId={orgId}
                projectId={projectId}
                {...item}
              />
            ))}

            {this.state.showAllItems &&
              filteredItems.map(item => (
                <SimilarItem
                  key={item.issue.id}
                  orgId={orgId}
                  projectId={projectId}
                  {...item}
                />
              ))}
            {hasHiddenItems &&
              !this.state.showAllItems &&
              <div className="similar-items-footer">
                <button
                  className="btn btn-default btn-xl"
                  onClick={() => this.setState({showAllItems: true})}>
                  Show {filteredItems.length} issues below threshold
                </button>
              </div>}
          </div>
          <Pagination pageLinks={pageLinks} />
        </div>
      );
    }

    return (
      <div className="grouping-list-container grouping-similar-list-container">
        {this.renderEmpty()}
      </div>
    );
  }
});

export default SimilarList;
