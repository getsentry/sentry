import React from 'react';

import createReactClass from 'create-react-class';

import ApiMixin from 'app/mixins/apiMixin';
import ProjectState from 'app/mixins/projectState';

import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';

const ProjectDocsContext = createReactClass({
  displayName: 'ProjectDocsContext',
  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    return {
      loading: true,
      platformList: null,
      project: null,
      team: null,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let org = this.context.organization;
    if (!org) {
      return;
    }

    let orgId = org.slug;
    let projectId = this.context.project.slug;

    this.api.request(`/projects/${orgId}/${projectId}/docs/`, {
      success: data => {
        this.setState({
          loading: false,
          data,
        });
      },
    });
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    let data = this.state.data;
    return React.cloneElement(this.props.children, {
      platformData: data,
    });
  },
});

export default ProjectDocsContext;
