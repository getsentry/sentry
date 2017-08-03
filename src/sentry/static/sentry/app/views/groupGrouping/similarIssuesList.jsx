import React, {PropTypes} from 'react';

import {t} from '../../locale';
import {Group} from '../../proptypes';

import ApiMixin from '../../mixins/ApiMixin';
import {mergeSelected} from '../../actionCreators/similarIssues';
import Pagination from '../../components/pagination';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import SimilarIssuesToolbar from './similarIssuesToolbar';
import SimilarIssueItem from './similarIssueItem';

const SimilarItemPropType = PropTypes.shape({
  issue: Group,
  score: PropTypes.object,
  avgScore: PropTypes.number,
  isBelowThreshold: PropTypes.bool
});

const SimilarIssuesList = React.createClass({
  propTypes: {
    emptyMessage: PropTypes.node,
    error: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    filteredItems: PropTypes.arrayOf(SimilarItemPropType),
    isLoading: PropTypes.bool.isRequired,
    isError: PropTypes.bool.isRequired,
    isLoaded: PropTypes.bool.isRequired,
    items: PropTypes.arrayOf(SimilarItemPropType),
    links: PropTypes.string,
    orgId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      isLoading: true,
      isError: false,
      isLoaded: false
    };
  },

  getInitialState() {
    return {
      showAllItems: false
    };
  },

  handleShowAllItems() {
    this.setState(state => ({
      ...state,
      showAllItems: true
    }));
  },

  handleMerge() {
    const {orgId, projectId, groupId} = this.props;
    mergeSelected(this.api, {
      orgId,
      projectId,
      groupId
    });
  },

  render() {
    let {
      orgId,
      projectId,
      isLoading,
      isError,
      isLoaded,
      emptyMessage,
      items,
      filteredItems,
      links,
      error
    } = this.props;
    let hasHiddenItems = !!filteredItems.length;
    let hasResults = isLoaded && (items.length > 0 || hasHiddenItems);
    let hasNoResults = isLoaded && !hasResults;
    let shouldShowFooter = isLoaded && hasHiddenItems && !this.state.showAllItems;
    let shouldShowHiddenItems = isLoaded && this.state.showAllItems;

    return (
      <div className="grouping-list-container grouping-similar-list-container">
        <h2>
          {t('Similar Issues')}
        </h2>
        <SimilarIssuesToolbar onMerge={this.handleMerge} />

        <div className="grouping-list">
          {isLoading && <LoadingIndicator />}
          {isError && <LoadingError message={error} onRetry={this.fetchData} />}
          {hasNoResults && emptyMessage}
          {hasResults &&
            items.map(item => (
              <SimilarIssueItem
                key={item.issue.id}
                orgId={orgId}
                projectId={projectId}
                {...item}
              />
            ))}

          {shouldShowHiddenItems &&
            filteredItems.map(item => (
              <SimilarIssueItem
                key={item.issue.id}
                orgId={orgId}
                projectId={projectId}
                {...item}
              />
            ))}

          {shouldShowFooter &&
            <div className="similar-items-footer">
              <button
                className="btn btn-default btn-xl"
                onClick={this.handleShowAllItems}>
                Show {filteredItems.length} issues below threshold
              </button>
            </div>}
        </div>
        <Pagination pageLinks={links} />
      </div>
    );
  }
});

export default SimilarIssuesList;
