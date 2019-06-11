import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import queryString from 'query-string';

import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import GroupingActions from 'app/actions/groupingActions';
import GroupingStore from 'app/stores/groupingStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';

import SimilarList from './similarList';

const GroupGroupingView = createReactClass({
  displayName: 'GroupGroupingView',

  propTypes: {
    project: SentryTypes.Project,
    query: PropTypes.string,
  },

  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],

  getInitialState() {
    return {
      similarItems: [],
      filteredSimilarItems: [],
      similarLinks: [],
      loading: true,
      error: false,
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
    mergedParent,
    similarItems,
    similarLinks,
    filteredSimilarItems,
    loading,
    error,
  }) {
    if (similarItems) {
      this.setState({
        similarItems,
        similarLinks,
        filteredSimilarItems,
        loading: typeof loading !== 'undefined' ? loading : false,
        error: typeof error !== 'undefined' ? error : false,
      });
    } else if (mergedParent && mergedParent !== this.props.params.groupId) {
      const {params} = this.props;
      // Merge success, since we can't specify target, we need to redirect to new parent
      browserHistory.push(
        `/organizations/${params.orgId}/issues/${mergedParent}/similar/`
      );
    }
  },

  getEndpoint(type = 'similar') {
    const params = this.props.params;
    const queryParams = {
      ...this.props.location.query,
      limit: 50,
    };

    return `/issues/${params.groupId}/${type}/?${queryString.stringify(queryParams)}`;
  },

  hasSimilarityFeature() {
    return new Set(this.props.project.features).has('similarity-view');
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const reqs = [];

    if (this.hasSimilarityFeature()) {
      reqs.push({
        endpoint: this.getEndpoint('similar'),
        dataKey: 'similar',
        queryParams: this.props.location.query,
      });
    }

    GroupingActions.fetch(reqs);
  },

  handleMerge() {
    const {query, params} = this.props;

    if (params) {
      // You need at least 1 similarItem OR filteredSimilarItems to be able to merge,
      // so `firstIssue` should always exist from one of those lists.
      //
      // Similar issues API currently does not return issues across projects,
      // so we can assume that the first issues project slug is the project in
      // scope
      const [firstIssue] = this.state.similarItems.length
        ? this.state.similarItems
        : this.state.filteredSimilarItems;

      GroupingActions.merge({
        params,
        query,
        projectId: firstIssue.issue.project.slug,
      });
    }
  },

  render() {
    const {orgId, groupId} = this.props.params;
    const isLoading = this.state.loading;
    const isError = this.state.error && !isLoading;
    const isLoadedSuccessfully = !isError && !isLoading;
    const hasSimilarItems =
      this.hasSimilarityFeature() &&
      (this.state.similarItems.length >= 0 ||
        this.state.filteredSimilarItems.length >= 0) &&
      isLoadedSuccessfully;

    return (
      <div>
        <div className="alert alert-block alert-warning">
          <strong>{t('Warning')}:</strong>{' '}
          {t(
            'This is an experimental feature. Data may not be immediately available while we process merges.'
          )}
        </div>

        {isLoading && <LoadingIndicator />}
        {isError && (
          <LoadingError
            message="Unable to load similar issues, please try again later"
            onRetry={this.fetchData}
          />
        )}

        {hasSimilarItems && (
          <SimilarList
            items={this.state.similarItems}
            filteredItems={this.state.filteredSimilarItems}
            onMerge={this.handleMerge}
            orgId={orgId}
            groupId={groupId}
            pageLinks={this.state.similarLinks}
          />
        )}
      </div>
    );
  },
});

export default GroupGroupingView;
