import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import {omit} from 'lodash';

import ProjectState from '../../mixins/projectState';
import StreamTagStore from '../../stores/streamTagStore';
import withEnvironment from '../../utils/withEnvironment';
import Stream from './stream';
import {fetchStreamTags} from '../../actionCreators/streamTag';

const StreamContainer = createReactClass({
  displayName: 'StreamContainer',
  propTypes: {
    environment: PropTypes.object,
    setProjectNavSection: PropTypes.func,
  },

  mixins: [ProjectState, Reflux.listenTo(StreamTagStore, 'onStreamTagChange')],

  getInitialState() {
    const hasEnvironmentsFeature = new Set(this.getOrganization().features).has(
      'environments'
    );

    return {
      tags: StreamTagStore.getAllTags(),
      tagsLoading: true,
      hasEnvironmentsFeature,
    };
  },

  componentWillMount() {
    const {orgId, projectId} = this.props.params;
    this.props.setProjectNavSection('stream');
    fetchStreamTags(orgId, projectId);
  },

  onStreamTagChange(tags) {
    this.setState({
      tags,
      tagsLoading: false,
    });
  },

  // We don't want the environment tag to be visible to the user
  filterTags(tags) {
    return omit(tags, 'environment');
  },

  render() {
    const {hasEnvironmentsFeature, tagsLoading, tags} = this.state;
    const filteredTags = hasEnvironmentsFeature ? this.filterTags(this.state.tags) : tags;

    return (
      <Stream
        hasEnvironmentsFeature={hasEnvironmentsFeature}
        tags={filteredTags}
        tagsLoading={tagsLoading}
        {...this.props}
      />
    );
  },
});

export default withEnvironment(StreamContainer);
