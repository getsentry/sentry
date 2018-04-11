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
import EmptyStateWarning from '../../components/emptyStateWarning';
import {Panel} from '../../components/panels';

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
    projectId: PropTypes.string.isRequired,
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

  renderEmpty = () => {
    return (
      <Panel>
        <EmptyStateWarning>
          <p>{t('There are no similar issues.')}</p>
        </EmptyStateWarning>
      </Panel>
    );
  };

  handleShowAll = () => {
    this.setState({showAllItems: true});
  };

  render() {
    let {
      orgId,
      groupId,
      projectId,
      items,
      filteredItems,
      pageLinks,
      onMerge,
    } = this.props;
    let hasHiddenItems = !!filteredItems.length;
    let hasResults = items.length > 0 || hasHiddenItems;
    let itemsWithFiltered = items.concat(
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
            <SimilarItem
              key={item.issue.id}
              orgId={orgId}
              projectId={projectId}
              groupId={groupId}
              {...item}
            />
          ))}

          {hasHiddenItems &&
            !this.state.showAllItems && (
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
