import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import withApi from 'app/utils/withApi';
import ProjectState from 'app/mixins/projectState';

import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';

const ProjectDocsContext = createReactClass({
  propTypes: {
    api: PropTypes.object,
  },

  displayName: 'ProjectDocsContext',
  mixins: [ProjectState],

  getInitialState() {
    return {
      loading: true,
      data: null,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    const org = this.context.organization;
    if (!org) {
      return;
    }

    const orgId = org.slug;
    const projectId = this.context.project.slug;

    this.props.api.request(`/projects/${orgId}/${projectId}/docs/`, {
      success: data => {
        this.setState({
          loading: false,
          data,
        });
      },
    });
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    const data = this.state.data;
    return React.cloneElement(this.props.children, {
      project: this.context.project,
      platformData: data,
    });
  },
});

export {ProjectDocsContext};

export default withApi(ProjectDocsContext);
