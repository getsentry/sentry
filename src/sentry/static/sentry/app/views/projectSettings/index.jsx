import React from "react";
import Router from "react-router";

import api from "../../api";
import ConfigStore from "../../stores/configStore";
import ListLink from "../../components/listLink";
import LoadingError from "../../components/loadingError";
import LoadingIndicator from "../../components/loadingIndicator";
import RouteMixin from "../../mixins/routeMixin";

const ProjectSettings = React.createClass({
  mixins: [RouteMixin],

  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    setProjectNavSection: React.PropTypes.func.isRequired
  },

  componentWillMount() {
    this.props.setProjectNavSection('settings');
    this.fetchData();
  },

  routeDidChange(nextPath, nextParams) {
    var params = this.context.router.getCurrentParams();
    if (nextParams.projectId != params.projectId ||
        nextParams.orgId != params.orgId) {
      this.setState({
        loading: true,
        error: false
      }, this.fetchData);
    }
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      project: null
    };
  },

  fetchData() {
    var params = this.context.router.getCurrentParams();

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
    let params = this.context.router.getCurrentParams();
    let settingsUrlRoot = `${urlPrefix}/${params.orgId}/${params.projectId}/settings`;
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
            <ListLink to="projectInstall" params={params} isActive={function (to) {
              let router = this.context.router;
              return router.isActive('projectInstall') || router.isActive('projectInstallPlatform');
            }}>Instructions</ListLink>
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
          <Router.RouteHandler
              setProjectNavSection={this.setProjectNavSection}
              project={project}
              {...this.props} />
        </div>
      </div>
    );
  }
});

export default ProjectSettings;
