import React, {PropTypes} from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import GroupingStore from '../../stores/groupingStore';
import GroupingActions from '../../actions/groupingActions';

import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import SimilarList from './similarList';

const GroupGroupingView = React.createClass({
  propTypes: {
    query: PropTypes.string
  },

  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],

  getInitialState() {
    return {
      similarItems: [],
      filteredSimilarItems: [],
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

  onGroupingUpdate({similarItems, similarLinks, filteredSimilarItems, loading, error}) {
    if (similarItems) {
      this.setState({
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

  render() {
    let {orgId, projectId} = this.props.params;
    let isLoading = this.state.loading;
    let isError = this.state.error && !isLoading;
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

      </div>
    );
  }
});

export default GroupGroupingView;
