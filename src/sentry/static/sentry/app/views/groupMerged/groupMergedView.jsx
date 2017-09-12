import React from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import ApiMixin from '../../mixins/apiMixin';
import MergedList from './mergedList';
import GroupingActions from '../../actions/groupingActions';
import GroupingStore from '../../stores/groupingStore';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';

const GroupMergedView = React.createClass({
  mixins: [ApiMixin, Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],

  getInitialState() {
    let queryParams = this.props.location.query;
    return {
      mergedItems: [],
      loading: true,
      error: false,
      query: queryParams.query || ''
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
      let queryParams = nextProps.location.query;
      this.setState(
        {
          query: queryParams.query
        },
        this.fetchData
      );
    }
  },

  onGroupingUpdate({mergedItems, mergedLinks, loading, error}) {
    if (mergedItems) {
      this.setState({
        mergedItems,
        mergedLinks,
        loading: typeof loading !== 'undefined' ? loading : false,
        error: typeof error !== 'undefined' ? error : false
      });
    }
  },

  getEndpoint(type = 'hashes') {
    let params = this.props.params;
    let queryParams = {
      ...this.props.location.query,
      limit: 50,
      query: this.state.query
    };

    return `/issues/${params.groupId}/${type}/?${jQuery.param(queryParams)}`;
  },

  fetchData() {
    GroupingActions.fetch([
      {
        endpoint: this.getEndpoint('hashes'),
        dataKey: 'merged',
        queryParams: this.props.location.query
      }
    ]);
  },

  handleCollapse(...args) {
    GroupingActions.collapseFingerprints();
  },

  handleUnmerge(...args) {
    GroupingActions.unmerge({
      groupId: this.props.params.groupId,
      loadingMessage: `${t('Unmerging events')}...`,
      successMessage: t('Events successfully queued for unmerging.'),
      errorMessage: t('Unable to queue events for unmerging.')
    });
  },

  render() {
    let {orgId, projectId, groupId} = this.props.params;
    let isLoading = this.state.loading;
    let isError = this.state.error && !isLoading;
    let isLoadedSuccessfully = !isError && !isLoading;

    return (
      <div>
        <div className="alert alert-block alert-warning">
          <strong>{t('Warning')}:</strong>
          {' '}
          {t(
            'This is an experimental feature. Data may not be immediately available while we process unmerges.'
          )}
        </div>

        {isLoading && <LoadingIndicator />}
        {isError &&
          <LoadingError
            message="Unable to load merged events, please try again later"
            onRetry={this.fetchData}
          />}

        {isLoadedSuccessfully &&
          <MergedList
            items={this.state.mergedItems}
            orgId={orgId}
            projectId={projectId}
            groupId={groupId}
            pageLinks={this.state.mergedLinks}
            busyMap={this.state.busy}
            hiddenMap={this.state.hidden}
            onUnmerge={this.handleUnmerge}
            onCollapse={GroupingActions.collapseFingerprints}
            onExpand={GroupingActions.expandFingerprints}
          />}
      </div>
    );
  }
});

export default GroupMergedView;
