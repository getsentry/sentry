import React from "react";
import {Link} from "react-router";

import api from "../../api";
import ListLink from "../../components/listLink";
import LoadingIndicator from "../../components/loadingIndicator";
import RouteMixin from "../../mixins/routeMixin";

var ProjectInstallPlatform = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [RouteMixin],

  static: {
    platforms: {
      python: {
        display: "Python"
      },
      "python-bottle": {
        display: "Bottle"
      },
      "python-django": {
        display: "Django",
      },
      "python-flask": {
        display: "Flask"
      },
      javascript: {
        display: "Javascript"
      },
      nodejs: {
        display: "Node JS"
      },
      php: {
        display: "PHP"
      },
      ruby: {
        display: "Ruby"
      },
      "objective-c": {
        display: "Objective-C"
      },
      "java": {
        display: "Java"
      },
      "c-sharp": {
        display: "C#"
      },
      "go": {
        display: "Go"
      }
    }
  },

  getInitialState() {
    let params = this.context.router.getCurrentParams();
    return {
      isFramework: null,
      link: null,
      name: null,
      sdk: null,
      html: '',
      loading: true,
      orgId: params.orgId,
      projectId: params.projectId,
      platform: params.platform
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  routeDidChange() {
    let params = this.context.router.getCurrentParams();
    this.setState({
      orgId: params.orgId,
      projectId: params.projectId,
      platform: params.platform,
      loading: true
    }, this.fetchData);
  },

  fetchData() {
    let {orgId, projectId, platform} = this.state;
    api.request(`/projects/${orgId}/${projectId}/docs/${platform}/`, {
      success: (data) => {
        this.setState(Object.assign({loading:false}, data));
      }
    });
  },

  render() {
    let params = this.context.router.getCurrentParams();
    let {platform} = this.state;

    return (
      <div className="row">
        <div className="col-md-2">
          <h6 className="nav-header">Python</h6>
          <ul className="nav nav-stacked">
            <ListLink
              to="projectInstallPlatform"
              params={Object.assign({}, params, {platform: 'python'})}>Generic</ListLink>
            <ListLink
              to="projectInstallPlatform"
              params={Object.assign({}, params, {platform: 'python-bottle'})}>Bottle</ListLink>
            <ListLink
              to="projectInstallPlatform"
              params={Object.assign({}, params, {platform: 'python-django'})}>Django</ListLink>
            <ListLink
              to="projectInstallPlatform"
              params={Object.assign({}, params, {platform: 'python-flask'})}>Flask</ListLink>
            <ListLink
              to="projectInstallPlatform"
              params={Object.assign({}, params, {platform: 'python-pylons'})}>Pylons</ListLink>
            <ListLink
              to="projectInstallPlatform"
              params={Object.assign({}, params, {platform: 'python-pyramid'})}>Pyramid</ListLink>
            <ListLink
              to="projectInstallPlatform"
              params={Object.assign({}, params, {platform: 'python-tornado'})}>Tornado</ListLink>
          </ul>
          <h6 className="nav-header">JavaScript</h6>
          <ul className="nav nav-stacked">
            <li><a href="#">Generic</a></li>
            <li><a href="#">Angular</a></li>
            <li><a href="#">Ember</a></li>
            <li><a href="#">React</a></li>
          </ul>
        </div>
        <div className="col-md-10">
          <div className="box">
            <div className="box-content with-padding">

              <div className="pull-right">
                <a href={this.state.link} className="btn btn-default">Full Documentation</a>
              </div>

              <h1>Configure {this.static.platforms[platform].display}</h1>

              {this.state.loading
                ? <LoadingIndicator/>
                : (
                  <div>
                    <p>
                      This is a quick getting started guide. For in-depth instructions on integrating Sentry with {this.state.name}, view <a href={this.state.link}>our complete documentation</a>.
                    </p>
                    <div dangerouslySetInnerHTML={{__html: this.state.html}}/>
                    <Link to="stream" params={params} className="btn btn-primary">Continue</Link>
                  </div>
                )
              }
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default ProjectInstallPlatform;
