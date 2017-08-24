import React, {PropTypes} from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import GroupingStore from '../../stores/groupingStore';
import GroupingActions from '../../actions/groupingActions';

import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import MergedList from './mergedList';
import SimilarList from './similarList';

const GroupGroupingView = React.createClass({
  propTypes: {
    query: PropTypes.string
  },

  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],

  getInitialState() {
    return {
      mergedItems: [],
      similarItems: [],
      filteredSimilarItems: [],
      mergedLinks: [],
      similarLinks: [],
      loading: true,
      error: false
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.params.groupId !== this.props.params.groupId ||
      nextProps.location.search !== this.props.location.search
    ) {
      this.fetchData();
    }
  },

  onGroupingUpdate({
    mergedItems,
    mergedLinks,
    similarItems,
    similarLinks,
    filteredSimilarItems,
    loading,
    error
  }) {
    if (mergedItems && similarItems) {
      this.setState({
        mergedItems,
        mergedLinks,
        similarItems,
        similarLinks,
        filteredSimilarItems,
        loading: typeof loading !== 'undefined' ? loading : false,
        error: typeof error !== 'undefined' ? error : false
      });
    }
  },

  getEndpoint(type) {
    let params = this.props.params;
    let queryParams = {
      ...this.props.location.query,
      limit: 50
    };
    return `/issues/${params.groupId}/${type}/?${jQuery.param(queryParams)}`;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    GroupingActions.fetch([
      {
        endpoint: this.getEndpoint('hashes'),
        dataKey: 'merged',
        queryParams: this.props.location.query
      },
      {
        endpoint: this.getEndpoint('similar'),
        dataKey: 'similar',
        queryParams: this.props.location.query
      }
    ]);
  },

  handleMerge() {
    const {query, params} = this.props;

    if (params) {
      GroupingActions.merge({
        params,
        query
      });
    }
  },

  handleUnmerge() {
    let {params} = this.props;

    GroupingActions.unmerge({
      groupId: params.groupId,
      loadingMessage: `${t('Unmerging events')}...`,
      successMessage: t('Events successfully queued for unmerging.'),
      errorMessage: t('Unable to queue events for unmerging.')
    });
  },

  render() {
    let {orgId, projectId, groupId} = this.props.params;
    let isLoading = this.state.loading;
    let isError = this.state.error && !isLoading;
    let hasMergedItems = this.state.mergedItems.length >= 0 && !isError && !isLoading;
    let hasSimilarItems =
      (this.state.similarItems.length >= 0 ||
        this.state.filteredSimilarItems.length >= 0) &&
      !isError &&
      !isLoading;

    return (
      <div>
        <div className="alert alert-block alert-warning">
          <strong>{t('Warning')}:</strong>
          {' '}
          {t(
            'This is an experimental feature. Data may not be immediately available while we process the unmerge.'
          )}
        </div>

        {isLoading && <LoadingIndicator />}
        {isError && <LoadingError message={this.state.error} onRetry={this.fetchData} />}

        {hasSimilarItems &&
          <SimilarList
            items={this.state.similarItems}
            filteredItems={this.state.filteredSimilarItems}
            onMerge={this.handleMerge}
            orgId={orgId}
            projectId={projectId}
            pageLinks={this.state.similarLinks}
          />}

        {hasMergedItems &&
          <MergedList
            items={this.state.mergedItems}
            onUnmerge={this.handleUnmerge}
            orgId={orgId}
            projectId={projectId}
            groupId={groupId}
            pageLinks={this.state.mergedLinks}
            busyMap={this.state.busy}
            hiddenMap={this.state.hidden}
          />}

      </div>
    );
  }
});

export default GroupGroupingView;
