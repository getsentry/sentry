import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import LatestContextStore from '../../stores/latestContextStore';
import StreamTagStore from '../../stores/streamTagStore';
import GroupStore from '../../stores/groupStore';
import ProjectState from '../../mixins/projectState';
import StreamTagActions from '../../actions/streamTagActions';
import AlertActions from '../../actions/alertActions';
import ApiMixin from '../../mixins/apiMixin';

import LoadingIndicator from '../../components/loadingIndicator';

import {resetIssues} from '../../actionCreators/groups';

import {t} from '../../locale';

import Stream from './stream';

import {logAjaxError} from '../../utils/logging';

const MAX_TAGS = 500;

const StreamContainer = createReactClass({
  displayName: 'StreamContainer',

  propTypes: {
    setProjectNavSection: PropTypes.func,
  },

  mixins: [
    ProjectState,
    ApiMixin,
    Reflux.listenTo(LatestContextStore, 'onLatestContextChange'),
    Reflux.listenTo(StreamTagStore, 'onStreamTagChange'),
    Reflux.listenTo(GroupStore, 'onGroupsChange'),
  ],

  getInitialState() {
    const hasEnvironmentsFeature = new Set(this.getOrganization().features).has(
      'environments'
    );

    return {
      hasEnvironmentsFeature,
      environment: hasEnvironmentsFeature
        ? LatestContextStore.getInitialState().environment
        : null,
      tags: StreamTagStore.getAllTags(),
      groupIds: [],
      savedSearches: [],
      tagsLoading: true,
      savedSearchLoading: true,
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('stream');
    this.fetchTags();
    this.fetchSavedSearches();
  },

  componentWillUnmount() {
    resetIssues();
  },

  onLatestContextChange(context) {
    // Don't do anything unless environment is changing
    if (context.environment === this.state.environment) return;

    if (this.state.hasEnvironmentsFeature) {
      this.setState({
        environment: context.environment,
      });
    }
  },

  onGroupsChange(groupIds) {
    // always order ascending by ID

    this.setState({
      groupIds: [...groupIds].sort((a, b) => b - a),
    });
  },

  onStreamTagChange(tags) {
    // new object to trigger state change
    this.setState({
      tags: {...tags},
    });
  },

  fetchSavedSearches() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/searches/`, {
      success: data => {
        this.setState({
          savedSearchLoading: false,
          savedSearches: data,
        });
      },
      error: error => {
        // Fail gracefully by still loading the stream
        logAjaxError(error);
        this.setState({
          savedSearchLoading: false,
          savedSearches: [],
        });
      },
    });
  },

  fetchTags() {
    StreamTagStore.reset();
    StreamTagActions.loadTags();

    let {orgId, projectId} = this.props.params;

    this.api.request(`/projects/${orgId}/${projectId}/tags/`, {
      success: tags => {
        let trimmedTags = tags.slice(0, MAX_TAGS);

        if (tags.length > MAX_TAGS) {
          AlertActions.addAlert({
            message: t('You have too many unique tags and some have been truncated'),
            type: 'warn',
          });
        }
        this.setState({tagsLoading: false});
        StreamTagActions.loadTagsSuccess(trimmedTags);
      },
      error: error => {
        this.setState({tagsLoading: false});
        StreamTagActions.loadTagsError();
      },
    });
  },

  renderLoading: function() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  render: function() {
    // this.state.groupIds === undefined ||
    if (this.state.savedSearchLoading || this.state.tagsLoading) {
      return this.renderLoading();
    }

    return (
      <Stream
        location={this.props.location}
        params={this.props.params}
        environment={this.state.environment}
        project={this.getProject()}
        organization={this.getOrganization()}
        tags={this.state.tags}
        groupIds={this.state.groupIds}
        savedSearches={this.state.savedSearches}
      />
    );
  },
});

export default StreamContainer;
