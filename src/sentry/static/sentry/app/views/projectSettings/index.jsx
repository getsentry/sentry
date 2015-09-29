import React from "react";
import Router from "react-router";

import ConfigStore from "../../stores/configStore";
import ListLink from "../../components/listLink";

const ProjectSettings = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    setProjectNavSection: React.PropTypes.func.isRequired
  },

  componentWillMount() {
    this.props.setProjectNavSection('settings');
  },

  render() {
    // TODO(dcramer): move sidebar into component
    let urlPrefix = ConfigStore.get('urlPrefix');
    let params = this.context.router.getCurrentParams();
    let settingsUrlRoot = `${urlPrefix}/${params.orgId}/${params.projectId}/settings`;

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
            <ListLink to="projectInstall" params={params}>Instructions</ListLink>
          </ul>
        </div>
        <div className="col-md-10">
          <Router.RouteHandler
              setProjectNavSection={this.setProjectNavSection}
              {...this.props} />
        </div>
      </div>
    );
  }
});

export default ProjectSettings;
