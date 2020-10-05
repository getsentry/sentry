import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import * as queryString from 'query-string';

import {t} from 'app/locale';
import GroupingActions from 'app/actions/groupingActions';
import GroupingStore from 'app/stores/groupingStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes from 'app/sentryTypes';

import MergedList from './mergedList';

const GroupMergedView = createReactClass({
  displayName: 'GroupMergedView',
  propTypes: {
    project: SentryTypes.Project,
  },
  mixins: [Reflux.listenTo(GroupingStore, 'onGroupingUpdate')],

  getInitialState() {
    const queryParams = this.props.location.query;
    return {
      mergedItems: [],
      loading: true,
      error: false,
      query: queryParams.query || '',
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
      const queryParams = nextProps.location.query;
      this.setState(
        {
          query: queryParams.query,
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
        error: typeof error !== 'undefined' ? error : false,
      });
    }
  },

  getEndpoint(type = 'hashes') {
    const params = this.props.params;
    const queryParams = {
      ...this.props.location.query,
      limit: 50,
      query: this.state.query,
    };

    return `/issues/${params.groupId}/${type}/?${queryString.stringify(queryParams)}`;
  },

  fetchData() {
    GroupingActions.fetch([
      {
        endpoint: this.getEndpoint('hashes'),
        dataKey: 'merged',
        queryParams: this.props.location.query,
      },
    ]);
  },

  handleCollapse() {
    GroupingActions.collapseFingerprints();
  },

  handleUnmerge() {
    GroupingActions.unmerge({
      groupId: this.props.params.groupId,
      loadingMessage: `${t('Unmerging events')}...`,
      successMessage: t('Events successfully queued for unmerging.'),
      errorMessage: t('Unable to queue events for unmerging.'),
    });
  },

  render() {
    const isLoading = this.state.loading;
    const isError = this.state.error && !isLoading;
    const isLoadedSuccessfully = !isError && !isLoading;

    return (
      <div>
        <div className="alert alert-block alert-warning">
          <strong>{t('Warning')}:</strong>{' '}
          {t(
            'This is an experimental feature. Data may not be immediately available while we process unmerges.'
          )}
        </div>

        {isLoading && <LoadingIndicator />}
        {isError && (
          <LoadingError
            message="Unable to load merged events, please try again later"
            onRetry={this.fetchData}
          />
        )}

        {isLoadedSuccessfully && (
          <MergedList
            orgId={this.props.params.orgId}
            project={this.props.project}
            items={this.state.mergedItems}
            pageLinks={this.state.mergedLinks}
            onUnmerge={this.handleUnmerge}
            onToggleCollapse={GroupingActions.toggleCollapseFingerprints}
          />
        )}
      </div>
    );
  },
});

export {GroupMergedView};

export default GroupMergedView;
