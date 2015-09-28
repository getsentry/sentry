import React from "react";
import {Link} from "react-router";

import api from "../../api";
import LanguageNav from "./languageNav";
import LoadingIndicator from "../../components/loadingIndicator";
import jQuery from "jquery";
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
      "python-celery": {
        display: "Celery",
      },
      "python-django": {
        display: "Django",
      },
      "python-flask": {
        display: "Flask"
      },
      "python-pylons": {
        display: "Pylons"
      },
      "python-pyramid": {
        display: "Pyramid"
      },
      "python-tornado": {
        display: "Tornado"
      },
      javascript: {
        display: "JavaScript"
      },
      node: {
        display: "Node JS"
      },
      "node-express": {
        display: "Express"
      },
      "node-koa": {
        display: "Koa"
      },
      "node-connect": {
        display: "Connect"
      },
      php: {
        display: "PHP"
      },
      "php-laravel": {
        display: "Laravel"
      },
      "php-monolog": {
        display: "Monolog"
      },
      "php-symfony2": {
        display: "Symfony2"
      },
      ruby: {
        display: "Ruby"
      },
      "ruby-rack": {
        display: "Rack"
      },
      "ruby-rails": {
        display: "Rails"
      },
      "objective-c": {
        display: "Objective-C"
      },
      java: {
        display: "Java"
      },
      "java-log4j": {
        display: "Log4j"
      },
      "java-log4j2": {
        display: "Log4j 2"
      },
      "java-logback": {
        display: "Logback"
      },
      "java-appengine": {
        display: "App Engine"
      },
      "c-sharp": {
        display: "C#"
      },
      go: {
        display: "Go"
      }
    }
  },

  getInitialState() {
    return {
      isFramework: null,
      link: null,
      name: null,
      sdk: null,
      html: '',
      loading: true,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  componentWillMount() {
    jQuery(document.body).addClass("white-bg");
  },

  componentWillUnmount() {
    jQuery(document.body).removeClass("white-bg");
  },

  routeDidChange() {
    this.setState({
      loading: true
    }, this.fetchData);
  },

  fetchData() {
    let {orgId, projectId, platform} = this.context.router.getCurrentParams();
    api.request(`/projects/${orgId}/${projectId}/docs/${platform}/`, {
      success: (data) => {
        this.setState(Object.assign({loading:false}, data));
      }
    });
  },

  getPlatformLink(platform, display) {
    let params = this.context.router.getCurrentParams();
    if (typeof display === "undefined") {
      display = this.static.platforms[platform].display;
    }
    return (
      <Link
        to="projectInstallPlatform"
        className="list-group-item"
        params={Object.assign({}, params, {platform: platform})}>
          {display}
      </Link>
    );
  },

  render() {
    let params = this.context.router.getCurrentParams();
    let {platform} = params;

    return (
      <div className="install row">
        <div className="install-sidebar col-md-2">
          <LanguageNav name="Python" active={platform.indexOf('python') !== -1}>
            {this.getPlatformLink('python', 'Generic')}
            {this.getPlatformLink('python-bottle')}
            {this.getPlatformLink('python-django')}
            {this.getPlatformLink('python-flask')}
            {this.getPlatformLink('python-pylons')}
            {this.getPlatformLink('python-pyramid')}
            {this.getPlatformLink('python-tornado')}
          </LanguageNav>
          <LanguageNav name="JavaScript" active={platform.indexOf('javascript') !== -1}>
            {this.getPlatformLink('javascript', 'Generic')}
          </LanguageNav>
        </div>
        <div className="install-content col-md-10">
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
                <Link to="stream" params={params} className="btn btn-primary btn-lg">Continue</Link>
              </div>
            )
          }
        </div>
      </div>
    );
  }
});

export default ProjectInstallPlatform;
