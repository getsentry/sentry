import React from 'react';

import api from '../../api';
import ConfigStore from '../../stores/configStore';
import ListLink from '../../components/listLink';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';

const ProjectSettings = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      project: null
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('settings');
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    let params = this.props.params;
    if (nextProps.params.projectId !== params.projectId ||
        nextProps.params.orgId !== params.orgId) {
      this.setState({
        loading: true,
        error: false
      }, this.fetchData);
    }
  },

  fetchData() {
    let params = this.props.params;

    api.request(`/projects/${params.orgId}/${params.projectId}/`, {
      success: (data) => {
        this.setState({
          project: data,
          loading: false,
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  render() {
    // TODO(dcramer): move sidebar into component
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let urlPrefix = ConfigStore.get('urlPrefix');
    let {orgId, projectId} = this.props.params;
    let settingsUrlRoot = `${urlPrefix}/${orgId}/${projectId}/settings`;
    let project = this.state.project;

    return (
      <div className="row">
        <div className="col-md-2">
          <h6 className="nav-header">Configuration</h6>
          <ul className="nav nav-stacked">
            <li><a href={`${settingsUrlRoot}/`}>Project Settings</a></li>
            <li><a href={`${settingsUrlRoot}/notifications/`}>Notifications</a></li>
            <li><a href={`${settingsUrlRoot}/rules/`}>Rules</a></li>
            <li><a href={`${settingsUrlRoot}/tags/`}>Tags</a></li>
            <li><a href={`${settingsUrlRoot}/issue-tracking/`}>Issue Tracking</a></li>
            <li><a href={`${settingsUrlRoot}/release-tracking/`}>Release Tracking</a></li>
          </ul>
          <h6 className="nav-header">Setup</h6>
          <ul className="nav nav-stacked">
            <ListLink to="install/" isActive={function (to) {
              let rootInstallPath = `/${orgId}/${projectId}/settings/install/`;
              let pathname = this.context.location.pathname;

              // Because react-router 1.0 removes router.isActive(route)
              return pathname === rootInstallPath || /install\/[\w\-]+\/$/.test(pathname);
            }.bind(this)}>Instructions</ListLink>
            <li><a href={`${settingsUrlRoot}/keys/`}>Client Keys</a></li>
          </ul>
          <h6 className="nav-header">Integrations</h6>
          <ul className="nav nav-stacked">
            <li><a href={`${settingsUrlRoot}/plugins/`}>All Integrations</a></li>
            {project.activePlugins.map((plugin) => {
              return <li><a href={`${settingsUrlRoot}/plugins/${plugin.id}/`}>{plugin.name}</a></li>;
            })}
          </ul>
        </div>
        <div className="col-md-10">
          {React.cloneElement(this.props.children, {
            setProjectNavSection: this.props.setProjectNavSection,
            project: project
          })}
        </div>
      </div>
    );
  }
});

export default ProjectSettings;
