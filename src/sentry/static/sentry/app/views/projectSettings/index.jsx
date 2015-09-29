import React from "react";
import Router from "react-router";

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
    var params = this.context.router.getCurrentParams();
    return (
      <div className="row">
        <div className="col-md-2">
          <h6 className="nav-header">Configuration</h6>
          <ul className="nav nav-stacked">
            <li><a href="">Project Settings</a></li>
            <li><a href="">Notifications</a></li>
            <li><a href="">Rules</a></li>
            <li><a href="">Tags</a></li>
            <li><a href="">Issue Tracking</a></li>
            <li><a href="">Release Tracking</a></li>
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
